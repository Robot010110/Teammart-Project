import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../config';
import { useCopy, useLang } from '../i18n/copy';
import { FONT_STACK } from '../lib/fonts';
import { EASE, ramp, sp, SPRING } from '../lib/motion';
import { FPS } from '../lib/timing';
import { useLayout } from '../lib/util';
import type { EditId } from '../timeline/edits';

/**
 * Burned-in captions for sound-off autoplay: a lower-third line whose words
 * rise in one after another, on each edit's own (output) timeline.
 */
export const Captions: React.FC<{ edit: EditId }> = ({ edit }) => {
  const out = useCurrentFrame();
  const copy = useCopy();
  const { rtl } = useLang();
  const { mode, W, H } = useLayout();
  const lines = copy.captions[edit];
  const line = lines.find((l) => out >= l.from * FPS - 6 && out < l.to * FPS + 10);
  if (!line) return null;
  const a = line.from * FPS;
  const b = line.to * FPS;
  const words = line.text.split(' ');
  const outT = ramp(out, b - 4, b + 10, 0, 1, EASE.in);
  const size = mode === 'landscape' ? 38 : mode === 'square' ? 40 : 46;
  const maxW = mode === 'landscape' ? 1300 : W - 120;
  const bottom = mode === 'landscape' ? 74 : mode === 'square' ? 64 : 250;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: H - bottom - size * 2.6, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            maxWidth: maxW,
            padding: `${size * 0.32}px ${size * 0.6}px`,
            borderRadius: size * 0.5,
            background: 'rgba(8,9,14,0.72)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.08)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: `0 ${size * 0.26}px`,
            direction: rtl ? 'rtl' : 'ltr',
            opacity: (1 - outT) * ramp(out, a - 6, a + 4),
            transform: `translateY(${outT * 12}px)`,
          }}
        >
          {words.map((w, i) => {
            const p = sp(out, a + i * 2.6, SPRING.settle);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  fontFamily: FONT_STACK,
                  fontSize: size,
                  fontWeight: 620,
                  lineHeight: 1.3,
                  letterSpacing: rtl ? 0 : '-0.01em',
                  color: COLORS.text,
                  opacity: Math.min(1, p * 1.5),
                  transform: `translateY(${(1 - p) * size * 0.35}px)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
