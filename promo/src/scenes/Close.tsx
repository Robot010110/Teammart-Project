import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { COLORS } from '../config';
import { KineticLine, KWord } from '../components/Kinetic';
import { LogoMark, Wordmark } from '../components/Logo';
import { useCopy, useLang, useProspect } from '../i18n/copy';
import { FONT_STACK } from '../lib/fonts';
import { EASE, pulse, ramp, sp, SPRING, stagger } from '../lib/motion';
import { useSceneClock } from '../lib/timing';
import { alpha, useLayout } from '../lib/util';
import { LightPoint } from './Beat';

/**
 * S6 CLOSE (0:35–0:40). Everything resolves to the logo.
 * The mark builds at the light (dead center on 16:9, then slides left into
 * the lockup), the wordmark rises letter by letter, the tagline word by word,
 * then the call to action — in brand orange, the action color.
 *
 * Soundtrack hits: devices converge · soft low hit · logo build · letter
 * ticks · tagline swell · CTA click · tail.
 */
/** Index that splits `words` into two lines of the most similar length. */
const balancedSplit = (words: string[]) => {
  const len = (ws: string[]) => ws.join(' ').length;
  let best = 1;
  for (let i = 1; i < words.length; i++) {
    if (Math.max(len(words.slice(0, i)), len(words.slice(i))) < Math.max(len(words.slice(0, best)), len(words.slice(best)))) best = i;
  }
  return best;
};

export const Close: React.FC = () => {
  const c = useSceneClock('close');
  const F = c.abs;
  const C0 = c.range.start;
  const at = (n: number) => C0 + c.at(n);
  const { cx, cy, mode, pick } = useLayout();
  const copy = useCopy();
  const { rtl } = useLang();
  const prospect = useProspect();

  // The light returns — a callback to the beat — and becomes the mark.
  const lightIn = ramp(F, at(14), at(32), 0, 1, EASE.out);
  const flare = pulse(F, at(28), at(64), 0.28);
  const lightOut = ramp(F, at(42), at(58), 0, 1, EASE.in);

  const markStart = at(40);
  const markSize = pick({ landscape: 146, portrait: 196, square: 132 });
  const wordSize = pick({ landscape: 150, portrait: 150, square: 118 });
  const breathe = 1 + 0.02 * Math.sin((F - C0) * 0.05);
  const lockPush = 1 + 0.025 * ramp(F, at(40), c.range.end, 0, 1, EASE.smooth);

  // Tagline: one line on 16:9, two elsewhere.
  const taglineWords = copy.close.tagline.split(' ');
  const half = balancedSplit(taglineWords);
  const lines = mode === 'landscape' ? [taglineWords] : [taglineWords.slice(0, half), taglineWords.slice(half)];
  let k = 0;
  const tagLines: KWord[][] = lines.map((line) =>
    line.map((text) => {
      const start = stagger(at(130), k, c.len(4));
      k += 1;
      return { text, start };
    }),
  );
  const tagSize = pick({ landscape: 60, portrait: 70, square: 56 }) * (rtl ? 0.92 : 1);

  // CTA
  const ctaP = sp(F, at(190), SPRING.snap);
  const shimmer = ramp(F, at(206), at(246), 0, 1, EASE.inOut);
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  const ctaSize = pick({ landscape: 27, portrait: 34, square: 28 });

  const glowR = pick({ landscape: 900, portrait: 760, square: 640 });

  // 16:9 lockup is a row; estimate its width so the mark can start centered.
  const letters = copy.close.wordmark.join('').length;
  const wordW = letters * wordSize * (0.6 - 0.045);
  const lockGap = 38;
  const markShift = (lockGap + wordW) / 2;
  const slide = sp(F, at(58), SPRING.snap);
  const markX = mode === 'landscape' ? markShift * (1 - Math.min(1.05, slide)) : 0;

  const top = pick({
    landscape: { lock: cy - 210, tag: cy + 30, cta: cy + 150, light: cy - 140, glow: cy - 120 },
    portrait: { lock: cy - 470, tag: cy + 40, cta: cy + 290, light: cy - 372, glow: cy - 300 },
    square: { lock: cy - 400, tag: cy - 40, cta: cy + 160, light: cy - 334, glow: cy - 220 },
  });

  // The brand lockup always reads left-to-right, even in the Kurdish cut.
  const lockup =
    mode === 'landscape' ? (
      <div style={{ position: 'absolute', left: 0, right: 0, top: top.lock, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: lockGap, direction: 'ltr' }}>
        <div style={{ transform: `translateX(${markX}px)` }}>
          <LogoMark size={markSize} frame={F} start={markStart} />
        </div>
        <Wordmark size={wordSize} frame={F} start={at(80)} />
      </div>
    ) : (
      <div style={{ position: 'absolute', left: 0, right: 0, top: top.lock, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mode === 'portrait' ? 46 : 30, direction: 'ltr' }}>
        <LogoMark size={markSize} frame={F} start={markStart} />
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
          top: top.glow - glowR,
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
          <LightPoint x={cx} y={top.light} intensity={0.8} flare={flare} />
        </div>
      )}

      <AbsoluteFill style={{ transform: `scale(${lockPush})` }}>
        {lockup}

        <div style={{ position: 'absolute', left: 0, right: 0, top: top.tag }}>
          {tagLines.map((words, i) => (
            <div key={i} style={{ height: tagSize * (rtl ? 1.4 : 1.12) }}>
              <KineticLine words={words} frame={F} size={tagSize} weight={560} tracking={-0.03} color="#D5DAE6" wordGap={0.26} />
            </div>
          ))}
        </div>

        {ctaP > 0.001 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: top.cta,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              opacity: Math.min(1, ctaP * 1.6),
              transform: `translateY(${(1 - ctaP) * 26}px)`,
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: `${ctaSize * 0.66}px ${ctaSize * 1.3}px`,
                borderRadius: 999,
                fontFamily: FONT_STACK,
                fontSize: ctaSize,
                fontWeight: 700,
                color: '#FFFFFF',
                overflow: 'hidden',
                letterSpacing: rtl ? 0 : '-0.015em',
                background: `linear-gradient(180deg, #FF8A33, ${COLORS.warm})`,
                boxShadow: `0 14px 40px -12px ${alpha(COLORS.warm, 0.8)}, inset 0 1px 0 rgba(255,255,255,0.35)`,
              }}
            >
              {copy.close.cta}
              <Arrow size={ctaSize * 0.95} color="#FFFFFF" strokeWidth={2.6} />
              {shimmer > 0 && shimmer < 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${-40 + shimmer * 140}%`,
                    width: '35%',
                    background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.4), transparent)',
                  }}
                />
              )}
            </div>
            {copy.close.url && (
              <div style={{ fontFamily: FONT_STACK, fontSize: ctaSize * 0.78, color: COLORS.textDim, fontWeight: 560, letterSpacing: '0.01em' }}>{copy.close.url}</div>
            )}
            {prospect.company.trim() !== '' && (
              <div style={{ fontFamily: FONT_STACK, fontSize: ctaSize * 0.72, color: COLORS.textDim, fontWeight: 600, letterSpacing: rtl ? 0 : '0.03em', marginTop: 6 }}>
                {copy.close.preparedFor}
              </div>
            )}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
