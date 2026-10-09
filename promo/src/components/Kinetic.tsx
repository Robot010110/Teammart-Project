import React from 'react';
import { COLORS } from '../config';
import { FONT_STACK } from '../lib/fonts';
import { EASE, ramp, sp, SPRING } from '../lib/motion';
import { useLang } from '../i18n/copy';
import { useFrameStep } from '../lib/timing';
import { alpha } from '../lib/util';
import { MotionBlur } from './MotionBlur';

export type KWord = { text: string; start: number; accent?: boolean };

/**
 * Huge kinetic type. Each word rises out of a soft defocus with a spring
 * (slight overshoot), carries real vertical motion blur while it moves, and
 * can exit on its own staggered clock.
 */
export const KineticLine: React.FC<{
  words: KWord[];
  frame: number;
  size: number;
  weight?: number;
  tracking?: number;
  exitStart?: number;
  exitGap?: number;
  align?: 'center' | 'flex-start';
  color?: string;
  wordGap?: number;
}> = ({
  words,
  frame,
  size,
  weight = 720,
  tracking = -0.045,
  exitStart = Infinity,
  exitGap = 2,
  align = 'center',
  color = COLORS.text,
  wordGap = 0.24,
}) => {
  const step = useFrameStep();
  const { rtl } = useLang();
  // Arabic script is cursive: never track it.
  const track = rtl ? 0 : tracking;
  const lineHeight = rtl ? 1.3 : 1.04;
  const yAt = (f: number, w: KWord, i: number) => {
    const p = sp(f, w.start, SPRING.snap);
    const e = Number.isFinite(exitStart) ? ramp(f, exitStart + i * exitGap, exitStart + i * exitGap + 14, 0, 1, EASE.in) : 0;
    return { p, e, y: (1 - p) * size * 0.62 - e * size * 0.22 };
  };
  return (
    <div style={{ display: 'flex', justifyContent: align, alignItems: 'baseline', gap: `0 ${wordGap}em`, fontSize: size, flexWrap: 'nowrap' }}>
      {words.map((w, i) => {
        const now = yAt(frame, w, i);
        const prev = yAt(frame - step, w, i);
        const opacity = Math.min(1, Math.max(0, now.p * 1.7)) * (1 - now.e);
        const blur = Math.max(0, 1 - now.p) * 16 + now.e * 12;
        const scale = (0.94 + 0.06 * Math.min(1.04, now.p)) * (1 - 0.05 * now.e);
        if (opacity <= 0.001) {
          return (
            <span key={i} style={{ fontFamily: FONT_STACK, fontWeight: weight, letterSpacing: `${track}em`, opacity: 0, lineHeight }}>
              {w.text}
            </span>
          );
        }
        // Accent words get a slow glow sweep across the gradient.
        const sweep = ramp(frame, w.start + 8, w.start + 70, 0, 1, EASE.smooth);
        return (
          <MotionBlur key={i} vx={0} vy={now.y - prev.y}>
            <span
              style={{
                display: 'inline-block',
                fontFamily: FONT_STACK,
                fontWeight: weight,
                letterSpacing: `${track}em`,
                lineHeight,
                whiteSpace: 'nowrap',
                transform: `translateY(${now.y}px) scale(${scale})`,
                opacity,
                filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined,
                color: w.accent ? undefined : color,
                backgroundImage: w.accent
                  ? `linear-gradient(100deg, ${COLORS.accent} 0%, ${COLORS.accent} ${20 + sweep * 60}%, #DCE5FF ${30 + sweep * 60}%, ${COLORS.accent} ${42 + sweep * 60}%, ${COLORS.accent} 100%)`
                  : undefined,
                WebkitBackgroundClip: w.accent ? 'text' : undefined,
                WebkitTextFillColor: w.accent ? 'transparent' : undefined,
                textShadow: w.accent ? undefined : `0 0 60px ${alpha(COLORS.accent, 0.18)}`,
              }}
            >
              {w.text}
            </span>
          </MotionBlur>
        );
      })}
    </div>
  );
};
