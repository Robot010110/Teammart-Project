import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { COLORS, COPY } from '../../config';
import { MotionBlur } from '../../components/MotionBlur';
import { shake } from '../../lib/camera';
import { FONT_STACK } from '../../lib/fonts';
import { EASE, mix, pulse, ramp, sp, SPRING, stagger } from '../../lib/motion';
import { sceneClock, useAbsoluteFrame } from '../../lib/timing';
import { alpha, useLayout } from '../../lib/util';
import { ChaosVisual } from './Items';
import { getChaosSim, LAYERS, SIM_FRAMES, snapSchedule } from './sim';

/**
 * S1 CHAOS (0:00–0:06) + the freeze/snap that opens S2 BEAT (0:06–0:07).
 *
 * SFX cue sheet for this scene (also in src/sfx.ts):
 *   f2      notification pop — first bubble
 *   f12–f292 whoosh + pop per element entry (stacking, pitch-randomised)
 *   f40→    phone-vibration bed fades in, rising with the shake
 *   f120→   dissonant pad swells with the warm glow
 *   f200    hero line slams in — muffled thud
 *   f360    LOW HIT + tape-stop (the freeze)
 *   f378    reverse "suck" whoosh as everything snaps to the light
 */
export const Chaos: React.FC = () => {
  const abs = useAbsoluteFrame();
  const { W, H, cx, cy, vertical } = useLayout();
  const sim = useMemo(() => getChaosSim(W, H), [W, H]);

  const c = sceneClock('chaos', abs);
  const b = sceneClock('beat', abs);
  const freezeAt = b.range.start;
  const stretch = c.range.dur / SIM_FRAMES;
  const simFrameAt = (F: number) => Math.min(SIM_FRAMES - 1, Math.max(0, Math.floor((Math.min(F, freezeAt - 1) - c.range.start) / stretch)));

  // The snap: farthest elements leave first, each on its own sub-frame clock.
  const snapStart = freezeAt + b.len(18);
  const snapSpread = b.len(22);
  const snapDur = b.len(18);
  const snapStarts = useMemo(() => snapSchedule(sim, snapStart, snapSpread), [sim, snapStart, snapSpread]);

  const shakeAmp = (F: number) => (F >= freezeAt ? 0 : ramp(F, c.range.start + c.at(40), c.range.start + c.at(330), 0, 9, EASE.in));

  const posAt = (i: number, F: number) => {
    const it = sim.items[i];
    const L = LAYERS[it.layer];
    const st = sim.states[simFrameAt(F)];
    let x = st.x[i] * L.scale;
    let y = st.y[i] * L.scale;
    if (F < freezeAt) {
      const sh = shake(F, shakeAmp(F), 0);
      x += sh.x * L.p;
      y += sh.y * L.p;
      // Phones buzz.
      if (it.kind === 'missed' || it.kind === 'counter') {
        const buzz = noise2D(`buzz${i}`, F * 0.06, 0) > 0.3 ? 1 : 0;
        x += Math.sin(F * 2.9) * 2.6 * buzz;
      }
    }
    const q = ramp(F, snapStarts[i], snapStarts[i] + snapDur, 0, 1, EASE.in);
    return { x: x * (1 - q), y: y * (1 - q), q };
  };

  // Missed-call counter ticks 3 → 27, accelerating.
  const counter = Math.round(3 + 24 * ramp(c.f, c.at(80), c.at(345), 0, 1, EASE.in));

  // Freeze treatment: exposure dip, desaturation, a small push-in.
  const freezeT = ramp(abs, freezeAt, freezeAt + b.len(16), 0, 1, EASE.out);
  const flash = pulse(abs, freezeAt - 0.5, freezeAt + b.len(12), 0.08);
  // Open tight on the first message, pull out as the mess arrives.
  const openZoom = ramp(c.f, c.at(10), c.at(150), 1.38, 1, EASE.inOut);
  const stageScale = openZoom * (1 + 0.03 * freezeT + 0.015 * ramp(abs, snapStart, snapStart + snapSpread + snapDur, 0, 1, EASE.in));
  const camRot = abs < freezeAt ? shake(abs, 1, ramp(c.f, c.at(60), c.at(330), 0, 0.45, EASE.in), 'rot').r : 0;

  const renderItem = (i: number) => {
    const it = sim.items[i];
    const L = LAYERS[it.layer];
    const enterAbs = c.range.start + it.enter * stretch;
    if (abs < enterAbs) return null;
    const now = posAt(i, abs);
    if (now.q >= 1) return null;
    const prev = posAt(i, abs - 1);
    const st = sim.states[simFrameAt(abs)];
    const pop = 0.72 + 0.28 * sp(abs, enterAbs, SPRING.pop);
    const imp = st.impact[i];
    const scale = L.scale * pop * (1 + 0.05 * imp) * (1 - 0.94 * Math.pow(now.q, 1.15));
    const rot = st.rot[i] + now.q * (i % 2 ? 28 : -28);
    const opacity = L.opacity * (1 - ramp(now.q, 0.72, 1, 0, 1, EASE.smooth));
    const blur = L.blur + now.q * 2;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: cx + now.x,
          top: cy + now.y,
          transform: 'translate(-50%, -50%)',
          opacity,
          filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined,
          zIndex: it.layer * 100 + i,
        }}
      >
        <MotionBlur vx={now.x - prev.x} vy={now.y - prev.y} amount={it.layer === 2 ? 1.3 : 1}>
          <div style={{ transform: `rotate(${rot}deg) scale(${scale})` }}>
            <ChaosVisual it={it} counter={counter} />
          </div>
        </MotionBlur>
      </div>
    );
  };

  // ── Giant hero line: "who's covering Zone 3?" ────────────────────────────
  // SFX: hero_thud at c.at(200)
  const heroStart = c.range.start + c.at(200);
  const heroWords = COPY.chaos.hero.split(' ');
  const heroLines = vertical ? [heroWords.slice(0, 2), heroWords.slice(2)] : [heroWords];
  const heroSnapStart = snapStart + snapSpread * 0.55;
  const heroQ = ramp(abs, heroSnapStart, heroSnapStart + snapDur, 0, 1, EASE.in);
  const heroGrow = 1 + 0.12 * ramp(abs, heroStart, freezeAt, 0, 1, EASE.in);
  const heroJit = abs < freezeAt ? 1 : 0;
  const heroSize = vertical ? 128 : 150;
  const heroLine = (dx: number, dy: number, color: string, opacity: number, key: string) => (
    <div key={key} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transform: `translate(${dx}px, ${dy}px)`, opacity }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)' }}>
        {heroLines.map((line, li) => (
          <div key={li} style={{ display: 'flex', justifyContent: 'center', gap: '0 0.26em', fontSize: heroSize }}>
            {line.map((w, wi) => {
              const k = li * 10 + wi;
              const s = stagger(heroStart, heroLines.slice(0, li).reduce((n, l) => n + l.length, 0) + wi, 6.5);
              const p = sp(abs, s, SPRING.snap);
              return (
                <span
                  key={k}
                  style={{
                    display: 'inline-block',
                    fontFamily: FONT_STACK,
                    fontWeight: 780,
                    letterSpacing: '-0.05em',
                    lineHeight: 1.02,
                    color,
                    opacity: Math.min(1, p * 1.6),
                    transform: `translateY(${(1 - p) * heroSize * 0.4}px) scale(${0.86 + 0.14 * p})`,
                    filter: p < 0.98 ? `blur(${Math.max(0, (1 - p) * 14)}px)` : undefined,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
  const hj = (seed: string, amp: number) => noise2D(seed, abs * 0.35, 0) * amp * heroJit;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          transform: `scale(${stageScale}) rotate(${camRot}deg)`,
          filter: freezeT > 0 ? `saturate(${mix(1, 0.32, freezeT)}) brightness(${1 + flash * 0.5})` : undefined,
        }}
      >
        {sim.items.map((_, i) => (sim.items[i].layer === 0 ? renderItem(i) : null))}
        {sim.items.map((_, i) => (sim.items[i].layer === 1 ? renderItem(i) : null))}

        {abs >= heroStart - 2 && heroQ < 1 && (
          <AbsoluteFill
            style={{
              zIndex: 150,
              transform: `translate(${hj('hx', 5)}px, ${hj('hy', 4)}px) scale(${heroGrow * (1 - 0.96 * heroQ)})`,
              opacity: 1 - ramp(heroQ, 0.7, 1),
            }}
          >
            {/* Scrim so the line reads over the mess. */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: vertical ? 1100 : 1500,
                height: vertical ? 700 : 520,
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(ellipse, rgba(6,7,10,0.82) 0%, rgba(6,7,10,0.55) 45%, transparent 72%)',
                opacity: ramp(abs, heroStart, heroStart + 20),
              }}
            />
            {heroLine(hj('e1x', 10) - 7, hj('e1y', 6), COLORS.warm, 0.32 * heroJit, 'echo1')}
            {heroLine(hj('e2x', 10) + 7, hj('e2y', 6), COLORS.danger, 0.22 * heroJit, 'echo2')}
            {heroLine(0, 0, COLORS.text, 1, 'main')}
          </AbsoluteFill>
        )}

        {sim.items.map((_, i) => (sim.items[i].layer === 2 ? renderItem(i) : null))}
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ background: alpha('#FFFFFF', 0.1 * flash) }} />}
    </AbsoluteFill>
  );
};
