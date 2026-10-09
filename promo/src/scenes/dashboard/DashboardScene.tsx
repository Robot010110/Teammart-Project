import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Camera, ClipboardList, Crown, ShieldCheck, UserRound } from 'lucide-react';
import { COLORS, SCREENS } from '../../config';
import { BrowserFrame, Phone, PHONE } from '../../components/Devices';
import { Glass } from '../../components/Glass';
import { MotionBlur } from '../../components/MotionBlur';
import { useAsset, useCopy, useLang } from '../../i18n/copy';
import { FONT_STACK } from '../../lib/fonts';
import { EASE, mix, ramp, sp, SPRING } from '../../lib/motion';
import { sceneClock, SCENES, useAbsoluteFrame, useFrameStep } from '../../lib/timing';
import { alpha, useLayout, type LayoutMode } from '../../lib/util';
import { BarsCard, ChartCard, DashHeader, FeedCard, KpiCard, RingsCard } from './Panels';

type PanelKind = 'chart' | 'rings' | 'bars' | 'feed';
/** [panel, width (0 = fill the rest of the row), height] */
type Cell = [PanelKind, number, number];

type DashLayout = {
  FW: number;
  FH: number;
  pad: number;
  gap: number;
  titleSize: number;
  kpiCols: number;
  kpiH: number;
  rows: Cell[][];
  ringSize: number;
  compact: boolean;
};

/**
 * One grid per format. 16:9 is the reference; 9:16 stacks every panel;
 * 1:1 keeps two columns but swaps the rings and the feed so the live feed
 * sits next to the chart, where the eye already is.
 */
const DASH: Record<LayoutMode, DashLayout> = {
  landscape: {
    FW: 1640,
    FH: 900,
    pad: 30,
    gap: 20,
    titleSize: 34,
    kpiCols: 4,
    kpiH: 140,
    rows: [
      [['chart', 960, 320], ['rings', 0, 320]],
      [['bars', 960, 284], ['feed', 0, 284]],
    ],
    ringSize: 136,
    compact: false,
  },
  portrait: {
    FW: 980,
    FH: 1576,
    pad: 30,
    gap: 20,
    titleSize: 32,
    kpiCols: 2,
    kpiH: 132,
    rows: [[['chart', 0, 290]], [['rings', 0, 214]], [['bars', 0, 262]], [['feed', 0, 300]]],
    ringSize: 118,
    compact: false,
  },
  square: {
    FW: 1000,
    FH: 922,
    pad: 26,
    gap: 18,
    titleSize: 30,
    kpiCols: 4,
    kpiH: 118,
    rows: [
      [['chart', 590, 330], ['feed', 0, 330]],
      [['bars', 590, 300], ['rings', 0, 300]],
    ],
    ringSize: 80,
    compact: true,
  },
};

/**
 * S5 DASHBOARD (0:27–0:35) and the hand-off into S6.
 *
 *  5A  glass dashboard settles in as the graph falls away behind it
 *  5B  panels assemble on unique, staggered clocks (counters, line, rings, bars, feed)
 *  5C  live beat: the task approved in S4 lands in the feed, a KPI pops +1
 *  5D  pull back; a light sweep materialises the REAL TeamMart admin dashboard
 *  5E  three phones with REAL screens fly in from depth (RM, Supervisor, Employee)
 *  6A  (in S6 time) devices converge on the center and fall out of focus
 *
 * SFX: 2 ui-swell · 30 counter ticks · 170 tick-chime · 290 shimmer-sweep ·
 *      326/334/342 device whooshes · 420 riser.
 */
export const DashboardScene: React.FC = () => {
  const F = useAbsoluteFrame();
  const step = useFrameStep();
  const { cx, cy, mode, pick } = useLayout();
  const copy = useCopy();
  const { rtl } = useLang();
  const asset = useAsset();
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
  const L = DASH[mode];
  const { FW, FH, pad, gap } = L;
  const enter = sp(F, T.frame, SPRING.heavy);
  const recede = ramp(F, T.pull, T.pull + d.len(48), 0, 1, EASE.inOut);
  const drift = { x: 12 * Math.sin(F * 0.01), y: 7 * Math.cos(F * 0.013) };
  const push = 1 + 0.03 * ramp(F, T.frame, T.pull, 0, 1, EASE.smooth);
  const dashScale = mix(1.2, 1, Math.min(1, enter)) * push * mix(1, 0.62, recede);
  const dashBlur = Math.max(0, 1 - enter) * 14 + recede * 12;
  const dashOpacity = Math.min(1, enter * 1.4) * (1 - ramp(F, T.pull + d.len(10), T.pull + d.len(46), 0, 1, EASE.in));
  const par = (p: number) => `translate(${drift.x * (p - 1) * 6}px, ${drift.y * (p - 1) * 6}px)`;

  const innerW = FW - pad * 2;
  const kpiW = (innerW - gap * (L.kpiCols - 1)) / L.kpiCols;

  const panel = ([kind, w, h]: Cell, width: number) => {
    switch (kind) {
      case 'chart':
        return <ChartCard key={kind} f={F} t={T.chart} w={width} h={h} />;
      case 'rings':
        return <RingsCard key={kind} f={F} t={T.rings} w={width} h={h} ringSize={L.ringSize} />;
      case 'bars':
        return <BarsCard key={kind} f={F} t={T.bars} w={width} h={h} live={T.live} />;
      case 'feed':
        return <FeedCard key={kind} f={F} t={T.feed} w={width} h={h} live={T.live} rows={3} />;
      default:
        return w;
    }
  };

  const dashboard = dashOpacity > 0.001 && (
    <div
      style={{
        position: 'absolute',
        left: cx - FW / 2,
        top: cy - FH / 2 + pick({ landscape: 8, portrait: 10, square: -36 }),
        width: FW,
        height: FH,
        transform: `translate(${drift.x}px, ${drift.y - recede * 40}px) scale(${dashScale})`,
        opacity: dashOpacity,
        filter: dashBlur > 0.3 ? `blur(${dashBlur.toFixed(2)}px)` : undefined,
      }}
    >
      <Glass radius={30} style={{ width: FW, height: FH, padding: pad, boxSizing: 'border-box', background: 'linear-gradient(180deg, rgba(19,22,34,0.93), rgba(11,13,21,0.95))' }}>
        <DashHeader f={F} t={T.header} titleSize={L.titleSize} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap, marginTop: L.compact ? 20 : 24, transform: par(1.06) }}>
          {[0, 1, 2, 3].map((i) => (
            <KpiCard key={i} i={i} f={F} t={T.kpi[i]} live={T.live} w={kpiW} h={L.kpiH} compact={L.compact} />
          ))}
        </div>
        {L.rows.map((row, r) => {
          const fixed = row.reduce((s, [, w]) => s + w, 0);
          const rest = innerW - fixed - gap * (row.length - 1);
          return (
            <div key={r} style={{ display: 'flex', gap, marginTop: gap, transform: par(1.09 + r * 0.03) }}>
              {row.map((cell) => panel(cell, cell[1] || rest))}
            </div>
          );
        })}
      </Glass>
    </div>
  );

  // ── Real product reveal ──────────────────────────────────────────────
  const sweep = ramp(F, T.sweep[0], T.sweep[1], 0, 1, EASE.inOut);
  const R = pick({
    landscape: {
      bw: 1120,
      browser: { x: cx - 262, y: cy - 6 },
      phoneW: 250,
      phones: [
        { x: cx + 290, y: cy + 52 },
        { x: cx + 505, y: cy + 12 },
        { x: cx + 720, y: cy - 28 },
      ],
      from: { x: 380, y: 60 },
      pillSize: 19,
      caption: { top: 1000, size: 21 } as { top: number; size: number } | null,
    },
    portrait: {
      bw: 980,
      browser: { x: cx, y: 562 },
      phoneW: 300,
      phones: [
        { x: cx - 322, y: 1336 },
        { x: cx, y: 1306 },
        { x: cx + 322, y: 1336 },
      ],
      from: { x: 0, y: 420 },
      pillSize: 22,
      caption: { top: 1772, size: 25 },
    },
    // 1:1: the browser on top, phones overlapping its lower edge. Captions
    // own the bottom band, so the role tags sit on the devices and the
    // "real screens" note moves to the top.
    square: {
      bw: 860,
      browser: { x: cx, y: 352 },
      phoneW: 184,
      phones: [
        { x: cx - 286, y: 748 },
        { x: cx, y: 724 },
        { x: cx + 286, y: 748 },
      ],
      from: { x: 0, y: 340 },
      pillSize: 16,
      caption: { top: 24, size: 19 },
    },
  });
  const bw = R.bw;
  const bh = (bw / 1440) * (900 + 52);
  const browserIn = sp(F, T.sweep[0] - 4, SPRING.heavy);

  // Close-out (S6 time): converge to center, fall out of focus.
  const conv = ramp(F, C0 - c6.len(4), C0 + c6.len(38), 0, 1, EASE.inOut);
  const convBlur = conv * 22;
  const groupOpacity = 1 - 0.85 * conv - 0.15 * ramp(F, C0 + c6.len(80), C0 + c6.len(140));
  const settle = ramp(F, T.phones[2] + 20, C0, 0, 1, EASE.smooth);
  const groupZoom = (1 + 0.035 * settle) * mix(1, 0.5, conv);

  const phoneW = R.phoneW;
  const phoneH = PHONE.h * (phoneW / PHONE.w);
  const phoneShots = [SCREENS.regionalManager, SCREENS.supervisor, SCREENS.employee].map(asset);
  const roleIcons = [ShieldCheck, ClipboardList, UserRound];

  const toCenter = (p: { x: number; y: number }, depth: number) => ({
    x: mix(p.x, cx, conv * 0.9) + drift.x * (depth - 1) * 8,
    y: mix(p.y, cy, conv * 0.9) + drift.y * (depth - 1) * 8,
  });

  const rolePill = (Icon: React.ElementType, label: string, t: number) => {
    const p = sp(F, t, SPRING.snap);
    if (p <= 0.001) return null;
    const size = R.pillSize;
    return (
      <div style={{ opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 16}px)` }}>
        <Glass
          radius={999}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: size * 0.47,
            padding: `${size * 0.47}px ${size * 0.95}px`,
            fontFamily: FONT_STACK,
            fontSize: size,
            fontWeight: 680,
            color: COLORS.text,
            whiteSpace: 'nowrap',
            background: 'rgba(16,19,30,0.82)',
          }}
        >
          <Icon size={size * 0.95} color={COLORS.accentSoft} strokeWidth={2.3} />
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
          const pos = toCenter(R.browser, 1);
          const left = pos.x - bw / 2;
          const top = pos.y - bh / 2;
          const edge = sweep * bw;
          const inset = mode === 'square' ? 18 : 4;
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
                <BrowserFrame width={bw} title={copy.reveal.browserTitle}>
                  <Img src={staticFile(asset(SCREENS.admin))} style={{ width: 1440, height: 900, display: 'block' }} />
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
              <div
                style={{
                  position: 'absolute',
                  top: mode === 'square' ? top + 18 : top + bh + 18,
                  // Aligned to the browser's leading edge (right in Kurdish).
                  ...(rtl ? { right: 2 * cx - (left + bw) + inset } : { left: left + inset }),
                }}
              >
                {rolePill(Crown, copy.reveal.admin, T.sweep[1] - 6)}
              </div>
            </>
          );
        })()}

        {/* Phones with real Regional Manager / Supervisor / Employee screens */}
        {R.phones.map((slot, i) => {
          const start = T.phones[i];
          const p = sp(F, start, SPRING.heavy);
          const pPrev = sp(F - step, start, SPRING.heavy);
          if (p <= 0.001) return null;
          const pos = toCenter(slot, 1.12);
          const x = pos.x + R.from.x * (1 - p);
          const y = pos.y + R.from.y * (1 - p);
          const xPrev = pos.x + R.from.x * (1 - pPrev);
          const yPrev = pos.y + R.from.y * (1 - pPrev);
          const scale = mix(1.35, 1, Math.min(1, p));
          const blur = Math.max(0, 1 - p) * 16;
          const Icon = roleIcons[i];
          const pillTop = mode === 'square' ? phoneH / 2 - 64 : phoneH / 2 + 16;
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: 10 + i }}>
              <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)' }}>
                <MotionBlur vx={x - xPrev} vy={y - yPrev}>
                  <div style={{ transform: `scale(${scale})`, opacity: Math.min(1, p * 1.6), filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
                    <Phone width={phoneW} screenshot={phoneShots[i]} />
                  </div>
                </MotionBlur>
              </div>
              <div style={{ position: 'absolute', left: 0, top: pillTop, transform: 'translateX(-50%)', direction: rtl ? 'rtl' : 'ltr' }}>
                {rolePill(Icon, copy.reveal.devices[i], start + 16)}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Caption: these are real screens */}
      {R.caption &&
        (() => {
          const p = sp(F, T.phones[0] + 24, SPRING.settle);
          if (p <= 0.001) return null;
          const { top, size } = R.caption;
          return (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 10,
                fontFamily: FONT_STACK,
                fontSize: size,
                color: COLORS.textDim,
                fontWeight: 560,
                opacity: Math.min(1, p * 1.4) * (1 - conv),
                transform: `translateY(${(1 - p) * 14}px)`,
              }}
            >
              <Camera size={size * 0.92} color={COLORS.accentSoft} />
              {copy.reveal.caption}
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
