import React, { useId } from 'react';
import { LOOK } from '../config';

/**
 * Velocity-based directional motion blur.
 *
 * Pass the element's screen-space velocity in px/frame. The blur length is
 * velocity × shutter (180° shutter = half a frame of travel). It works by
 * rotating a wrapper so its local x-axis points along the motion, applying a
 * one-axis Gaussian blur inside that rotated space, then counter-rotating the
 * content so it stays upright:
 *
 *   outer  rotate(θ)        ← local x now = direction of travel
 *   middle filter: blur x   ← blur applied in the rotated space
 *   inner  rotate(−θ)       ← content back to upright
 *
 * The wrapper sizes to its (in-flow) child, so all three rotations share the
 * same pivot and the net transform of the content is identity.
 */
export const MotionBlur: React.FC<{
  vx: number;
  vy: number;
  children: React.ReactNode;
  /** Extra multiplier on top of the global shutter (e.g. 1.4 for a whip). */
  amount?: number;
  style?: React.CSSProperties;
}> = ({ vx, vy, children, amount = 1, style }) => {
  const rawId = useId();
  const id = `mb${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const speed = Math.hypot(vx, vy);
  const shutter = LOOK.shutterAngle / 360;
  const length = Math.min(speed * shutter * amount, LOOK.maxBlurPx);
  // A Gaussian with σ ≈ length/2.4 reads like a box smear of `length` px.
  const sigma = length / 2.4;

  if (!LOOK.motionBlur || sigma < 0.4) {
    return <div style={style}>{children}</div>;
  }

  const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
  return (
    <div style={{ ...style, transform: `rotate(${angle}deg)` }}>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id={id} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${sigma.toFixed(2)} 0`} />
          </filter>
        </defs>
      </svg>
      <div style={{ filter: `url(#${id})` }}>
        <div style={{ transform: `rotate(${-angle}deg)` }}>{children}</div>
      </div>
    </div>
  );
};
