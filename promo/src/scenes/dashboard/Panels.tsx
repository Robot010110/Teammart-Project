import React from 'react';
import { CheckCircle2, Info, Store, Timer, Users, ListChecks } from 'lucide-react';
import { COLORS } from '../../config';
import { Glass } from '../../components/Glass';
import { useCopy, useLang } from '../../i18n/copy';
import { FONT_STACK } from '../../lib/fonts';
import { EASE, pulse, ramp, sp, SPRING, stagger } from '../../lib/motion';
import { alpha, fmtInt } from '../../lib/util';

/**
 * Dashboard panels. Every number is a sample value from config.ts and the
 * header carries an "Illustrative data" tag. Each panel takes `t` (its own
 * start frame) and `f` (current frame) so the parent controls the stagger.
 * `compact` panels drop secondary detail for the 1:1 layout.
 */

export type PanelTimes = {
  kpi: number[];
  chart: number;
  rings: number;
  bars: number;
  feed: number;
  live: number;
};

const panelIn = (f: number, t: number) => {
  const p = sp(f, t, SPRING.snap);
  return {
    p,
    style: {
      opacity: Math.min(1, p * 1.7),
      transform: `translateY(${(1 - p) * 34}px) scale(${0.96 + 0.04 * p})`,
      filter: p < 0.96 ? `blur(${Math.max(0, (1 - p) * 10).toFixed(2)}px)` : undefined,
    } as React.CSSProperties,
  };
};

// Arabic-script text keeps its natural spacing: tracking breaks cursive joins.
const CardTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => {
  const { rtl } = useLang();
  return (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 19, fontWeight: 650, color: COLORS.textDim, letterSpacing: rtl ? 0 : '-0.01em' }}>
    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
    {right}
  </div>
  );
};

const KPI_ICONS = [Store, Users, CheckCircle2, Timer];

export const KpiCard: React.FC<{ i: number; f: number; t: number; live: number; w: number; h: number; compact?: boolean }> = ({ i, f, t, live, w, h, compact = false }) => {
  const k = useCopy().dashboard.kpis[i];
  const { rtl } = useLang();
  const { style } = panelIn(f, t);
  const count = ramp(f, t + 6, t + 58, 0, 1, EASE.out);
  const bump = i === 2 ? (f >= live ? 1 : 0) : 0;
  const pop = i === 2 ? pulse(f, live, live + 22, 0.25) : 0;
  const Icon = KPI_ICONS[i];
  const spark = ramp(f, t + 10, t + 50, 0, 1, EASE.out);
  const pts = [0.4, 0.55, 0.48, 0.62, 0.58, 0.74, 0.7, 0.86].map((v, j) => `${(j / 7) * 100},${(1 - v) * 30 + 3}`).join(' ');
  return (
    <div style={style}>
      <Glass radius={20} glow={pop * 0.9} style={{ width: w, height: h, padding: compact ? '16px 18px' : '20px 22px', boxSizing: 'border-box', fontFamily: FONT_STACK }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: compact ? 15 : 18, color: COLORS.textDim, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</span>
          <div style={{ width: compact ? 28 : 34, height: compact ? 28 : 34, flexShrink: 0, borderRadius: 10, background: alpha(COLORS.accent, 0.14), display: 'grid', placeItems: 'center' }}>
            <Icon size={compact ? 15 : 18} color={COLORS.accentSoft} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
          <span
            style={{
              fontSize: compact ? 44 : 54,
              fontWeight: 740,
              letterSpacing: '-0.045em',
              color: pop > 0.05 ? '#DCE5FF' : COLORS.text,
              fontVariantNumeric: 'tabular-nums',
              display: 'inline-block',
              transform: `scale(${1 + 0.07 * pop})`,
              transformOrigin: rtl ? 'right bottom' : 'left bottom',
              textShadow: pop > 0.05 ? `0 0 30px ${alpha(COLORS.accent, 0.8 * pop)}` : undefined,
            }}
          >
            {fmtInt(k.value * count + bump)}
            {k.suffix}
          </span>
          {!compact && (
            <svg width={92} height={36} viewBox="0 0 100 36" preserveAspectRatio="none" style={{ marginBottom: 10 }}>
              <polyline points={pts} fill="none" stroke={COLORS.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - spark} />
            </svg>
          )}
        </div>
      </Glass>
    </div>
  );
};

export const ChartCard: React.FC<{ f: number; t: number; w: number; h: number }> = ({ f, t, w, h }) => {
  const { style } = panelIn(f, t);
  const D = useCopy().dashboard;
  const vals = D.chart.values;
  const max = Math.max(...vals) * 1.12;
  const PW = w - 44;
  const PH = h - 110;
  const x = (i: number) => (i / (vals.length - 1)) * PW;
  const y = (v: number) => PH - (v / max) * PH;
  const draw = ramp(f, t + 8, t + 62, 0, 1, EASE.inOut);
  // Smooth line through the points (Catmull-Rom → cubic Bézier).
  const P = vals.map((v, i) => ({ x: x(i), y: y(v) }));
  let d = `M ${P[0].x} ${P[0].y}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  const area = `${d} L ${PW} ${PH} L 0 ${PH} Z`;
  const last = P[P.length - 1];
  const bubble = sp(f, t + 60, SPRING.pop);
  return (
    <div style={style}>
      <Glass radius={22} style={{ width: w, height: h, padding: '20px 22px', boxSizing: 'border-box', fontFamily: FONT_STACK }}>
        <CardTitle right={<span style={{ fontSize: 16, color: COLORS.textFaint, whiteSpace: 'nowrap' }}>{D.chart.range}</span>}>{D.chart.title}</CardTitle>
        <svg width={PW} height={PH + 30} style={{ marginTop: 22, overflow: 'visible' }}>
          <defs>
            <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
            </linearGradient>
            <clipPath id="dashClip">
              <rect x={0} y={-20} width={PW * draw} height={PH + 40} />
            </clipPath>
          </defs>
          {[0, 1, 2, 3].map((g) => (
            <line key={g} x1={0} x2={PW} y1={(g / 3) * PH} y2={(g / 3) * PH} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
          ))}
          <path d={area} fill="url(#dashArea)" clipPath="url(#dashClip)" />
          <path d={d} fill="none" stroke={COLORS.accent} strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} style={{ filter: `drop-shadow(0 0 8px ${alpha(COLORS.accent, 0.7)})` }} />
          {P.map((p, i) => {
            const pp = sp(f, t + 8 + (i / (P.length - 1)) * 54 + 2, SPRING.pop);
            return <circle key={i} cx={p.x} cy={p.y} r={5.5 * pp} fill={COLORS.bg} stroke="#DCE5FF" strokeWidth={2.5} />;
          })}
          {D.chart.days.map((day, i) => (
            <text key={day} x={x(i)} y={PH + 28} fill={COLORS.textFaint} fontSize={15} fontFamily={FONT_STACK} textAnchor="middle" fontWeight={600}>
              {day}
            </text>
          ))}
          {bubble > 0.01 && (
            <g transform={`translate(${last.x} ${last.y - 30}) scale(${bubble})`}>
              <rect x={-34} y={-19} width={68} height={32} rx={10} fill={COLORS.accent} />
              <text x={0} y={3} fill="#fff" fontSize={17} fontWeight={750} textAnchor="middle" fontFamily={FONT_STACK}>
                {vals[vals.length - 1]}
              </text>
            </g>
          )}
        </svg>
      </Glass>
    </div>
  );
};

export const RingsCard: React.FC<{ f: number; t: number; w: number; h: number; ringSize: number }> = ({ f, t, w, h, ringSize }) => {
  const { style } = panelIn(f, t);
  const D = useCopy().dashboard;
  const small = ringSize < 100;
  const stroke = ringSize < 100 ? 10 : 13;
  const R = ringSize / 2 - stroke * 0.7;
  const C = 2 * Math.PI * R;
  return (
    <div style={style}>
      <Glass radius={22} style={{ width: w, height: h, padding: '20px 22px', boxSizing: 'border-box', fontFamily: FONT_STACK }}>
        <CardTitle right={<ListChecks size={18} color={COLORS.textFaint} />}>{D.ringsTitle}</CardTitle>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: h - 60 }}>
          {D.rings.map((r, i) => {
            const fill = sp(f, stagger(t + 10, i, 6), SPRING.settle) * r.value;
            return (
              <div key={r.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative', width: ringSize, height: ringSize }}>
                  <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
                    <defs>
                      <linearGradient id={`ring${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#9BB3FF" />
                        <stop offset="100%" stopColor={COLORS.accent} />
                      </linearGradient>
                    </defs>
                    <circle cx={ringSize / 2} cy={ringSize / 2} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
                    <circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={R}
                      fill="none"
                      stroke={`url(#ring${i})`}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      strokeDasharray={`${C} ${C}`}
                      strokeDashoffset={C * (1 - Math.max(0, fill))}
                      style={{ filter: `drop-shadow(0 0 6px ${alpha(COLORS.accent, 0.6)})` }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: ringSize * 0.22, fontWeight: 740, letterSpacing: '-0.04em', color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(Math.max(0, fill) * 100)}%
                  </div>
                </div>
                <span style={{ fontSize: small ? 14 : 17, color: COLORS.textDim, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.label}</span>
              </div>
            );
          })}
        </div>
      </Glass>
    </div>
  );
};

export const BarsCard: React.FC<{ f: number; t: number; w: number; h: number; live: number }> = ({ f, t, w, h, live }) => {
  const { style } = panelIn(f, t);
  const D = useCopy().dashboard;
  const vals = D.bars.values;
  const PH = h - 112;
  const gap = 14;
  const bw = (w - 44 - gap * (vals.length - 1)) / vals.length;
  return (
    <div style={style}>
      <Glass radius={22} style={{ width: w, height: h, padding: '20px 22px', boxSizing: 'border-box', fontFamily: FONT_STACK }}>
        <CardTitle>{D.bars.title}</CardTitle>
        <div style={{ display: 'flex', gap, alignItems: 'flex-end', height: PH, marginTop: 30 }}>
          {vals.map((v, i) => {
            const g = sp(f, stagger(t + 8, i, 3.3), SPRING.snap);
            const bonus = i === 7 ? 0.06 * sp(f, live + 6, SPRING.pop) : 0;
            const hh = Math.max(0, (v + bonus) * g) * PH;
            const hl = i === 7 ? pulse(f, live + 4, live + 40, 0.25) : 0;
            return (
              <div key={i} style={{ width: bw, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: PH, position: 'relative' }}>
                <span style={{ fontSize: 13.5, color: COLORS.textDim, fontWeight: 650, marginBottom: 6, opacity: ramp(f, t + 26 + i * 3.3, t + 40 + i * 3.3), fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round((v + bonus) * 100)}%
                </span>
                <div
                  style={{
                    width: '100%',
                    height: hh,
                    borderRadius: '9px 9px 4px 4px',
                    background: `linear-gradient(180deg, ${hl > 0.05 ? '#DCE5FF' : '#86A3FF'}, ${alpha(COLORS.accent, 0.35)})`,
                    boxShadow: hl > 0.05 ? `0 0 26px ${alpha(COLORS.accent, 0.8 * hl)}` : `0 0 14px ${alpha(COLORS.accent, 0.25)}`,
                  }}
                />
                <span style={{ position: 'absolute', bottom: -28, fontSize: 13.5, color: COLORS.textFaint, fontWeight: 600 }}>
                  {`M${String(i + 1).padStart(2, '0')}`}
                </span>
              </div>
            );
          })}
        </div>
      </Glass>
    </div>
  );
};

export const FeedCard: React.FC<{ f: number; t: number; w: number; h: number; live: number; rows: number }> = ({ f, t, w, h, live, rows }) => {
  const { style } = panelIn(f, t);
  const rowH = 66;
  const liveIn = sp(f, live, SPRING.snap);
  const D = useCopy().dashboard;
  const { rtl } = useLang();
  const items = [D.liveItem, ...D.feed];
  return (
    <div style={style}>
      <Glass radius={22} style={{ width: w, height: h, padding: '20px 22px', boxSizing: 'border-box', fontFamily: FONT_STACK, overflow: 'hidden' }}>
        <CardTitle
          right={
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, color: COLORS.accentSoft, fontWeight: 650 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.accent, boxShadow: `0 0 ${8 + 6 * Math.sin(f * 0.15)}px ${COLORS.accent}` }} />
              {D.live}
            </span>
          }
        >
          {D.feedTitle}
        </CardTitle>
        <div style={{ position: 'relative', marginTop: 16, height: h - 70 }}>
          {items.map((it, idx) => {
            const isLive = idx === 0;
            const slot = isLive ? 0 : idx - 1 + liveIn;
            if (slot > rows - 0.01 && !isLive) return null;
            const appear = isLive ? liveIn : sp(f, stagger(t + 10, idx - 1, 7), SPRING.snap);
            const fadeLast = !isLive ? 1 - ramp(slot, rows - 1, rows - 0.2) : 1;
            if (appear <= 0.001) return null;
            const glow = isLive ? pulse(f, live, live + 50, 0.2) : 0;
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: slot * rowH,
                  height: rowH - 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '0 14px',
                  borderRadius: 14,
                  background: glow > 0.02 ? alpha(COLORS.accent, 0.16 * glow) : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${glow > 0.02 ? alpha(COLORS.accent, 0.6 * glow) : 'rgba(255,255,255,0.05)'}`,
                  opacity: Math.min(1, appear * 1.6) * fadeLast,
                  transform: `translateX(${(1 - appear) * (rtl ? -60 : 60)}px)`,
                }}
              >
                <CheckCircle2 size={22} color={isLive ? '#DCE5FF' : COLORS.accent} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17.5, color: COLORS.text, fontWeight: 620, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.text}</div>
                  <div style={{ fontSize: 14, color: COLORS.textFaint, marginTop: 1 }}>{it.where}</div>
                </div>
                <span style={{ fontSize: 14, color: isLive ? COLORS.accentSoft : COLORS.textFaint, fontWeight: 650 }}>{it.time}</span>
              </div>
            );
          })}
        </div>
      </Glass>
    </div>
  );
};

export const DashHeader: React.FC<{ f: number; t: number; titleSize: number }> = ({ f, t, titleSize }) => {
  const { style } = panelIn(f, t);
  const D = useCopy().dashboard;
  const { rtl } = useLang();
  return (
    <div style={{ ...style, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT_STACK, height: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: titleSize, fontWeight: 740, letterSpacing: rtl ? 0 : '-0.035em', color: COLORS.text }}>{D.title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: alpha(COLORS.accent, 0.14), border: `1px solid ${alpha(COLORS.accent, 0.4)}`, fontSize: 16, fontWeight: 700, color: COLORS.accentSoft }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.accent, boxShadow: `0 0 ${8 + 6 * Math.sin(f * 0.15)}px ${COLORS.accent}` }} />
          {D.live}
        </span>
      </div>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', fontSize: 15, fontWeight: 650, color: COLORS.textDim }}>
        <Info size={15} /> {D.dataTag}
      </span>
    </div>
  );
};
