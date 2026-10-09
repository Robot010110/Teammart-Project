import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from '../config';
import { useCopy, useLang } from '../i18n/copy';
import { KineticLine, KWord } from '../components/Kinetic';
import { EASE, pulse, ramp, sp, SPRING, stagger } from '../lib/motion';
import { sceneClock, useAbsoluteFrame } from '../lib/timing';
import { alpha, useLayout } from '../lib/util';
import { getChaosSim, snapSchedule } from './chaos/sim';

/**
 * S2 BEAT (0:06–0:09). The chaos (rendered by <Chaos/>) freezes and snaps
 * into this point of light, which flares, lifts above the line
 * "What if every market ran like one team?", then drops back to center
 * where S3 blooms it into the hierarchy.
 *
 * SFX: f378 reverse suck · f420 bright tink + shockwave · f432–f471 soft
 * tick per word · f522 whoosh out.
 */
export const LightPoint: React.FC<{ x: number; y: number; intensity: number; flare: number; size?: number }> = ({
  x,
  y,
  intensity,
  flare,
  size = 1,
}) => {
  const core = (5 + 7 * intensity + 10 * flare) * size;
  const glow = (40 + 70 * intensity + 260 * flare) * size;
  const halo = (220 + 260 * intensity + 500 * flare) * size;
  const streak = (180 + 380 * intensity + 900 * flare) * size;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: -halo,
          top: -halo,
          width: halo * 2,
          height: halo * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(COLORS.accent, 0.16 * (intensity + flare))} 0%, ${alpha(COLORS.accent, 0.05)} 35%, transparent 70%)`,
        }}
      />
      {/* Anamorphic streak */}
      <div
        style={{
          position: 'absolute',
          left: -streak,
          top: -1.5 * size,
          width: streak * 2,
          height: 3 * size,
          borderRadius: 3,
          background: `linear-gradient(90deg, transparent, ${alpha(COLORS.accentSoft, 0.55 * (0.4 + 0.6 * intensity))}, rgba(255,255,255,${0.75 * intensity}), ${alpha(
            COLORS.accentSoft,
            0.55 * (0.4 + 0.6 * intensity),
          )}, transparent)`,
          filter: 'blur(0.6px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -glow,
          top: -glow,
          width: glow * 2,
          height: glow * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,255,255,${0.55 * intensity}) 0%, ${alpha(COLORS.accent, 0.55)} 22%, ${alpha(COLORS.accent, 0.12)} 50%, transparent 72%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -core,
          top: -core,
          width: core * 2,
          height: core * 2,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: `0 0 ${core * 2}px #FFFFFF, 0 0 ${core * 5}px ${COLORS.accentSoft}`,
        }}
      />
    </div>
  );
};

export const Beat: React.FC = () => {
  const abs = useAbsoluteFrame();
  const { W, H, cx, cy, mode, pick } = useLayout();
  const copy = useCopy();
  const { rtl } = useLang();
  const b = sceneClock('beat', abs);
  const s3 = sceneClock('structure', abs);
  const B = b.range.start;

  // Light brightens with every element that lands in it.
  const sim = useMemo(() => getChaosSim(W, H, copy.chaos), [W, H, copy.chaos]);
  const snapStart = B + b.len(18);
  const snapDur = b.len(18);
  const snapSpread = b.len(22);
  const starts = useMemo(() => snapSchedule(sim, snapStart, snapSpread), [sim, snapStart, snapSpread]);
  const arrived = starts.filter((s) => s + snapDur <= abs).length / starts.length;
  const born = ramp(abs, snapStart, snapStart + 6, 0, 1, EASE.out);

  const flareAt = B + b.len(60);
  const flare = pulse(abs, flareAt - 2, flareAt + b.len(34), 0.2);
  const intensity = born * (0.3 + 0.7 * arrived) * (1 - 0.25 * ramp(abs, flareAt + 10, flareAt + 40));

  // Lift above the text, then return to center for the bloom.
  const liftY = pick({ landscape: -250, portrait: -470, square: -360 });
  const lift = sp(abs, B + b.at(68), SPRING.heavy) - sp(abs, B + b.at(158), SPRING.snap);
  const lightY = cy + liftY * lift;

  // Hand-off: S3's HQ node takes over from the light.
  const handoff = ramp(abs, s3.range.start + s3.len(4), s3.range.start + s3.len(26), 0, 1, EASE.out);

  // Shockwave on the flare.
  const wave = ramp(abs, flareAt, flareAt + b.len(40), 0, 1, EASE.out);

  // Words: two lines on 16:9, the copy's own portrait breaks elsewhere.
  const lines: string[][] = mode === 'landscape' ? copy.beat.lines : copy.beat.portraitLines;
  let n = 0;
  const wordLines: KWord[][] = lines.map((line, li) =>
    line.map((text) => {
      // 5-frame stagger, a beat longer between lines; golden sub-frame offsets keep every start unique.
      const start = B + stagger(b.at(72), n, b.len(5)) + li * b.len(4);
      n += 1;
      return { text, start, accent: copy.beat.highlight.includes(text) };
    }),
  );
  const size = pick({ landscape: 134, portrait: 136, square: 112 }) * (rtl ? 0.88 : 1);
  const exitStart = B + b.at(162);
  const lineH = size * (rtl ? 1.3 : 1.04);
  const blockY = pick({ landscape: cy + 50, portrait: cy + 90, square: cy + 70 });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {wave > 0 && wave < 1 && (
        <div
          style={{
            position: 'absolute',
            left: cx - 900 * wave,
            top: cy - 900 * wave,
            width: 1800 * wave,
            height: 1800 * wave,
            borderRadius: '50%',
            border: `2px solid ${alpha(COLORS.accentSoft, 0.55 * (1 - wave))}`,
            boxShadow: `0 0 40px ${alpha(COLORS.accent, 0.3 * (1 - wave))}, inset 0 0 40px ${alpha(COLORS.accent, 0.2 * (1 - wave))}`,
          }}
        />
      )}
      {born > 0 && handoff < 1 && (
        <div style={{ opacity: 1 - handoff }}>
          <LightPoint x={cx} y={lightY} intensity={intensity} flare={flare + 0.6 * handoff} />
        </div>
      )}
      {abs < exitStart + 40 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: blockY - (lines.length * lineH) / 2 }}>
          {wordLines.map((words, li) => (
            <div key={li} style={{ height: lineH }}>
              <KineticLine
                words={words}
                frame={abs}
                size={size}
                exitStart={exitStart + li * b.len(3)}
                exitGap={b.len(2)}
              />
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
