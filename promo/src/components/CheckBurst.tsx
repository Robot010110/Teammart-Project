import React from 'react';
import { COLORS } from '../config';
import { EASE, ramp, sp, SPRING } from '../lib/motion';
import { alpha, rr } from '../lib/util';

/**
 * The approval moment: ring draws on, disc pops, check mark strokes in with
 * overshoot, two ripples and a staggered particle burst. Centered on (0,0)
 * of its parent.
 */
export const CheckBurst: React.FC<{ frame: number; start: number; size: number; color?: string }> = ({
  frame,
  start,
  size,
  color = COLORS.accent,
}) => {
  const f = frame;
  // SFX: approve_ding — bright confirmation + soft sub thump at `start + 10`
  const ring = ramp(f, start, start + 16, 0, 1, EASE.out);
  const disc = sp(f, start + 6, SPRING.pop);
  const check = ramp(f, start + 12, start + 27, 0, 1, EASE.out);
  const checkPop = sp(f, start + 12, SPRING.pop);
  const R = size / 2;
  const C = 2 * Math.PI * (R - 3);
  const CHECK_LEN = 64; // length of the check polyline in the 100-unit box below
  const particles = 18;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
      {/* Ripples */}
      {[0, 1].map((k) => {
        const t = ramp(f, start + 12 + k * 9, start + 52 + k * 9, 0, 1, EASE.out);
        if (t <= 0 || t >= 1) return null;
        const r = R * (1 + t * (1.5 + k * 0.6));
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: -r,
              top: -r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: `${2 - k * 0.6}px solid ${alpha(color, (1 - t) * 0.7)}`,
            }}
          />
        );
      })}
      {/* Particles */}
      {Array.from({ length: particles }).map((_, i) => {
        const s0 = start + 13 + i * 0.37;
        const t = ramp(f, s0, s0 + 30, 0, 1, EASE.out);
        if (t <= 0 || t >= 1) return null;
        const ang = (i / particles) * Math.PI * 2 + rr(`pa${i}`, -0.12, 0.12);
        const dist = R * (0.9 + t * rr(`pd${i}`, 0.9, 1.5));
        const len = 6 + (1 - t) * rr(`pl${i}`, 10, 22);
        const x = Math.cos(ang) * dist;
        const y = Math.sin(ang) * dist;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - len / 2,
              top: y - 1.5,
              width: len,
              height: 3,
              borderRadius: 2,
              background: i % 3 === 0 ? '#FFFFFF' : color,
              opacity: (1 - t) * 0.95,
              transform: `rotate(${(ang * 180) / Math.PI}deg)`,
              boxShadow: `0 0 10px ${alpha(color, 0.8)}`,
            }}
          />
        );
      })}
      {/* Disc + ring + check */}
      <svg
        width={size * 1.2}
        height={size * 1.2}
        viewBox={`${-size * 0.6} ${-size * 0.6} ${size * 1.2} ${size * 1.2}`}
        style={{ position: 'absolute', left: -size * 0.6, top: -size * 0.6, overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="cbDisc" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#86A6FF" />
            <stop offset="60%" stopColor={color} />
            <stop offset="100%" stopColor="#2E4CC4" />
          </radialGradient>
        </defs>
        <circle r={R * 1.35} fill={alpha(color, 0.18 * disc)} />
        <circle r={(R - 10) * disc} fill="url(#cbDisc)" />
        <circle
          r={R - 3}
          fill="none"
          stroke={alpha('#FFFFFF', 0.85)}
          strokeWidth={3}
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={C * (1 - ring)}
          transform="rotate(-90)"
          strokeLinecap="round"
        />
        <g transform={`scale(${(size / 100) * 0.62 * checkPop}) translate(-50 -50)`}>
          <polyline
            points="27,52 43,67 74,34"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
            strokeDashoffset={CHECK_LEN * (1 - check)}
          />
        </g>
      </svg>
    </div>
  );
};

/** A tap: a fingertip touch indicator that presses down, then ripples out. */
export const Tap: React.FC<{ frame: number; at: number; x: number; y: number; scale?: number }> = ({ frame, at, x, y, scale = 1 }) => {
  // SFX: ui_tap at `at`
  const appear = ramp(frame, at - 12, at - 2, 0, 1, EASE.out);
  const press = ramp(frame, at - 2, at + 2, 0, 1, EASE.out) * (1 - ramp(frame, at + 3, at + 10, 0, 1, EASE.out));
  const leave = ramp(frame, at + 6, at + 18, 0, 1, EASE.out);
  const ripple = ramp(frame, at, at + 22, 0, 1, EASE.out);
  const vis = appear * (1 - leave);
  if (frame < at - 12 || frame > at + 24) return null;
  const r = 26 * scale;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: 20 }}>
      {ripple > 0 && ripple < 1 && (
        <div
          style={{
            position: 'absolute',
            left: -r * (1 + ripple * 1.6),
            top: -r * (1 + ripple * 1.6),
            width: r * 2 * (1 + ripple * 1.6),
            height: r * 2 * (1 + ripple * 1.6),
            borderRadius: '50%',
            border: `2px solid rgba(255,255,255,${0.55 * (1 - ripple)})`,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: -r,
          top: -r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.55), rgba(255,255,255,0.18) 60%, rgba(255,255,255,0) 72%)',
          opacity: vis,
          transform: `scale(${1 - 0.18 * press})`,
        }}
      />
    </div>
  );
};
