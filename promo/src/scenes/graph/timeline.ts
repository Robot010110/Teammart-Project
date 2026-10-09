import { Cam, lookAt, mixCam } from '../../lib/camera';
import { EASE, kf, mix, ramp } from '../../lib/motion';
import { sceneClock, SCENES } from '../../lib/timing';
import type { Layout } from '../../lib/util';
import { DEPTH, NODES, RM_ZONE, SUP_MARKET } from './model';

/**
 * Every beat of S3 STRUCTURE and S4 WORKFLOW in absolute frames, derived
 * from config TIMING (so stretching a scene moves its beats with it).
 * Numbers in at()/len() are 60-fps frames from the scene start (PLAN.md).
 */
const s3 = sceneClock('structure', 0);
const s4 = sceneClock('workflow', 0);
const s5 = sceneClock('dashboard', 0);
const T3 = SCENES.structure.start;
const T4 = SCENES.workflow.start;
const T5 = SCENES.dashboard.start;

export const G = {
  start: T3,
  // ── S3 STRUCTURE ────────────────────────────── SFX: bloom-whomp @ T3
  hqPop: T3 + s3.at(4),
  zones: T3 + s3.at(20), // SFX: tick-rise-3
  zoneGap: s3.len(6),
  zoneDraw: s3.len(24),
  markets: T3 + s3.at(80), // SFX: tick-cascade
  marketGap: s3.len(4.2),
  marketDraw: s3.len(20),
  employees: T3 + s3.at(150), // SFX: granular-shimmer
  employeeGap: s3.len(1.55),
  employeeDraw: s3.len(14),
  originShift: [T3 + s3.at(40), T3 + s3.at(150)] as const,
  admin: T3 + s3.at(260), // SFX: chime-1
  rm: T3 + s3.at(320), // SFX: chime-2
  sup: T3 + s3.at(380), // SFX: chime-3
  overlaysOut: T3 + s3.at(448),
  // ── S4 WORKFLOW ─────────────────────────────
  push: [T4 + s4.at(-20), T4 + s4.at(60)] as const, // SFX: push-whoosh
  cardIn: T4 + s4.at(40), // SFX: card-pop
  cardOut: T4 + s4.at(96),
  down: [T4 + s4.at(102), T4 + s4.at(150)] as const, // SFX: zip-down
  phoneIn: T4 + s4.at(152), // SFX: impact-rise
  notif: T4 + s4.at(192), // SFX: notification-chime
  notifOut: T4 + s4.at(220),
  detail: T4 + s4.at(222),
  tapStart: T4 + s4.at(254), // SFX: ui-tap
  photo: T4 + s4.at(284), // SFX: camera-shutter
  tapDone: T4 + s4.at(330), // SFX: ui-tap-positive
  lift: T4 + s4.at(380), // SFX: lift-swish
  phoneOut: T4 + s4.at(394),
  up: [T4 + s4.at(402), T4 + s4.at(452)] as const, // SFX: whoosh-up
  approveIn: T4 + s4.at(454),
  approveTap: T4 + s4.at(478), // SFX: ui-click
  check: T4 + s4.at(486), // SFX: approve-ding
  approvedText: T4 + s4.at(504),
  pull: [T4 + s4.at(546), T5 + s5.at(10)] as const, // SFX: whoosh-big-out
  bgFade: [T5 + s5.at(0), T5 + s5.at(56)] as const,
  end: T5 + s5.at(84),
  stepAt: (i: number) => [T4 + s4.at(-6), T4 + s4.at(150), T4 + s4.at(400)][i],
  stepsOut: T4 + s4.at(560),
  len: (n: number) => s4.len(n),
};

export type Shot = { cam: Cam; o: { x: number; y: number } };

const mixShot = (a: Shot, b: Shot, t: number): Shot => ({
  cam: mixCam(a.cam, b.cam, t),
  o: { x: mix(a.o.x, b.o.x, t), y: mix(a.o.y, b.o.y, t) },
});

/** Camera + screen origin of the graph at any absolute frame. */
export const cameraAt = (F: number, L: Layout): Shot => {
  const { cx, cy, vertical } = L;
  const rm = NODES[RM_ZONE];
  const sup = NODES[SUP_MARKET];

  // Structure: start tight on the bloom, pull out as each ring arrives, drift gently.
  const structShot = (f: number): Shot => {
    const z = kf(
      f,
      [
        [G.start, 2.55],
        [G.start + s3.at(34), 2.0],
        [G.start + s3.at(96), 1.46],
        [G.start + s3.at(168), 1.05],
        [G.start + s3.at(240), 1.0],
        [G.start + s3.at(470), vertical ? 0.975 : 0.93],
      ],
      EASE.smooth,
    );
    const shift = ramp(f, G.originShift[0], G.originShift[1], 0, 1, EASE.inOut);
    const target = vertical ? { x: cx, y: cy - 22 } : { x: cx + 236, y: cy + 4 };
    const driftIn = ramp(f, G.start + s3.at(120), G.start + s3.at(220), 0, 1, EASE.smooth);
    return {
      cam: { x: 16 * Math.sin(f * 0.011) * driftIn, y: 11 * Math.sin(f * 0.0083 + 1.2) * driftIn, zoom: z, rot: 0 },
      o: { x: mix(cx, target.x, shift), y: mix(cy, target.y, shift) },
    };
  };

  if (F <= G.push[0]) return structShot(F);

  const A = structShot(G.push[0]);
  const B: Shot = { cam: lookAt(rm.x, rm.y, DEPTH[1], 2.1, -1.2), o: vertical ? { x: cx, y: cy - 250 } : { x: cx + 120, y: cy - 170 } };
  const C: Shot = { cam: lookAt(sup.x, sup.y, DEPTH[2], 2.2, 0.6), o: vertical ? { x: cx, y: cy + 70 } : { x: cx + 120, y: cy + 110 } };
  const D: Shot = { cam: lookAt(sup.x, sup.y, DEPTH[2], 2.38, 0.2), o: C.o };
  const E: Shot = { cam: lookAt(rm.x, rm.y, DEPTH[1], 2.12, -0.5), o: vertical ? { x: cx, y: cy - 70 } : { x: cx + 70, y: cy - 40 } };
  const E2: Shot = { cam: lookAt(rm.x, rm.y, DEPTH[1], 2.26, 0), o: E.o };
  const Fs: Shot = { cam: { x: 0, y: 0, zoom: 0.5, rot: 0 }, o: { x: cx, y: cy } };
  const Gs: Shot = { cam: { x: 0, y: 0, zoom: 0.38, rot: 0 }, o: { x: cx, y: cy } };

  if (F <= G.push[1]) return mixShot(A, B, ramp(F, G.push[0], G.push[1], 0, 1, EASE.inOut));
  if (F <= G.down[0]) return B;
  if (F <= G.down[1]) return mixShot(B, C, ramp(F, G.down[0], G.down[1], 0, 1, EASE.inOut));
  if (F <= G.up[0]) return mixShot(C, D, ramp(F, G.down[1], G.up[0], 0, 1, EASE.smooth));
  if (F <= G.up[1]) return mixShot(D, E, ramp(F, G.up[0], G.up[1], 0, 1, EASE.inOut));
  if (F <= G.pull[0]) return mixShot(E, E2, ramp(F, G.up[1], G.pull[0], 0, 1, EASE.smooth));
  if (F <= G.pull[1]) return mixShot(E2, Fs, ramp(F, G.pull[0], G.pull[1], 0, 1, EASE.inOut));
  return mixShot(Fs, Gs, ramp(F, G.pull[1], G.end, 0, 1, EASE.out));
};

/** Depth of field: strength 0..1 and the parallax plane in focus. */
export const dofAt = (F: number) => {
  const strength = ramp(F, G.push[0], G.push[0] + G.len(50), 0, 1, EASE.smooth) * (1 - 0.7 * ramp(F, G.pull[0], G.pull[0] + G.len(40)));
  let focus: number = DEPTH[1];
  if (F > G.down[0] && F <= G.up[0]) focus = mix(DEPTH[1], DEPTH[2], ramp(F, G.down[0], G.down[1], 0, 1, EASE.inOut));
  if (F > G.up[0]) focus = mix(DEPTH[2], DEPTH[1], ramp(F, G.up[0], G.up[1], 0, 1, EASE.inOut));
  return { strength, focus };
};
