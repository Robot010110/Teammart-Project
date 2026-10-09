import React from 'react';
import { COLORS } from '../config';
import { alpha } from '../lib/util';

/**
 * Glass card: translucent fill, 1px light border that is brighter along the
 * top edge (a gradient border via mask-composite), soft drop shadow. No
 * backdrop-filter — over near-black it is invisible and it is the single most
 * expensive CSS effect to render.
 */
export const Glass: React.FC<{
  children?: React.ReactNode;
  radius?: number;
  style?: React.CSSProperties;
  /** 0..1 accent glow on the border + outer halo (used for "active" states). */
  glow?: number;
  /** Fill strength multiplier. */
  fill?: number;
  glowColor?: string;
}> = ({ children, radius = 20, style, glow = 0, fill = 1, glowColor = COLORS.accent }) => (
  <div
    style={{
      position: 'relative',
      borderRadius: radius,
      background: `linear-gradient(180deg, rgba(255,255,255,${0.075 * fill}), rgba(255,255,255,${0.028 * fill}))`,
      boxShadow: [
        `0 30px 70px -30px rgba(0,0,0,0.85)`,
        `inset 0 1px 0 rgba(255,255,255,0.05)`,
        glow > 0 ? `0 0 ${50 * glow}px ${alpha(glowColor, 0.35 * glow)}` : '',
      ]
        .filter(Boolean)
        .join(', '),
      ...style,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        padding: 1,
        background: `linear-gradient(180deg, rgba(255,255,255,${0.3 + 0.3 * glow}), rgba(255,255,255,0.06) 45%, ${alpha(
          glowColor,
          0.1 + 0.6 * glow,
        )})`,
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        pointerEvents: 'none',
      }}
    />
    {children}
  </div>
);
