import { random, useVideoConfig } from 'remotion';

/** Hex (#RRGGBB) → rgba() with alpha. */
export const alpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
};

/** Deterministic random in [a, b). Never use Math.random() in a render. */
export const rr = (seed: string | number, a = 0, b = 1) => a + (b - a) * random(seed);

export type LayoutMode = 'landscape' | 'portrait' | 'square';

/**
 * Layout mode for the current composition: 16:9 → landscape, 9:16 →
 * portrait, 1:1 → square. Scenes branch on `mode` (or `pick({...})`).
 * `vertical` is kept as shorthand for portrait.
 */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const mode: LayoutMode = width > height * 1.2 ? 'landscape' : height > width * 1.2 ? 'portrait' : 'square';
  const pick = <T,>(o: Record<LayoutMode, T>): T => o[mode];
  return {
    W: width,
    H: height,
    cx: width / 2,
    cy: height / 2,
    mode,
    pick,
    vertical: mode === 'portrait',
    square: mode === 'square',
    landscape: mode === 'landscape',
  };
};

export type Layout = ReturnType<typeof useLayout>;

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
