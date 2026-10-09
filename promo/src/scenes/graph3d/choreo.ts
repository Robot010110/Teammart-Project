import * as THREE from 'three';
import type { GNode, Structure } from '../../structure/model';
import { EASE, mix, ramp, sp, SPRING } from '../../lib/motion';
import type { LayoutMode } from '../../lib/util';
import { B3, B4 } from './beats';

/**
 * The 3D world as a pure function of the master frame: camera, node and
 * edge states, the scope sectors and the task packet. The renderer samples
 * it several times per frame (motion blur), and the DOM overlays use the
 * same camera to pin labels and phones to nodes — one source of truth.
 *
 * World: the org chart lies on the XZ plane, y up. Structure angle 90°
 * (the focus zone) faces +z, toward the camera at azimuth 0.
 */
export const WORLD_SCALE = 1 / 34;

export type V3 = [number, number, number];

export const nodePos = (n: GNode): V3 => [n.x * WORLD_SCALE, 0, n.y * WORLD_SCALE];

/** Edges arc gently upward; the lift grows with length. */
export const edgePoint = (a: V3, b: V3, t: number): V3 => {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const c: V3 = [(a[0] + b[0]) / 2, 0.16 * len, (a[2] + b[2]) / 2];
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]];
};

// ── Camera ──────────────────────────────────────────────────────────────

export type Shot = {
  target: V3;
  /** degrees around y; 0 = camera on +z */
  az: number;
  /** degrees above the disc */
  el: number;
  dist: number;
  /** principal-point shift in px of the output frame (+x right, +y down) */
  shift: { x: number; y: number };
};

export type CamState = Shot & { hfov: number; focus: number; aperture: number };

const mixShot = (a: Shot, b: Shot, t: number): Shot => ({
  target: [mix(a.target[0], b.target[0], t), mix(a.target[1], b.target[1], t), mix(a.target[2], b.target[2], t)],
  az: mix(a.az, b.az, t),
  el: mix(a.el, b.el, t),
  // Distance moves geometrically so pushes feel even to the eye.
  dist: a.dist * Math.pow(b.dist / a.dist, t),
  shift: { x: mix(a.shift.x, b.shift.x, t), y: mix(a.shift.y, b.shift.y, t) },
});

/** Where the graph sits in each format while the overlays share the frame. */
const FRAMING: Record<LayoutMode, { hfov: number; s3: { x: number; y: number }; s4: { x: number; y: number }; wide: number }> = {
  landscape: { hfov: 50, s3: { x: 290, y: 30 }, s4: { x: -60, y: 30 }, wide: 1 },
  portrait: { hfov: 50, s3: { x: 0, y: 150 }, s4: { x: 0, y: 40 }, wide: 1.32 },
  square: { hfov: 50, s3: { x: 150, y: 70 }, s4: { x: -30, y: 30 }, wide: 1.12 },
};

/** `mirror` flips the framing for right-to-left languages (overlays on the right). */
export const cameraAt = (F: number, mode: LayoutMode, st: Structure, mirror = false): CamState => {
  const fr = FRAMING[mode];
  const w = fr.wide;
  const zone = nodePos(st.nodes[st.focusZone]);
  const market = nodePos(st.nodes[st.focusMarket]);
  const emp = nodePos(st.nodes[st.focusEmployee]);
  const O: V3 = [0, 0, 0];
  const at = (p: V3, k: number): V3 => [p[0] * k, p[1] * k, p[2] * k];
  const s0 = { x: 0, y: 0 };

  // [frame, shot, easing into this key]
  const keys: [number, Shot, (t: number) => number][] = [
    [B3.hq - 20, { target: O, az: -34, el: 72, dist: 6.5, shift: s0 }, EASE.smooth],
    [B3.zones + 34, { target: O, az: -24, el: 60, dist: 17 * w, shift: s0 }, EASE.inOut],
    [B3.markets + 34, { target: O, az: -15, el: 50, dist: 27 * w, shift: { x: fr.s3.x * 0.5, y: fr.s3.y * 0.5 } }, EASE.smooth],
    [B3.employees + 60, { target: O, az: -6, el: 42, dist: 38 * w, shift: fr.s3 }, EASE.smooth],
    [B3.admin + 34, { target: O, az: -1, el: 39, dist: 39 * w, shift: fr.s3 }, EASE.smooth],
    [B3.rm + 30, { target: at(zone, 0.3), az: 4, el: 36, dist: 35 * w, shift: fr.s3 }, EASE.inOut],
    [B3.sup + 30, { target: at(market, 0.45), az: 9, el: 33, dist: 31 * w, shift: fr.s3 }, EASE.inOut],
    [B4.push[0], { target: at(market, 0.5), az: 11, el: 32, dist: 30 * w, shift: fr.s3 }, EASE.smooth],
    [B4.push[1], { target: market, az: 16, el: 23, dist: 10 * w, shift: fr.s4 }, EASE.inOut],
    [B4.down[0], { target: market, az: 19, el: 22, dist: 9.4 * w, shift: fr.s4 }, EASE.smooth],
    [B4.down[1], { target: emp, az: 23, el: 18, dist: 7.2 * w, shift: fr.s4 }, EASE.inOut],
    [B4.up[0], { target: emp, az: 26, el: 17, dist: 6.8 * w, shift: fr.s4 }, EASE.smooth],
    [B4.up[1], { target: market, az: 14, el: 25, dist: 9.8 * w, shift: fr.s4 }, EASE.inOut],
    [B4.toZone[0], { target: market, az: 11, el: 27, dist: 11 * w, shift: fr.s4 }, EASE.smooth],
    [B4.toHq[1], { target: at(market, 0.5), az: 5, el: 38, dist: 19 * w, shift: fr.s4 }, EASE.inOut],
    [B4.pull[1], { target: O, az: -8, el: 58, dist: 46 * w, shift: s0 }, EASE.inOut],
  ];

  let shot = keys[0][1];
  if (F >= keys[keys.length - 1][0]) shot = keys[keys.length - 1][1];
  else {
    for (let i = 1; i < keys.length; i++) {
      if (F < keys[i][0]) {
        const [fa, a] = keys[i - 1];
        const [fb, b, ease] = keys[i];
        shot = F <= fa ? a : mixShot(a, b, ease(Math.min(1, (F - fa) / (fb - fa))));
        break;
      }
    }
  }
  // A slow orbit underneath every move keeps the world alive.
  const drift = Math.sin((F - B3.start) * 0.0045) * 3.2;

  // Depth of field: the world drops out of focus while a phone is up.
  const phoneUp = Math.max(
    ...[B4.phoneA, B4.phoneB, B4.phoneC].map(([a, b]) => ramp(F, a, a + 26, 0, 1, EASE.smooth) * (1 - ramp(F, b - 18, b + 8, 0, 1, EASE.smooth))),
  );
  const aperture = 0.00012 + 0.0026 * phoneUp + 0.0004 * ramp(F, B4.pull[0], B4.pull[1]);
  const shift = { x: shot.shift.x * (mirror ? -1 : 1), y: shot.shift.y };

  return { ...shot, shift, az: shot.az + drift, hfov: fr.hfov, focus: shot.dist, aperture };
};

/** A three.js camera for a state — shared by the renderer and the overlays. */
export const applyCamera = (cam: THREE.PerspectiveCamera, s: CamState, W: number, H: number) => {
  const az = (s.az * Math.PI) / 180;
  const el = (s.el * Math.PI) / 180;
  const [tx, ty, tz] = s.target;
  cam.position.set(tx + s.dist * Math.sin(az) * Math.cos(el), ty + s.dist * Math.sin(el), tz + s.dist * Math.cos(az) * Math.cos(el));
  cam.up.set(0, 1, 0);
  cam.lookAt(tx, ty, tz);
  cam.aspect = W / H;
  cam.fov = (2 * Math.atan(Math.tan((s.hfov * Math.PI) / 360) / cam.aspect) * 180) / Math.PI;
  cam.near = 0.1;
  cam.far = 400;
  cam.setViewOffset(W, H, -s.shift.x, -s.shift.y, W, H);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
};

/** Screen position (px) and depth of a world point; `visible` false when behind the camera. */
export const projectPoint = (cam: THREE.PerspectiveCamera, p: V3, W: number, H: number) => {
  const v = new THREE.Vector3(p[0], p[1], p[2]).project(cam);
  const depth = cam.position.distanceTo(new THREE.Vector3(p[0], p[1], p[2]));
  return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, depth, visible: v.z < 1 };
};

// ── Build: when every node and edge arrives ─────────────────────────────

/** Start frame of the edge that grows into node `n` (the HQ has none). */
export const arrival = (n: GNode) => {
  if (n.level === 0) return B3.hq;
  if (n.level === 1) return B3.zones + n.order * B3.zoneGap;
  if (n.level === 2) return B3.markets + n.order * B3.marketGap;
  return B3.employees + n.order * B3.employeeGap;
};

export const drawLength = (n: GNode) => [0, B3.zoneDraw, B3.marketDraw, B3.employeeDraw][n.level];

/** Edge growth 0..1 for the edge into `n`. */
export const edgeGrowth = (F: number, n: GNode) => ramp(F, arrival(n), arrival(n) + drawLength(n), 0, 1, EASE.out);

/** Node pop 0..~1.1 (spring), once its edge has landed. */
export const nodePop = (F: number, n: GNode) => (n.level === 0 ? sp(F, B3.hq, SPRING.pop) : sp(F, arrival(n) + drawLength(n) * 0.72, SPRING.pop));

// ── Scope: which part of the org is "lit" ───────────────────────────────

export type ScopeKey = 'admin' | 'rm' | 'sup';

/** Opacity of each role's sector on the disc. */
export const scopeSectors = (F: number): Record<ScopeKey, number> => {
  const win = (a: number, b: number) => ramp(F, a, a + 16, 0, 1, EASE.out) * (1 - ramp(F, b, b + 18, 0, 1, EASE.smooth));
  return {
    admin: win(B3.admin, B3.rm),
    rm: win(B3.rm, B3.sup),
    sup: win(B3.sup, B4.push[1]),
  };
};

/** How lit a node is (1 = full) given the current scope and workflow. */
export const nodeLight = (F: number, n: GNode, st: Structure) => {
  const fz = st.nodes[st.focusZone].zone;
  const fm = st.nodes[st.focusMarket].market;
  const inZone = n.zone === fz || n.level === 0;
  const inMarket = n.market === fm || n.idx === st.focusZone || n.level === 0;
  const zoneDim = ramp(F, B3.rm, B3.rm + 20) * (1 - ramp(F, B4.pull[0], B4.pull[1]));
  const marketDim = ramp(F, B3.sup, B3.sup + 20) * (1 - ramp(F, B4.toZone[0], B4.toHq[1]));
  let lit = 1;
  if (!inZone) lit *= 1 - 0.68 * zoneDim;
  if (!inMarket) lit *= 1 - 0.45 * marketDim;
  return lit;
};

// ── The task packet ─────────────────────────────────────────────────────

export type Packet = { pos: V3; on: number; t: number };

export const packetAt = (F: number, st: Structure): Packet | null => {
  const P = (i: number) => nodePos(st.nodes[i]);
  const legs: [readonly [number, number], V3, V3][] = [
    [B4.down, P(st.focusMarket), P(st.focusEmployee)],
    [B4.up, P(st.focusEmployee), P(st.focusMarket)],
    [B4.toZone, P(st.focusMarket), P(st.focusZone)],
    [B4.toHq, P(st.focusZone), P(st.hq)],
  ];
  for (const [[a, b], from, to] of legs) {
    if (F >= a - 4 && F <= b + 6) {
      const t = ramp(F, a, b, 0, 1, EASE.inOut);
      // Edges are stored parent → child; walk the same arc either way.
      const pos = edgePoint(from, to, t);
      const on = ramp(F, a - 4, a + 2) * (1 - ramp(F, b, b + 6));
      return { pos, on, t };
    }
  }
  return null;
};

/** Ring pulses: [node index, start frame]. */
export const pulses = (st: Structure): [number, number][] => [
  [st.focusEmployee, B4.down[1] - 2],
  [st.focusMarket, B4.up[1] - 2],
  [st.focusMarket, B4.check],
  [st.focusZone, B4.toZone[1] - 2],
  [st.hq, B4.toHq[1] - 2],
];
