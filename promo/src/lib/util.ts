import { random, useVideoConfig } from 'remotion';

/** Hex (#RRGGBB) → rgba() with alpha. */
export const alpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
};

/** Deterministic random in [a, b). Never use Math.random() in a render. */
export const rr = (seed: string | number, a = 0, b = 1) => a + (b - a) * random(seed);

/**
 * Orientation-aware layout. Both outputs share a 1080 px short side, so `u`
 * is 1 for the shipped sizes; it keeps proportions if someone adds a square
 * or 4K composition later.
 */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  return { W: width, H: height, cx: width / 2, cy: height / 2, vertical, u };
};

export type Layout = ReturnType<typeof useLayout>;

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
