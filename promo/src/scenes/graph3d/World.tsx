import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { COLORS } from '../../config';
import { RADII, type Structure } from '../../structure/model';
import type { LayoutMode } from '../../lib/util';
import { EASE, ramp } from '../../lib/motion';
import { B3, B4 } from './beats';
import {
  applyCamera,
  cameraAt,
  edgeGrowth,
  edgePoint,
  nodeLight,
  nodePop,
  nodePos,
  packetAt,
  pulses,
  scopeSectors,
  WORLD_SCALE,
  type V3,
} from './choreo';

/**
 * The 3D org chart, rendered with three.js inside Remotion's <ThreeCanvas>.
 *
 * Every frame is rendered `samples` times across a 180° shutter and
 * averaged (true motion blur — moving nodes and the camera both smear),
 * then bloomed and given depth of field from the scene's real depth.
 * Nothing here keeps state between frames: `update(F)` poses the whole
 * world for any master frame, so frames render in any order, in parallel.
 */

type Props = { F: number; step: number; st: Structure; mode: LayoutMode; mirror: boolean; W: number; H: number; samples: number; bloom: number };

/** Bloom works at half the buffer size: the glow is soft anyway, and it is the costliest pass. */
class HalfResBloomPass extends UnrealBloomPass {
  setSize(width: number, height: number) {
    super.setSize(Math.round(width / 2), Math.round(height / 2));
  }
}

const NODE_SIZE = [0.62, 0.36, 0.22, 0.105];
const EDGE_RADIUS = [0, 0.042, 0.027, 0.013];
const EMISSIVE = [3.2, 2.4, 1.9, 1.05];
/** Edge brightness per level: the many employee edges stay quiet. */
const EDGE_GLOW = [0, 1, 0.8, 0.5];

const hdr = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);
const v = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);

/** A soft radial texture for the floor glow, drawn once. */
const radialTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(79,124,255,0.2)');
  grad.addColorStop(0.35, 'rgba(79,124,255,0.05)');
  grad.addColorStop(1, 'rgba(79,124,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const buildWorld = (st: Structure) => {
  const root = new THREE.Group();
  const blue = COLORS.accent;

  // Light: a cool key from above-left, the HQ glowing from the middle.
  root.add(new THREE.AmbientLight('#3B4C8C', 0.55));
  const key = new THREE.DirectionalLight('#DCE5FF', 1.6);
  key.position.set(-9, 16, 11);
  root.add(key);
  const hqLight = new THREE.PointLight(blue, 0, 26, 1.6);
  hqLight.position.set(0, 1.2, 0);
  root.add(hqLight);

  // Floor: polar grid + glow, so perspective and parallax read.
  const outer = RADII[3] * WORLD_SCALE + 1.9;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(outer + 4, 96),
    new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.04;
  root.add(floor);
  const gridMat = new THREE.LineBasicMaterial({ color: '#7FA0FF', transparent: true, opacity: 0.09, depthWrite: false });
  // One draw call: rings and spokes as a single segment list.
  const seg: THREE.Vector3[] = [];
  const ringPt = (r: number, i: number, n: number) => new THREE.Vector3(r * Math.cos((i / n) * Math.PI * 2), -0.02, r * Math.sin((i / n) * Math.PI * 2));
  [...RADII.slice(1).map((r) => r * WORLD_SCALE), outer].forEach((r) => {
    for (let i = 0; i < 160; i++) seg.push(ringPt(r, i, 160), ringPt(r, i + 1, 160));
  });
  for (let i = 0; i < 48; i++) seg.push(ringPt(1.2, i, 48), ringPt(outer, i, 48));
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), gridMat));

  // Scope sectors: Admin = everything, RM = their zone, Supervisor = their market.
  const sector = (r0: number, r1: number, mid: number, span: number) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, 96, 1, ((mid - span / 2) * Math.PI) / 180, (span * Math.PI) / 180),
      new THREE.MeshBasicMaterial({ color: hdr(blue, 1), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    // Ring geometry lives in XY; lying it down maps its angle onto the disc.
    m.rotation.x = Math.PI / 2;
    m.position.y = -0.01;
    root.add(m);
    return m;
  };
  const fz = st.nodes[st.focusZone];
  const fm = st.nodes[st.focusMarket];
  const marketsInZone = st.nodes.filter((n) => n.level === 2 && n.zone === fz.zone).length;
  const sectors = {
    admin: sector(0.9, outer, 90, 360),
    rm: sector(0.9, outer, fz.angle, st.zoneSpan * 0.98),
    sup: sector(RADII[2] * WORLD_SCALE - 1.1, outer, fm.angle, (st.zoneSpan / marketsInZone) * 0.96),
  };

  // Nodes.
  const sphere = new THREE.SphereGeometry(1, 40, 20);
  const nodes = st.nodes.map((n) => {
    const mat = new THREE.MeshStandardMaterial({ color: '#1A2B66', emissive: blue, emissiveIntensity: EMISSIVE[n.level], roughness: 0.22, metalness: 0.15 });
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.copy(v(nodePos(n)));
    mesh.position.y = NODE_SIZE[n.level] * 0.15;
    root.add(mesh);
    // A white-hot core makes each node read as a light, not a blob.
    const core = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: hdr('#DCE5FF', 2.6), transparent: true }));
    core.position.copy(mesh.position);
    root.add(core);
    return { n, mesh, mat, core };
  });
  // HQ: a white-hot core and a slowly turning ring.
  const hqCore = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), new THREE.MeshBasicMaterial({ color: hdr('#FFFFFF', 3.4) }));
  root.add(hqCore);
  const hqRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.025, 8, 128), new THREE.MeshBasicMaterial({ color: hdr('#9BB3FF', 2.4), transparent: true }));
  hqRing.rotation.x = Math.PI / 2;
  root.add(hqRing);

  // Edges: arcing tubes that grow from parent to child.
  const SEG = 48;
  const edges = st.edges.map((e) => {
    const a = nodePos(st.nodes[e.from]);
    const b = nodePos(st.nodes[e.to]);
    const mid = edgePoint(a, b, 0.5);
    // A quadratic through edgePoint's control point: 2·mid − (a+b)/2.
    const c: V3 = [2 * mid[0] - (a[0] + b[0]) / 2, 2 * mid[1] - (a[1] + b[1]) / 2, 2 * mid[2] - (a[2] + b[2]) / 2];
    const curve = new THREE.QuadraticBezierCurve3(v(a), v(c), v(b));
    const radial = 6;
    const geo = new THREE.TubeGeometry(curve, SEG, EDGE_RADIUS[e.level], radial, false);
    const mat = new THREE.MeshBasicMaterial({ color: hdr('#7FA0FF', 1.25), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geo, mat);
    root.add(mesh);
    return { e, mesh, mat, geo, per: radial * 6, n: st.nodes[e.to] };
  });

  // The task packet with a comet tail.
  const packet = new THREE.Group();
  const pCore = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 12), new THREE.MeshBasicMaterial({ color: hdr('#FFFFFF', 4) }));
  const pHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 12),
    new THREE.MeshBasicMaterial({ color: hdr(blue, 1.6), transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  packet.add(pCore, pHalo);
  root.add(packet);
  // Dense enough that, with motion blur, the beads merge into one streak.
  const tail = Array.from({ length: 22 }, () => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 8),
      new THREE.MeshBasicMaterial({ color: hdr('#9BB3FF', 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    root.add(m);
    return m;
  });

  // Ring pulses when the task lands somewhere.
  const pulseList = pulses(st).map(([idx, at]) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 96),
      new THREE.MeshBasicMaterial({ color: hdr('#DCE5FF', 2.5), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    m.rotation.x = Math.PI / 2;
    m.position.copy(v(nodePos(st.nodes[idx])));
    m.position.y = 0.02;
    root.add(m);
    return { m, at, level: st.nodes[idx].level };
  });

  const update = (F: number) => {
    const lit = st.nodes.map((n) => nodeLight(F, n, st));

    nodes.forEach(({ n, mesh, mat, core }) => {
      const pop = nodePop(F, n);
      mesh.visible = pop > 0.002;
      // Cores on zones and markets only; a hundred hot employee cores bloom into fog.
      core.visible = (n.level === 1 || n.level === 2) && pop > 0.002;
      mesh.scale.setScalar(Math.max(0.0001, pop) * NODE_SIZE[n.level]);
      core.scale.setScalar(Math.max(0.0001, pop) * NODE_SIZE[n.level] * 0.42);
      const arriveFlash = n.level > 0 ? Math.max(0, 1 - Math.abs(pop - 1) * 3) * 0.6 : 0;
      mat.emissiveIntensity = EMISSIVE[n.level] * lit[n.idx] * (1 + arriveFlash);
      (core.material as THREE.MeshBasicMaterial).opacity = Math.min(1, 0.15 + 0.85 * lit[n.idx]);
    });
    const hqPop = nodePop(F, st.nodes[st.hq]);
    hqCore.visible = hqPop > 0.002;
    hqCore.scale.setScalar(Math.max(0.0001, hqPop));
    hqRing.visible = hqPop > 0.002;
    hqRing.scale.setScalar(Math.max(0.0001, hqPop) * (1 + 0.04 * Math.sin(F * 0.05)));
    hqRing.rotation.z = F * 0.012;
    hqLight.intensity = 60 * Math.min(1, hqPop);

    edges.forEach(({ mesh, mat, geo, per, n }) => {
      const g = edgeGrowth(F, n);
      mesh.visible = g > 0.001;
      geo.setDrawRange(0, Math.ceil(g * SEG) * per);
      mat.opacity = 0.9 * EDGE_GLOW[n.level] * lit[n.idx];
    });

    const sc = scopeSectors(F);
    sectors.admin.material.opacity = 0.04 * sc.admin;
    sectors.rm.material.opacity = 0.13 * sc.rm;
    sectors.sup.material.opacity = 0.2 * sc.sup;
    (Object.keys(sectors) as (keyof typeof sectors)[]).forEach((k) => {
      sectors[k].visible = sc[k] > 0.002;
    });

    const p = packetAt(F, st);
    packet.visible = !!p && p.on > 0.01;
    if (p) {
      packet.position.set(p.pos[0], p.pos[1] + 0.12, p.pos[2]);
      packet.scale.setScalar(0.4 + 0.6 * p.on);
    }
    tail.forEach((m, i) => {
      const q = packetAt(F - (i + 1) * 0.32, st);
      m.visible = !!q && !!p && q.on > 0.01;
      if (q) {
        m.position.set(q.pos[0], q.pos[1] + 0.12, q.pos[2]);
        const k = 1 - i / tail.length;
        m.scale.setScalar(Math.max(0.0001, k * q.on));
        m.material.opacity = 0.6 * k * q.on;
      }
    });

    pulseList.forEach(({ m, at, level }) => {
      const t = ramp(F, at, at + 34, 0, 1, EASE.out);
      m.visible = t > 0 && t < 1;
      m.scale.setScalar(NODE_SIZE[level] * (1.2 + 6 * t));
      m.material.opacity = 0.9 * (1 - t);
    });
  };

  const dispose = () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
  };

  return { root, update, dispose };
};

/** Renders `samples` sub-frames into the read buffer and averages them. */
class AccumulatePass extends Pass {
  private sampleTarget: THREE.WebGLRenderTarget;
  private quad: FullScreenQuad;
  private material: THREE.ShaderMaterial;
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private samples: () => number,
    private pose: (s: number, n: number) => void,
  ) {
    super();
    this.needsSwap = false;
    this.sampleTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, weight: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float weight; varying vec2 vUv; void main() { gl_FragColor = texture2D(tDiffuse, vUv) * weight; }',
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  setSize(width: number, height: number) {
    this.sampleTarget.setSize(width, height);
  }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const n = Math.max(1, Math.round(this.samples()));
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(read);
    renderer.clear();
    for (let s = 0; s < n; s++) {
      this.pose(s, n);
      renderer.setRenderTarget(this.sampleTarget);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      this.material.uniforms.tDiffuse.value = this.sampleTarget.texture;
      this.material.uniforms.weight.value = 1 / n;
      renderer.setRenderTarget(read);
      this.quad.render(renderer);
    }
    // Leave the world posed at the frame's centre for the depth-based passes.
    this.pose(-1, n);
  }
  dispose() {
    this.sampleTarget.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}

/**
 * Motion blur only where there is motion: the sub-frame count follows how
 * far key points travel on screen during the shutter (≈4 px per sample),
 * so slow drifts render once and whip pans get the full count.
 */
const probe = new THREE.PerspectiveCamera();
const samplesFor = ({ F, step, mode, mirror, st, W, H, samples }: Props) => {
  if (samples <= 1) return 1;
  const points: V3[] = [nodePos(st.nodes[st.hq]), nodePos(st.nodes[st.focusZone]), nodePos(st.nodes[st.focusMarket]), nodePos(st.nodes[st.focusEmployee])];
  const at = (t: number) => {
    applyCamera(probe, cameraAt(t, mode, st, mirror), W, H);
    const pk = packetAt(t, st);
    return [...points, ...(pk ? [pk.pos] : [])].map((p) => {
      const q = new THREE.Vector3(p[0], p[1], p[2]).project(probe);
      return [q.x * W * 0.5, q.y * H * 0.5];
    });
  };
  const a = at(F - step * 0.25);
  const b = at(F + step * 0.25);
  const px = Math.max(...a.map((p, i) => (b[i] ? Math.hypot(b[i][0] - p[0], b[i][1] - p[1]) : 0)));
  // Growing edges move too, but slowly; the camera and packet dominate.
  const growing = F >= B3.zones && F < B3.employees + 70 ? 1 : 0;
  return Math.max(1 + growing, Math.min(samples, Math.ceil(px / 4)));
};

export const World: React.FC<Props> = (props) => {
  // Remotion advances R3F after React commits, so the latest props are
  // always in this ref when the render loop below runs.
  const latest = useRef(props);
  latest.current = props;
  const { gl, scene, camera } = useThree();
  const { st, W, H } = props;

  const world = useMemo(() => buildWorld(st), [st]);
  useEffect(() => () => world.dispose(), [world]);

  const composer = useMemo(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const pose = (s: number, n: number) => {
      const { F, step, mode, mirror } = latest.current;
      // 180° shutter centred on the frame; `step` scales it in sped-up shots.
      const t = s < 0 || n === 1 ? F : F + step * ((s + 0.5) / n - 0.5) * 0.5;
      world.update(t);
      applyCamera(cam, cameraAt(t, mode, st, mirror), W, H);
    };
    const c = new EffectComposer(gl);
    c.setPixelRatio(gl.getPixelRatio());
    c.setSize(W, H);
    c.addPass(new AccumulatePass(scene, cam, () => samplesFor(latest.current), pose));
    const bloom = new HalfResBloomPass(new THREE.Vector2(W / 2, H / 2), props.bloom, 0.28, 0.5);
    c.addPass(bloom);
    const bokeh = new BokehPass(scene, cam, { focus: 20, aperture: 0.0002, maxblur: 0.022 });
    c.addPass(bokeh);
    c.addPass(new OutputPass());
    return { c, bloom, bokeh };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, world, W, H]);
  useEffect(() => () => composer.c.dispose(), [composer]);

  useFrame(() => {
    const { F, mode, mirror } = latest.current;
    const cs = cameraAt(F, mode, st, mirror);
    const u = composer.bokeh.uniforms as Record<string, THREE.IUniform<number>>;
    u.focus.value = cs.focus;
    u.aperture.value = cs.aperture;
    // Below this the blur is under a pixel: skip the pass.
    composer.bokeh.enabled = cs.aperture > 0.0003;
    composer.bloom.strength = latest.current.bloom * (1 + 0.5 * ramp(F, B4.check, B4.check + 8) * (1 - ramp(F, B4.check + 8, B4.check + 50)));
    composer.c.render();
  }, 1);

  return <primitive object={world.root} />;
};
