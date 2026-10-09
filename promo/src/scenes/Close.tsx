import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ArrowRight } from 'lucide-react';
import { COLORS, COPY } from '../config';
import { Glass } from '../components/Glass';
import { KineticLine, KWord } from '../components/Kinetic';
import { LogoMark, Wordmark } from '../components/Logo';
import { FONT_STACK } from '../lib/fonts';
import { EASE, pulse, ramp, sp, SPRING, stagger } from '../lib/motion';
import { useSceneClock } from '../lib/timing';
import { alpha, useLayout } from '../lib/util';
import { LightPoint } from './Beat';

/**
 * S6 CLOSE (0:35–0:40). Everything resolves to the logo.
 *
 * SFX: 0 whoosh-in (devices converge) · 30 low-hit-soft · 40 logo-build ·
 *      80 soft letter ticks · 130 tagline-swell · 190 soft-click (CTA) ·
 *      240 reverb tail.
 */
export const Close: React.FC = () => {
  const c = useSceneClock('close');
  const F = c.abs;
  const C0 = c.range.start;
  const at = (n: number) => C0 + c.at(n);
  const { cx, cy, vertical } = useLayout();

  // The light returns — a callback to the beat — and becomes the mark.
  const lightIn = ramp(F, at(14), at(32), 0, 1, EASE.out);
  const flare = pulse(F, at(28), at(64), 0.28);
  const lightOut = ramp(F, at(42), at(58), 0, 1, EASE.in);

  const markStart = at(40);
  const markSize = vertical ? 196 : 146;
  const wordSize = vertical ? 150 : 150;
  const breathe = 1 + 0.02 * Math.sin((F - C0) * 0.05);
  const lockPush = 1 + 0.025 * ramp(F, at(40), c.range.end, 0, 1, EASE.smooth);

  // Tagline
  const taglineWords = COPY.close.tagline.split(' ');
  const lines = vertical ? [taglineWords.slice(0, 3), taglineWords.slice(3)] : [taglineWords];
  let k = 0;
  const tagLines: KWord[][] = lines.map((line) =>
    line.map((text) => {
      const start = stagger(at(130), k, c.len(4));
      k += 1;
      return { text, start };
    }),
  );

  // CTA
  const ctaP = sp(F, at(190), SPRING.snap);
  const shimmer = ramp(F, at(206), at(246), 0, 1, EASE.inOut);

  const glowR = vertical ? 760 : 900;

  // 16:9 lockup is a row; estimate its width so the mark can start centered.
  const letters = COPY.close.wordmark.join('').length;
  const wordW = letters * wordSize * (0.6 - 0.045);
  const lockGap = 38;
  const markShift = (lockGap + wordW) / 2;
  const slide = sp(F, at(58), SPRING.snap);
  const markX = vertical ? 0 : markShift * (1 - Math.min(1.05, slide));

  const lockup = vertical ? (
    <div style={{ position: 'absolute', left: 0, right: 0, top: cy - 470, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46 }}>
      <LogoMark size={markSize} frame={F} start={markStart} />
      <Wordmark size={wordSize} frame={F} start={at(80)} />
    </div>
  ) : (
    <div style={{ position: 'absolute', left: 0, right: 0, top: cy - 210, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: lockGap }}>
      <div style={{ transform: `translateX(${markX}px)` }}>
        <LogoMark size={markSize} frame={F} start={markStart} />
      </div>
      <Wordmark size={wordSize} frame={F} start={at(80)} />
    </div>
  );

  return (
    <AbsoluteFill>
      {/* Breathing accent glow behind the lockup */}
      <div
        style={{
          position: 'absolute',
          left: cx - glowR,
          top: (vertical ? cy - 300 : cy - 120) - glowR,
          width: glowR * 2,
          height: glowR * 2,
          borderRadius: '50%',
          opacity: ramp(F, at(36), at(90)) * 0.9,
          transform: `scale(${breathe})`,
          background: `radial-gradient(circle, ${alpha(COLORS.accent, 0.2)} 0%, ${alpha(COLORS.accent, 0.06)} 35%, transparent 65%)`,
        }}
      />

      {lightIn > 0 && lightOut < 1 && (
        <div style={{ opacity: lightIn * (1 - lightOut) }}>
          <LightPoint x={cx} y={vertical ? cy - 372 : cy - 140} intensity={0.8} flare={flare} />
        </div>
      )}

      <AbsoluteFill style={{ transform: `scale(${lockPush})` }}>
        {lockup}

        <div style={{ position: 'absolute', left: 0, right: 0, top: vertical ? cy + 40 : cy + 30 }}>
          {tagLines.map((words, i) => (
            <div key={i} style={{ height: (vertical ? 70 : 62) * 1.12 }}>
              <KineticLine words={words} frame={F} size={vertical ? 70 : 60} weight={560} tracking={-0.03} color="#D5DAE6" wordGap={0.26} />
            </div>
          ))}
        </div>

        {ctaP > 0.001 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: vertical ? cy + 290 : cy + 150,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              opacity: Math.min(1, ctaP * 1.6),
              transform: `translateY(${(1 - ctaP) * 26}px)`,
            }}
          >
            <Glass
              radius={999}
              glow={0.6}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: vertical ? '22px 40px' : '18px 34px',
                fontFamily: FONT_STACK,
                fontSize: vertical ? 34 : 27,
                fontWeight: 680,
                color: COLORS.text,
                overflow: 'hidden',
                letterSpacing: '-0.015em',
              }}
            >
              {COPY.close.cta}
              <ArrowRight size={vertical ? 32 : 26} color={COLORS.accentSoft} strokeWidth={2.4} />
              {shimmer > 0 && shimmer < 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${-40 + shimmer * 140}%`,
                    width: '35%',
                    background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.28), transparent)',
                  }}
                />
              )}
            </Glass>
            {COPY.close.url && (
              <div style={{ fontFamily: FONT_STACK, fontSize: vertical ? 26 : 21, color: COLORS.textDim, fontWeight: 560, letterSpacing: '0.01em' }}>{COPY.close.url}</div>
            )}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
