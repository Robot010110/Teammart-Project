import React from 'react';
import { COLORS } from '../config';
import { useCopy } from '../i18n/copy';
import { FONT_STACK } from '../lib/fonts';
import { EASE, ramp, sp, SPRING } from '../lib/motion';
import { alpha } from '../lib/util';

/**
 * TeamMart mark: a "T" drawn as a tiny org chart — a junction node on a
 * bar with two end nodes, and a stem down to the team. It echoes the
 * Zone → Market → Employee graph the film is built around.
 *
 * `start` = frame the build begins. With start = -Infinity it renders fully built.
 */
const J = { x: 50, y: 37 }; // junction
const L = { x: 26, y: 37 };
const R = { x: 74, y: 37 };
const B = { x: 50, y: 75 };

export const LogoMark: React.FC<{ size: number; frame: number; start?: number; glow?: number }> = ({
  size,
  frame,
  start = -1e6,
  glow = 1,
}) => {
  // SFX: logo_build (crystalline) — container pop at `start`
  const box = sp(frame, start, SPRING.pop);
  const lineL = ramp(frame, start + 6, start + 20, 0, 1, EASE.out);
  const lineR = ramp(frame, start + 7.5, start + 21.5, 0, 1, EASE.out);
  const lineB = ramp(frame, start + 10, start + 25, 0, 1, EASE.out);
  const nJ = sp(frame, start + 4, SPRING.pop);
  const nL = sp(frame, start + 16, SPRING.pop);
  const nR = sp(frame, start + 18.5, SPRING.pop);
  const nB = sp(frame, start + 22, SPRING.pop);
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
    x2: a.x + (b.x - a.x) * t,
    y2: a.y + (b.y - a.y) * t,
  });
  const radius = size * 0.29;

  return (
    <div
      style={{
        width: size,
        height: size,
        transform: `scale(${box})`,
        borderRadius: radius,
        position: 'relative',
        background: `linear-gradient(150deg, #7FA0FF 0%, ${COLORS.accent} 42%, #2F4FCC 100%)`,
        boxShadow: [
          `inset 0 1.5px 0 rgba(255,255,255,0.45)`,
          `inset 0 -${size * 0.08}px ${size * 0.18}px rgba(10,20,80,0.35)`,
          `0 ${size * 0.18}px ${size * 0.5}px -${size * 0.1}px ${alpha(COLORS.accent, 0.55 * glow)}`,
          `0 0 ${size * 0.6}px ${alpha(COLORS.accent, 0.35 * glow)}`,
        ].join(', '),
      }}
    >
      {/* Glass sheen */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 48%)',
        }}
      />
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <g stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" fill="none">
          {lineL > 0 && <line x1={J.x} y1={J.y} {...seg(J, L, lineL)} />}
          {lineR > 0 && <line x1={J.x} y1={J.y} {...seg(J, R, lineR)} />}
          {lineB > 0 && <line x1={J.x} y1={J.y} {...seg(J, B, lineB)} />}
        </g>
        <g fill="#FFFFFF">
          <circle cx={L.x} cy={L.y} r={7 * nL} />
          <circle cx={R.x} cy={R.y} r={7 * nR} />
          <circle cx={B.x} cy={B.y} r={8 * nB} />
          <circle cx={J.x} cy={J.y} r={9.5 * nJ} />
        </g>
        <circle cx={J.x} cy={J.y} r={4.2 * nJ} fill={COLORS.accent} />
      </svg>
    </div>
  );
};

/** "TeamMart" with a per-letter rise. `start` = first letter. */
export const Wordmark: React.FC<{ size: number; frame: number; start?: number; gap?: number }> = ({
  size,
  frame,
  start = -1e6,
  gap = 2,
}) => {
  const [a, b] = useCopy().close.wordmark;
  const letters = [...a.split('').map((c) => ({ c, accent: false })), ...b.split('').map((c) => ({ c, accent: true }))];
  return (
    <div
      style={{
        display: 'flex',
        direction: 'ltr',
        fontFamily: FONT_STACK,
        fontWeight: 720,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: `${-0.045 + 0.02 * (1 - ramp(frame, start, start + 40))}em`,
        whiteSpace: 'pre',
      }}
    >
      {letters.map(({ c, accent }, i) => {
        // SFX: soft tick per letter (very low in the mix)
        const s = start + i * gap + ((i * 0.618) % 1) * 0.5;
        const p = sp(frame, s, SPRING.snap);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${(1 - p) * size * 0.5}px)`,
              opacity: Math.min(1, p * 1.6),
              filter: `blur(${Math.max(0, (1 - p) * 10)}px)`,
              color: accent ? undefined : COLORS.text,
              background: accent ? `linear-gradient(180deg, ${COLORS.accentSoft}, ${COLORS.accent})` : undefined,
              WebkitBackgroundClip: accent ? 'text' : undefined,
              WebkitTextFillColor: accent ? 'transparent' : undefined,
            }}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
};
