/**
 * Edits: every cut of the film is a list of shots taken from the 40 s
 * master, each with its own playback speed. The 40 s film is a single shot;
 * the 15 s and 6 s social cutdowns re-time pieces of it (speed ramps
 * included), so they inherit every frame of polish from the master.
 *
 * Pure module — shared with the soundtrack generator and caption exporter.
 * Shot lengths are chosen so cuts land on the 120 BPM score's beat grid
 * (30 frames = one beat at 60 fps).
 */
import { MASTER_FRAMES } from './master.ts';

export type EditId = 'full' | 'cut15' | 'cut6';

export type Shot = {
  /** Master frame range [from, to). */
  from: number;
  to: number;
  /** Playback speed (1 = real time, 1.5 = 50 % faster). */
  speed: number;
  /** How this shot arrives: hard cut, or a quick light flash. */
  enter?: 'cut' | 'flash';
};

export type Edit = {
  id: EditId;
  label: string;
  shots: Shot[];
  /** Output length in frames. */
  frames: number;
};

const shotFrames = (s: Shot) => Math.round((s.to - s.from) / s.speed);

const makeEdit = (id: EditId, label: string, shots: Shot[]): Edit => ({
  id,
  label,
  shots,
  frames: shots.reduce((n, s) => n + shotFrames(s), 0),
});

export const EDITS: Record<EditId, Edit> = {
  full: makeEdit('full', '40 s', [{ from: 0, to: MASTER_FRAMES, speed: 1 }]),

  // 15 s = 900 frames = 30 beats.
  cut15: makeEdit('cut15', '15 s', [
    { from: 20, to: 335, speed: 1.75 }, // chaos, accelerated: 180 f
    { from: 380, to: 530, speed: 1 }, // freeze → snap → "What if every market ran like one team?": 150 f
    { from: 600, to: 900, speed: 2, enter: 'flash' }, // 3D hierarchy builds, role scopes light up: 150 f
    { from: 1218, to: 1398, speed: 1 }, // real app: the employee completes the task with a photo: 180 f
    { from: 1530, to: 1590, speed: 1 }, // approved, visible to zone and HQ: 60 f
    { from: 1950, to: 2040, speed: 1.5, enter: 'flash' }, // real product: 60 f
    { from: 2110, to: 2380, speed: 2.25 }, // close: 120 f
  ]),

  // 6 s = 360 frames = 12 beats.
  cut6: makeEdit('cut6', '6 s', [
    { from: 150, to: 345, speed: 1.625 }, // chaos peak: 120 f
    { from: 360, to: 420, speed: 1 }, // freeze → snap into the light: 60 f
    { from: 1950, to: 2040, speed: 1.5, enter: 'flash' }, // real product: 60 f
    { from: 2125, to: 2395, speed: 2.25 }, // logo, tagline, CTA: 120 f
  ]),
};

export type EditTime = {
  /** Master frame (fractional when a shot is sped up). */
  master: number;
  /** Master frames advanced per output frame (= the shot's speed). */
  step: number;
  shot: number;
  /** Output frames since this shot started. */
  local: number;
};

export const editTime = (edit: Edit, out: number): EditTime => {
  let start = 0;
  for (let i = 0; i < edit.shots.length; i++) {
    const s = edit.shots[i];
    const n = shotFrames(s);
    if (out < start + n || i === edit.shots.length - 1) {
      const local = out - start;
      return { master: Math.min(s.to - 0.001, s.from + local * s.speed), step: s.speed, shot: i, local };
    }
    start += n;
  }
  return { master: 0, step: 1, shot: 0, local: out };
};

/** Output frame where shot i starts. */
export const shotStart = (edit: Edit, i: number) => edit.shots.slice(0, i).reduce((n, s) => n + shotFrames(s), 0);

/** Where a master frame appears in an edit (null if it was cut out). */
export const masterToOutput = (edit: Edit, master: number): number | null => {
  let start = 0;
  for (const s of edit.shots) {
    if (master >= s.from && master < s.to) return start + (master - s.from) / s.speed;
    start += shotFrames(s);
  }
  return null;
};
