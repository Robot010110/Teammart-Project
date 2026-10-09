/**
 * Every beat of S3 STRUCTURE and S4 WORKFLOW in absolute master frames.
 * Numbers inside at()/len() are 60-fps frames from the scene start at the
 * design lengths (7 s and 11 s); stretching a scene in config moves them.
 *
 * Pure module: the soundtrack generator reads it too, so every sound lands
 * on the frame its picture does.
 */
import { sceneClock, SCENES } from '../../timeline/master.ts';

const s3 = sceneClock('structure', 0);
const s4 = sceneClock('workflow', 0);
const s5 = sceneClock('dashboard', 0);
const T3 = SCENES.structure.start;
const T4 = SCENES.workflow.start;
const T5 = SCENES.dashboard.start;

export const B3 = {
  start: T3,
  hq: T3 + s3.at(0), // SFX: bloom-whomp
  zones: T3 + s3.at(24), // SFX: tick ×zones
  zoneGap: s3.len(7),
  zoneDraw: s3.len(22),
  markets: T3 + s3.at(70), // SFX: tick cascade
  marketGap: s3.len(3.4),
  marketDraw: s3.len(18),
  employees: T3 + s3.at(122), // SFX: granular shimmer
  employeeGap: s3.len(1.05),
  employeeDraw: s3.len(14),
  /** HQ leaves dead centre for the composed framing. */
  reframe: [T3 + s3.at(30), T3 + s3.at(150)] as const,
  admin: T3 + s3.at(212), // SFX: role chime 1
  rm: T3 + s3.at(266), // SFX: role chime 2
  sup: T3 + s3.at(320), // SFX: role chime 3
  overlaysOut: T3 + s3.at(388),
};

export const B4 = {
  start: T4,
  push: [T4 + s4.at(-26), T4 + s4.at(48)] as const, // SFX: push whoosh
  step: [T4 + s4.at(-6), T4 + s4.at(238), T4 + s4.at(466)] as const,
  /** Phones: [in, out]. Each plays a real screen recording. */
  phoneA: [T4 + s4.at(24), T4 + s4.at(214)] as const, // Supervisor assigns
  phoneB: [T4 + s4.at(256), T4 + s4.at(440)] as const, // Employee completes
  phoneC: [T4 + s4.at(476), T4 + s4.at(598)] as const, // Supervisor approves
  /** The task travels: market → employee, back, then up to zone and HQ. */
  down: [T4 + s4.at(206), T4 + s4.at(258)] as const, // SFX: zip down
  up: [T4 + s4.at(432), T4 + s4.at(480)] as const, // SFX: zip up
  check: T4 + s4.at(594), // SFX: approve ding
  approvedText: T4 + s4.at(602),
  toZone: [T4 + s4.at(608), T4 + s4.at(634)] as const, // SFX: rise
  toHq: [T4 + s4.at(630), T4 + s4.at(656)] as const,
  stepsOut: T4 + s4.at(652),
  pull: [T4 + s4.at(646), T5 + s5.at(40)] as const, // SFX: big whoosh out
  fade: [T5 + s5.at(0), T5 + s5.at(48)] as const,
  end: T5 + s5.at(52),
  len: (n: number) => s4.len(n),
};

/** First and last master frame the 3D world is on screen. */
export const GRAPH_WINDOW = [T3 - 6, B4.end] as const;
