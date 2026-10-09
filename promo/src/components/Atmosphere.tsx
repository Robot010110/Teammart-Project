import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { useAbsoluteFrame } from '../lib/timing';
import { noise2D } from '@remotion/noise';
import { COLORS, LOOK } from '../config';
import { alpha, rr, useLayout } from '../lib/util';

/**
 * Base canvas: near-black with slow-drifting light. `accent` and `warm`
 * (0..1) let each scene steer the mood — warm builds during the chaos,
 * accent takes over from the beat onwards.
 */
export const Background: React.FC<{ accent: number; warm: number; lift?: number }> = ({ accent, warm, lift = 0 }) => {
  const frame = useAbsoluteFrame();
  const { W, H, cx, cy, vertical } = useLayout();
  const big = Math.max(W, H) * 1.15;
  const d1x = noise2D('bg1x', frame * 0.004, 0) * W * 0.08;
  const d1y = noise2D('bg1y', 0, frame * 0.004) * H * 0.06;
  const d2x = noise2D('bg2x', frame * 0.005, 5) * W * 0.1;
  const d2y = noise2D('bg2y', 5, frame * 0.005) * H * 0.08;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, overflow: 'hidden' }}>
      {/* Top key light — the "Linear" sheen. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${vertical ? '90% 38%' : '70% 55%'} at 50% -8%, ${alpha(COLORS.accent, 0.1 + 0.1 * accent)}, transparent 70%)`,
        }}
      />
      {/* Accent bloom, drifting. */}
      <div
        style={{
          position: 'absolute',
          width: big,
          height: big,
          left: cx - big / 2 + d1x,
          top: cy - big / 2 + d1y + H * 0.08,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(COLORS.accent, 0.12 * accent + 0.03)} 0%, ${alpha(COLORS.accent, 0.04 * accent)} 32%, transparent 62%)`,
        }}
      />
      {/* Warm alarm bloom (chaos). */}
      <div
        style={{
          position: 'absolute',
          width: big * 0.9,
          height: big * 0.9,
          left: cx - big * 0.45 + d2x + W * 0.12,
          top: cy - big * 0.45 + d2y + H * 0.1,
          borderRadius: '50%',
          opacity: warm,
          background: `radial-gradient(circle, ${alpha(COLORS.warm, 0.16)} 0%, ${alpha(COLORS.danger, 0.05)} 38%, transparent 64%)`,
        }}
      />
      {lift > 0 && <AbsoluteFill style={{ background: alpha('#FFFFFF', lift) }} />}
    </AbsoluteFill>
  );
};

/** Floating dust on a deep parallax plane; soft enough to read as defocused. */
export const Dust: React.FC<{ camX?: number; camY?: number; opacity?: number; count?: number }> = ({
  camX = 0,
  camY = 0,
  opacity = 1,
  count = 34,
}) => {
  const frame = useAbsoluteFrame();
  const { W, H } = useLayout();
  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => {
        const depth = rr(`dz${i}`, 0.15, 0.55);
        const size = rr(`ds${i}`, 3, 14) * (1 + depth);
        const x = rr(`dx${i}`, -0.1, 1.1) * W + noise2D(`dnx${i}`, frame * 0.003, i) * 60 - camX * depth;
        // Noise-only drift (no constant-velocity motion anywhere in the film).
        const yy = rr(`dy${i}`, -0.1, 1.1) * H + noise2D(`dny${i}`, i, frame * 0.003) * 90 - camY * depth;
        const tw = 0.55 + 0.45 * noise2D(`dt${i}`, frame * 0.02, i * 3);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: yy,
              width: size,
              height: size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(i % 5 === 0 ? COLORS.warm : COLORS.accentSoft, 0.55)} 0%, transparent 70%)`,
              opacity: 0.08 + 0.14 * tw,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Tiles are 384 px; drawn at 2× for a filmic grain size that survives H.264. */
const TILE = 768;

/**
 * Animated film grain: deterministic Gaussian noise tiles (public/grain),
 * re-picked and re-offset every frame, blended as overlay so it lives in
 * the mid-tones like real grain instead of greying the blacks.
 */
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H } = useLayout();
  if (LOOK.grain <= 0) return null;
  const tile = (frame % 4) + 1;
  const ox = Math.floor(rr(`gx${frame}`, 0, TILE));
  const oy = Math.floor(rr(`gy${frame}`, 0, TILE));
  const cols = Math.ceil(W / TILE) + 1;
  const rows = Math.ceil(H / TILE) + 1;
  const src = staticFile(`grain/grain-${tile}.png`);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: -ox,
          top: -oy,
          width: cols * TILE,
          height: rows * TILE,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${TILE}px)`,
          opacity: Math.min(1, LOOK.grain * 4.5),
          mixBlendMode: 'overlay',
        }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => (
          <Img key={i} src={src} style={{ width: TILE, height: TILE, display: 'block' }} />
        ))}
      </div>
      {/* A whisper of straight grain on top so it still reads in the deepest blacks. */}
      <div
        style={{
          position: 'absolute',
          left: -((ox * 7) % TILE),
          top: -((oy * 3) % TILE),
          width: cols * TILE,
          height: rows * TILE,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${TILE}px)`,
          opacity: LOOK.grain * 0.35,
        }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => (
          <Img key={i} src={staticFile(`grain/grain-${((tile + 1) % 4) + 1}.png`)} style={{ width: TILE, height: TILE, display: 'block' }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => {
  const { vertical } = useLayout();
  if (LOOK.vignette <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(ellipse ${vertical ? '95% 75%' : '80% 85%'} at 50% 48%, transparent 52%, rgba(0,0,0,${0.55 * LOOK.vignette}) 100%)`,
      }}
    />
  );
};
