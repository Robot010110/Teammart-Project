/**
 * The 40 s master timeline. Pure (no React/Remotion imports) so the Node
 * scripts — the soundtrack generator and caption exporter — share it.
 */
import { TIMING } from '../config.ts';

export type SceneKey = 'chaos' | 'beat' | 'structure' | 'workflow' | 'dashboard' | 'close';

export const FPS = TIMING.fps;

export const SCENE_ORDER: SceneKey[] = ['chaos', 'beat', 'structure', 'workflow', 'dashboard', 'close'];

/**
 * The lengths the choreography was designed at. If TIMING.scenes changes a
 * length, every beat inside that scene is scaled by actual/design, so a
 * longer scene breathes more and a shorter one tightens — springs keep their snap.
 */
const DESIGN_SECONDS: Record<SceneKey, number> = {
  chaos: 6,
  beat: 3,
  structure: 7,
  workflow: 11,
  dashboard: 8,
  close: 5,
};

export type SceneRange = { start: number; dur: number; end: number };

export const SCENES: Record<SceneKey, SceneRange> = (() => {
  let start = 0;
  const out = {} as Record<SceneKey, SceneRange>;
  for (const key of SCENE_ORDER) {
    const dur = Math.round(TIMING.scenes[key] * FPS);
    out[key] = { start, dur, end: start + dur };
    start += dur;
  }
  return out;
})();

/** Length of the master in frames. */
export const MASTER_FRAMES = SCENES.close.end;

export type SceneClock = {
  /** Frames since this scene's nominal start (negative during pre-roll). */
  f: number;
  /** Absolute master frame. */
  abs: number;
  /**
   * Converts a beat authored in 60-fps frames, relative to the scene start,
   * into a local frame number — honouring both the fps and any scene stretch.
   * `at(90)` = "1.5 s into the scene" at the design length.
   */
  at: (frames60: number) => number;
  /** Converts a duration authored in 60-fps frames (not stretched). */
  len: (frames60: number) => number;
  range: SceneRange;
};

export const sceneClock = (key: SceneKey, abs: number): SceneClock => {
  const range = SCENES[key];
  const stretch = range.dur / (DESIGN_SECONDS[key] * FPS);
  return {
    f: abs - range.start,
    abs,
    at: (frames60) => (frames60 / 60) * FPS * stretch,
    len: (frames60) => (frames60 / 60) * FPS,
    range,
  };
};

/** Absolute master frame for a beat inside a scene. */
export const beatAt = (key: SceneKey, frames60: number) => SCENES[key].start + sceneClock(key, 0).at(frames60);
