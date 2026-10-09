import { noise2D } from '@remotion/noise';
import { random } from 'remotion';
import type { Copy } from '../../config';
import { castList, type ChaosKind } from './cast';

export type { ChaosKind };

/**
 * Deterministic chaos simulation, precomputed once per frame size.
 *
 * Every element flies in from off-screen, then drifts, jitters (simplex
 * noise that grows as the chaos builds), collides (AABB, mass-weighted,
 * restitution 0.7) and bounces off soft walls. Front-layer elements ignore
 * the walls and pass the lens. The result is a per-frame state table, so any
 * frame can be rendered in isolation — which Remotion's parallel renderer
 * requires — and the velocities for motion blur come for free.
 */

export type ChaosItem = {
  id: number;
  kind: ChaosKind;
  text: string;
  /** 0 = back, 1 = mid, 2 = front */
  layer: 0 | 1 | 2;
  w: number;
  h: number;
  enter: number;
  variant: number;
};

export const LAYERS = [
  { p: 0.6, scale: 0.66, blur: 3.4, opacity: 0.5 },
  { p: 1, scale: 1, blur: 0, opacity: 1 },
  { p: 1.6, scale: 1.55, blur: 11, opacity: 0.85 },
] as const;

/** Frames simulated (the freeze happens on the first frame after this). */
export const SIM_FRAMES = 360;

const chars = (s: string, size: number) => s.length * size * 0.54;

const sizeOf = (kind: ChaosKind, text: string): { w: number; h: number } => {
  switch (kind) {
    case 'hero':
      return { w: Math.round(118 + Math.min(chars(text, 27), 380)), h: 104 };
    case 'bubble': {
      const tw = chars(text, 21);
      const lines = Math.max(1, Math.ceil(tw / 290));
      return { w: Math.round(96 + Math.min(tw, 300)), h: 56 + lines * 27 };
    }
    case 'note':
      return { w: 178, h: 168 };
    case 'sheet':
      return { w: 344, h: 168 };
    case 'missed':
      return { w: Math.round(110 + chars(text, 19)), h: 64 };
    case 'counter':
      return { w: 268, h: 88 };
    case 'email':
      return { w: Math.round(Math.min(560, 120 + chars(text, 19))), h: 86 };
    case 'badge':
      return text.length > 2 ? { w: 96, h: 64 } : { w: 68, h: 68 };
    case 'misc':
      return { w: Math.round(84 + chars(text, 20)), h: 58 };
  }
};



export type ChaosState = { x: Float32Array; y: Float32Array; rot: Float32Array; impact: Float32Array };

export type ChaosSim = { items: ChaosItem[]; states: ChaosState[] };

const cache = new Map<string, ChaosSim>();

/** `chaos` is the active language's copy — text lengths size the bodies. */
export const getChaosSim = (W: number, H: number, chaos: Copy['chaos']): ChaosSim => {
  const key = `${W}x${H}:${chaos.hero}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const items: ChaosItem[] = castList(chaos).map(([kind, text, layer, enter], id) => ({
    id,
    kind,
    text,
    layer,
    enter,
    variant: Math.floor(random(`var${id}`) * 4),
    ...sizeOf(kind, text),
  }));

  const n = items.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const rot = new Float64Array(n);
  const vr = new Float64Array(n);
  const impact = new Float64Array(n);
  const active = new Uint8Array(n);
  const inside = new Uint8Array(n);
  const mass = items.map((it) => (it.w * it.h) / 10000);

  // Spawn off-screen on a ring around the frame, aimed at a target inside it.
  items.forEach((it, i) => {
    const L = LAYERS[it.layer];
    const halfW = W / 2 / L.scale;
    const halfH = H / 2 / L.scale;
    if (it.kind === 'hero') {
      x[i] = 0;
      y[i] = -20;
      rot[i] = -2;
      return;
    }
    // Angles are spread with the golden angle so entries come from every side.
    const ang = i * 2.39996 + random(`ang${i}`) * 0.6;
    const sx = Math.cos(ang) * (halfW + it.w * 0.8 + 120);
    const sy = Math.sin(ang) * (halfH + it.h * 0.8 + 120);
    let tx: number;
    let ty: number;
    if (it.layer === 2) {
      // Pass the lens: aim across and out the other side.
      tx = -sx * 1.15;
      ty = -sy * 0.6 + (random(`fty${i}`) - 0.5) * halfH;
    } else {
      tx = (random(`tx${i}`) * 2 - 1) * (halfW - it.w / 2 - 50);
      ty = (random(`ty${i}`) * 2 - 1) * (halfH - it.h / 2 - 40);
    }
    x[i] = sx;
    y[i] = sy;
    // Coast to the target under the entry drag (0.92/frame ⇒ travel = v0 / 0.08).
    const drag = it.layer === 2 ? 0.985 : 0.92;
    vx[i] = (tx - sx) * (1 - drag);
    vy[i] = (ty - sy) * (1 - drag);
    rot[i] = (random(`r${i}`) - 0.5) * 18;
    vr[i] = (random(`vr${i}`) - 0.5) * 3;
  });

  const states: ChaosState[] = [];
  for (let f = 0; f < SIM_FRAMES; f++) {
    const intensity = Math.min(1, Math.max(0, (f - 50) / 280));
    for (let i = 0; i < n; i++) {
      const it = items[i];
      if (f < it.enter) continue;
      if (!active[i]) active[i] = 1;
      const age = f - it.enter;
      const L = LAYERS[it.layer];
      const halfW = W / 2 / L.scale;
      const halfH = H / 2 / L.scale;

      // Drag: fast entry that settles into a nervous drift.
      const drag = it.layer === 2 ? 0.992 : age < 26 ? 0.92 : 0.962;
      vx[i] *= drag;
      vy[i] *= drag;

      // Jitter grows with the chaos.
      if (it.layer !== 2) {
        const j = (0.06 + 0.3 * intensity) * (it.kind === 'hero' ? 0.6 : 1);
        vx[i] += noise2D(`jx${i}`, f * 0.045, i) * j;
        vy[i] += noise2D(`jy${i}`, i, f * 0.045) * j;
      }
      vr[i] += noise2D(`jr${i}`, f * 0.05, i * 2) * 0.05;
      vr[i] *= 0.95;

      // Soft walls once an element has made it on screen.
      if (it.layer !== 2) {
        const bx = halfW - it.w / 2 - 24;
        const by = halfH - it.h / 2 - 20;
        if (Math.abs(x[i]) < bx && Math.abs(y[i]) < by) inside[i] = 1;
        if (inside[i]) {
          if (x[i] > bx) vx[i] -= (x[i] - bx) * 0.08;
          if (x[i] < -bx) vx[i] += (-bx - x[i]) * 0.08;
          if (y[i] > by) vy[i] -= (y[i] - by) * 0.08;
          if (y[i] < -by) vy[i] += (-by - y[i]) * 0.08;
        }
      }

      x[i] += vx[i];
      y[i] += vy[i];
      rot[i] = Math.max(-15, Math.min(15, rot[i] + vr[i]));
      impact[i] *= 0.84;
    }

    // Collisions within the same layer (AABB, resolve along least penetration).
    for (let a = 0; a < n; a++) {
      if (!active[a] || items[a].layer === 2) continue;
      for (let b = a + 1; b < n; b++) {
        if (!active[b] || items[b].layer !== items[a].layer) continue;
        const dx = x[b] - x[a];
        const dy = y[b] - y[a];
        const px = (items[a].w + items[b].w) / 2 - Math.abs(dx);
        const py = (items[a].h + items[b].h) / 2 - Math.abs(dy);
        if (px <= 0 || py <= 0) continue;
        const ma = mass[a];
        const mb = mass[b];
        const inv = 1 / (ma + mb);
        const e = 0.7;
        if (px < py) {
          const s = dx >= 0 ? 1 : -1;
          x[a] -= s * px * mb * inv;
          x[b] += s * px * ma * inv;
          const rel = (vx[b] - vx[a]) * s;
          if (rel < 0) {
            const jImp = -(1 + e) * rel * ma * mb * inv;
            vx[a] -= (s * jImp) / ma;
            vx[b] += (s * jImp) / mb;
            vr[a] += rel * 0.15;
            vr[b] -= rel * 0.15;
            impact[a] = Math.max(impact[a], Math.min(1, -rel / 7));
            impact[b] = Math.max(impact[b], Math.min(1, -rel / 7));
          }
        } else {
          const s = dy >= 0 ? 1 : -1;
          y[a] -= s * py * mb * inv;
          y[b] += s * py * ma * inv;
          const rel = (vy[b] - vy[a]) * s;
          if (rel < 0) {
            const jImp = -(1 + e) * rel * ma * mb * inv;
            vy[a] -= (s * jImp) / ma;
            vy[b] += (s * jImp) / mb;
            vr[a] -= rel * 0.15;
            vr[b] += rel * 0.15;
            impact[a] = Math.max(impact[a], Math.min(1, -rel / 7));
            impact[b] = Math.max(impact[b], Math.min(1, -rel / 7));
          }
        }
      }
    }

    states.push({
      x: Float32Array.from(x),
      y: Float32Array.from(y),
      rot: Float32Array.from(rot),
      impact: Float32Array.from(impact),
    });
  }

  const sim = { items, states };
  cache.set(key, sim);
  return sim;
};

/**
 * The snap: order elements by distance from center (farthest first) and give
 * each a unique sub-frame start so arrivals ripple into the point of light.
 */
export const snapSchedule = (sim: ChaosSim, snapStart: number, spread: number) => {
  const last = sim.states[SIM_FRAMES - 1];
  const order = sim.items
    .map((it, i) => ({ i, d: Math.hypot(last.x[i] * LAYERS[it.layer].scale, last.y[i] * LAYERS[it.layer].scale) }))
    .sort((a, b) => b.d - a.d);
  const starts = new Array<number>(sim.items.length);
  order.forEach((o, rank) => {
    starts[o.i] = snapStart + (rank / order.length) * spread + ((rank * 0.618) % 1) * 0.4;
  });
  return starts;
};
