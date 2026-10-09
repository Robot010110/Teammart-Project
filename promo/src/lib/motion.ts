import { Easing, interpolate, measureSpring, spring, SpringConfig } from 'remotion';
import { FPS } from './timing';

/**
 * Motion language: confident and snappy, slight overshoot, nothing linear,
 * nothing floaty. Low mass + high stiffness = fast attack; damping tuned so
 * overshoot stays ~4–12% and everything settles inside ~0.5 s.
 */
export const SPRING = {
  /** Default UI entrance: quick, ~6% overshoot. */
  snap: { damping: 15, stiffness: 220, mass: 0.7 },
  /** Nodes, badges, check marks: punchier overshoot. */
  pop: { damping: 11, stiffness: 200, mass: 0.6 },
  /** Text and settling moves: barely overshoots. */
  settle: { damping: 20, stiffness: 170, mass: 0.8 },
  /** Big objects (phone, dashboard frame): weight without float. */
  heavy: { damping: 19, stiffness: 120, mass: 1.1 },
  /** Camera: critically damped, no overshoot. */
  camera: { damping: 32, stiffness: 70, mass: 1 },
} satisfies Record<string, Partial<SpringConfig>>;

export type SpringPreset = (typeof SPRING)[keyof typeof SPRING];

const settleCache = new Map<SpringPreset, number>();
const settleFrames = (cfg: SpringPreset) => {
  let n = settleCache.get(cfg);
  if (n === undefined) {
    n = Math.ceil(measureSpring({ fps: FPS, config: cfg, threshold: 0.0015 })) + 2;
    settleCache.set(cfg, n);
  }
  return n;
};

/**
 * spring() from `start` (fractional starts allowed — that is how hundreds of
 * elements get unique offsets). Time is quantised to ¼ frame and clamped at
 * the spring's settle time so Remotion's internal spring cache stays small
 * across a 2,400-frame render.
 */
export const sp = (frame: number, start: number, cfg: SpringPreset = SPRING.snap, from = 0, to = 1) => {
  const t = Math.min(Math.max(0, Math.round((frame - start) * 4) / 4), settleFrames(cfg));
  return spring({ frame: t, fps: FPS, config: cfg, from, to });
};

export const EASE = {
  /** Expo-like out: fast attack, soft landing. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Expo-like in: accelerates into an impact. */
  in: Easing.bezier(0.7, 0, 0.84, 0),
  /** Camera push: strong in-out. */
  inOut: Easing.bezier(0.83, 0, 0.17, 1),
  /** Gentle in-out for drifts. */
  smooth: Easing.bezier(0.45, 0, 0.25, 1),
  /** Quick anticipation then release. */
  whip: Easing.bezier(0.6, -0.28, 0.2, 1.1),
};

/** Clamped interpolate() with easing — the workhorse for non-spring moves. */
export const ramp = (frame: number, a: number, b: number, from = 0, to = 1, ease: (t: number) => number = EASE.out) =>
  interpolate(frame, [a, b], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0 → 1 → 0 bump between a and b, peaking at `peak` (0..1 of the span). */
export const pulse = (frame: number, a: number, b: number, peak = 0.35) => {
  if (frame <= a || frame >= b) return 0;
  const p = (frame - a) / (b - a);
  return p < peak ? EASE.out(p / peak) : 1 - EASE.smooth((p - peak) / (1 - peak));
};

/**
 * Unique stagger: start frame for element i. A golden-ratio sub-frame offset
 * guarantees no two elements ever share a start frame, even when `gap` is
 * a whole number of frames.
 */
export const stagger = (base: number, i: number, gap: number) => base + i * gap + ((i * 0.6180339887) % 1) * 0.5;

/** Multi-keyframe interpolate() with easing applied per segment. Keys must be strictly increasing in time. */
export const kf = (frame: number, keys: ReadonlyArray<readonly [number, number]>, ease: (t: number) => number = EASE.smooth) => {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (frame <= keys[i][0]) {
      return interpolate(frame, [keys[i - 1][0], keys[i][0]], [keys[i - 1][1], keys[i][1]], {
        easing: ease,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }
  return keys[keys.length - 1][1];
};
