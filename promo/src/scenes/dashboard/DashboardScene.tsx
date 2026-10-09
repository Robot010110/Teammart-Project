import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Camera, ClipboardList, Crown, ShieldCheck, UserRound } from 'lucide-react';
import { COLORS, COPY, SCREENS } from '../../config';
import { BrowserFrame, Phone, PHONE } from '../../components/Devices';
import { Glass } from '../../components/Glass';
import { MotionBlur } from '../../components/MotionBlur';
import { FONT_STACK } from '../../lib/fonts';
import { EASE, mix, ramp, sp, SPRING } from '../../lib/motion';
import { sceneClock, SCENES, useAbsoluteFrame } from '../../lib/timing';
import { alpha, useLayout } from '../../lib/util';
import { BarsCard, ChartCard, DashHeader, FeedCard, KpiCard, RingsCard } from './Panels';

/**
 * S5 DASHBOARD (0:27–0:35) and the hand-off into S6.
 *
 *  5A  glass dashboard settles in as the graph falls away behind it
 *  5B  panels assemble on unique, staggered clocks (counters, line, rings, bars, feed)
 *  5C  live beat: the approved task from S4 lands in the feed, a KPI pops +1
 *  5D  pull back; a light sweep materialises the REAL TeamMart admin dashboard
 *  5E  three phones with REAL screens fly in from depth (RM, Supervisor, Employee)
 *  6A  (in S6 time) devices converge on the center and fall out of focus
 *
 * SFX: 2 ui-swell · 30 counter ticks · 170 tick-chime · 290 shimmer-sweep ·
 *      326/334/342 device whooshes · 420 riser.
 */
export const DashboardScene: React.FC = () => {
  const F = useAbsoluteFrame();
  const { cx, cy, vertical } = useLayout();
  const d = sceneClock('dashboard', F);
  const c6 = sceneClock('close', F);
  const D0 = d.range.start;
  const C0 = SCENES.close.start;
  const at = (n: number) => D0 + d.at(n);

  const T = {
    frame: at(-16),
    header: at(4),
    kpi: [at(10), at(15.4), at(20.8), at(26.2)],
    chart: at(32),
    rings: at(38),
    bars: at(44),
    feed: at(50),
    live: at(170),
    pull: at(268),
    sweep: [at(292), at(334)] as const,
    phones: [at(326), at(334.4), at(342.8)],
  };

  // ── Vector dashboard ─────────────────────────────────────────────────
  const FW = vertical ? 980 : 1640;
  const FH = vertical ? 1576 : 900;
  const enter = sp(F, T.frame, SPRING.heavy);
  const recede = ramp(F, T.pull, T.pull + d.len(48), 0, 1, EASE.inOut);
  const drift = { x: 12 * Math.sin(F * 0.01), y: 7 * Math.cos(F * 0.013) };
  const push = 1 + 0.03 * ramp(F, T.frame, T.pull, 0, 1, EASE.smooth);
  const dashScale = mix(1.2, 1, Math.min(1, enter)) * push * mix(1, 0.62, recede);
  const dashBlur = Math.max(0, 1 - enter) * 14 + recede * 12;
  const dashOpacity = Math.min(1, enter * 1.4) * (1 - ramp(F, T.pull + d.len(10), T.pull + d.len(46), 0, 1, EASE.in));
  const par = (p: number) => `translate(${drift.x * (p - 1) * 6}px, ${drift.y * (p - 1) * 6}px)`;

  const gap = 20;
  const pad = 30;
  const innerW = FW - pad * 2;
  const kpiW = vertical ? (innerW - gap) / 2 : (innerW - gap * 3) / 4;
  const leftW = vertical ? innerW : 960;
  const rightW = vertical ? innerW : innerW - 960 - gap;

  const dashboard = dashOpacity > 0.001 && (
    <div
      style={{
        position: 'absolute',
        left: cx - FW / 2,
        top: cy - FH / 2 + (vertical ? 10 : 8),
        width: FW,
        height: FH,
        transform: `translate(${drift.x}px, ${drift.y - recede * 40}px) scale(${dashScale})`,
        opacity: dashOpacity,
        filter: dashBlur > 0.3 ? `blur(${dashBlur.toFixed(2)}px)` : undefined,
      }}
    >
      <Glass radius={30} style={{ width: FW, height: FH, padding: pad, boxSizing: 'border-box', background: 'linear-gradient(180deg, rgba(19,22,34,0.93), rgba(11,13,21,0.95))' }}>
        <DashHeader f={F} t={T.header} vertical={vertical} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap, marginTop: 24, transform: par(1.06) }}>
          {[0, 1, 2, 3].map((i) => (
            <KpiCard key={i} i={i} f={F} t={T.kpi[i]} live={T.live} w={kpiW} h={vertical ? 132 : 140} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap, marginTop: gap, transform: par(1.09) }}>
          <ChartCard f={F} t={T.chart} w={leftW} h={vertical ? 290 : 320} />
          <RingsCard f={F} t={T.rings} w={rightW} h={vertical ? 214 : 320} ringSize={vertical ? 118 : 136} />
        </div>
        <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap, marginTop: gap, transform: par(1.12) }}>
          <BarsCard f={F} t={T.bars} w={leftW} h={vertical ? 262 : 284} live={T.live} />
          <FeedCard f={F} t={T.feed} w={rightW} h={vertical ? 300 : 284} live={T.live} rows={vertical ? 3 : 3} />
        </div>
      </Glass>
    </div>
  );

  // ── Real product reveal ──────────────────────────────────────────────
  const sweep = ramp(F, T.sweep[0], T.sweep[1], 0, 1, EASE.inOut);
  const bw = vertical ? 980 : 1120;
  const bh = (bw / 1440) * (900 + 52);
  const bCenter = vertical ? { x: cx, y: 562 } : { x: cx - 262, y: cy - 6 };
  const browserIn = sp(F, T.sweep[0] - 4, SPRING.heavy);

  // Close-out (S6 time): converge to center, fall out of focus.
  const conv = ramp(F, C0 - c6.len(4), C0 + c6.len(38), 0, 1, EASE.inOut);
  const convBlur = conv * 22;
  const groupOpacity = 1 - 0.85 * conv - 0.15 * ramp(F, C0 + c6.len(80), C0 + c6.len(140));
  const settle = ramp(F, T.phones[2] + 20, C0, 0, 1, EASE.smooth);
  const groupZoom = (1 + 0.035 * settle) * mix(1, 0.5, conv);

  const phoneW = vertical ? 300 : 250;
  const phoneH = PHONE.h * (phoneW / PHONE.w);
  const phoneSlots = vertical
    ? [
        { x: cx - 322, y: 1336 },
        { x: cx, y: 1306 },
        { x: cx + 322, y: 1336 },
      ]
    : [
        { x: cx + 290, y: cy + 52 },
        { x: cx + 505, y: cy + 12 },
        { x: cx + 720, y: cy - 28 },
      ];
  const phoneShots = [SCREENS.regionalManager, SCREENS.supervisor, SCREENS.employee];
  const roleIcons = [ShieldCheck, ClipboardList, UserRound];

  const toCenter = (p: { x: number; y: number }, depth: number) => ({
    x: mix(p.x, cx, conv * 0.9) + drift.x * (depth - 1) * 8,
    y: mix(p.y, cy, conv * 0.9) + drift.y * (depth - 1) * 8,
  });

  const rolePill = (Icon: React.ElementType, label: string, t: number) => {
    const p = sp(F, t, SPRING.snap);
    if (p <= 0.001) return null;
    return (
      <div style={{ opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 16}px)` }}>
        <Glass radius={999} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 18px 9px 12px', fontFamily: FONT_STACK, fontSize: vertical ? 22 : 19, fontWeight: 680, color: COLORS.text, whiteSpace: 'nowrap' }}>
          <Icon size={vertical ? 20 : 18} color={COLORS.accentSoft} strokeWidth={2.3} />
          {label}
        </Glass>
      </div>
    );
  };

  const reveal = F >= T.sweep[0] - 6 && groupOpacity > 0.001 && (
    <AbsoluteFill style={{ opacity: groupOpacity, filter: convBlur > 0.3 ? `blur(${convBlur.toFixed(2)}px)` : undefined }}>
      <AbsoluteFill style={{ transform: `scale(${groupZoom})` }}>
        {/* Browser with the real Admin dashboard */}
        {(() => {
          const pos = toCenter(bCenter, 1);
          const left = pos.x - bw / 2;
          const top = pos.y - bh / 2;
          const edge = sweep * bw;
          return (
            <>
              <div
                style={{
                  position: 'absolute',
                  left,
                  top,
                  transform: `scale(${mix(0.94, 1, Math.min(1, browserIn))})`,
                  clipPath: `inset(-40px ${bw - edge}px -40px -40px)`,
                }}
              >
                <BrowserFrame width={bw} title={COPY.reveal.browserTitle}>
                  <Img src={staticFile(SCREENS.admin)} style={{ width: 1440, height: 900, display: 'block' }} />
                </BrowserFrame>
              </div>
              {sweep > 0 && sweep < 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: left + edge - 60,
                    top: top - 30,
                    width: 120,
                    height: bh + 60,
                    background: `linear-gradient(90deg, transparent, ${alpha(COLORS.accent, 0.35)} 40%, rgba(255,255,255,0.9) 50%, ${alpha(COLORS.accent, 0.35)} 60%, transparent)`,
                    filter: 'blur(6px)',
                    opacity: Math.sin(sweep * Math.PI) * 0.9 + 0.1,
                  }}
                />
              )}
              <div style={{ position: 'absolute', left: left + 4, top: top + bh + 18 }}>
                {rolePill(Crown, COPY.reveal.admin, T.sweep[1] - 6)}
              </div>
            </>
          );
        })()}

        {/* Phones with real Regional Manager / Supervisor / Employee screens */}
        {phoneSlots.map((slot, i) => {
          const start = T.phones[i];
          const p = sp(F, start, SPRING.heavy);
          const pPrev = sp(F - 1, start, SPRING.heavy);
          if (p <= 0.001) return null;
          const from = vertical ? { x: 0, y: 420 } : { x: 380, y: 60 };
          const pos = toCenter(slot, 1.12);
          const x = pos.x + from.x * (1 - p);
          const y = pos.y + from.y * (1 - p);
          const xPrev = pos.x + from.x * (1 - pPrev);
          const yPrev = pos.y + from.y * (1 - pPrev);
          const scale = mix(1.35, 1, Math.min(1, p));
          const blur = Math.max(0, 1 - p) * 16;
          const Icon = roleIcons[i];
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: 10 + i }}>
              <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)' }}>
                <MotionBlur vx={x - xPrev} vy={y - yPrev}>
                  <div style={{ transform: `scale(${scale})`, opacity: Math.min(1, p * 1.6), filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
                    <Phone width={phoneW} screenshot={phoneShots[i]} />
                  </div>
                </MotionBlur>
              </div>
              <div style={{ position: 'absolute', left: 0, top: phoneH / 2 + 16, transform: 'translateX(-50%)' }}>
                {rolePill(Icon, COPY.reveal.devices[i], start + 16)}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Caption */}
      {(() => {
        const p = sp(F, T.phones[0] + 24, SPRING.settle);
        if (p <= 0.001) return null;
        return (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: vertical ? 1772 : 1000,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 10,
              fontFamily: FONT_STACK,
              fontSize: vertical ? 25 : 21,
              color: COLORS.textDim,
              fontWeight: 560,
              opacity: Math.min(1, p * 1.4) * (1 - conv),
              transform: `translateY(${(1 - p) * 14}px)`,
            }}
          >
            <Camera size={vertical ? 22 : 19} color={COLORS.accentSoft} />
            {COPY.reveal.caption}
          </div>
        );
      })()}
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill>
      {dashboard}
      {reveal}
    </AbsoluteFill>
  );
};
