import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ArrowRight, ClipboardList, CornerDownRight, Crown, ShieldCheck } from 'lucide-react';
import { COLORS, COPY } from '../../config';
import { Glass } from '../../components/Glass';
import { MotionBlur } from '../../components/MotionBlur';
import { FONT_STACK } from '../../lib/fonts';
import { EASE, ramp, sp, SPRING } from '../../lib/motion';
import { useAbsoluteFrame } from '../../lib/timing';
import { alpha, useLayout } from '../../lib/util';
import { G } from './timeline';

/** Mini pie showing a role's slice of the hierarchy (matches the big wedges). */
const ScopePie: React.FC<{ span: number; size: number; lit: number }> = ({ span, size, lit }) => {
  const r = size / 2 - 3;
  const c = size / 2;
  const a0 = ((90 - span / 2) * Math.PI) / 180;
  const a1 = ((90 + span / 2) * Math.PI) / 180;
  const path =
    span >= 360
      ? undefined
      : `M ${c} ${c} L ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`;
  const fill = alpha(COLORS.accent, 0.35 + 0.55 * lit);
  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={alpha(COLORS.accentSoft, 0.35)} strokeWidth={1.5} />
      {span >= 360 ? <circle cx={c} cy={c} r={r} fill={fill} /> : <path d={path} fill={fill} />}
      <circle cx={c} cy={c} r={2.5} fill="#fff" />
    </svg>
  );
};

const ROLE_ICONS = [Crown, ShieldCheck, ClipboardList];
const ROLE_SPANS = [360, 120, 40];

export const GraphOverlays: React.FC = () => {
  const F = useAbsoluteFrame();
  const { cx, vertical } = useLayout();
  const out = (i: number) => ramp(F, G.overlaysOut + i * 3, G.overlaysOut + i * 3 + 22, 0, 1, EASE.in);

  // ── Headline: Zones → Markets → Employees ─────────────────────────────
  const words = COPY.structure.levels;
  const wordStart = [G.zones + 4, G.markets + 4, G.employees + 6];
  const hSize = vertical ? 58 : 80;
  const headline = words.map((w, i) => {
    const p = sp(F, wordStart[i], SPRING.snap);
    const pPrev = sp(F - 1, wordStart[i], SPRING.snap);
    const o = out(i);
    const y = (1 - p) * hSize * 0.6;
    const yPrev = (1 - pPrev) * hSize * 0.6;
    const Arrow = vertical ? ArrowRight : CornerDownRight;
    return (
      <MotionBlur key={w} vx={0} vy={y - yPrev}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: vertical ? 14 : 18,
            marginLeft: vertical ? 0 : i * 46,
            opacity: Math.min(1, p * 1.6) * (1 - o),
            transform: `translate(${-o * 40}px, ${y}px)`,
            filter: p < 0.97 || o > 0 ? `blur(${Math.max(0, (1 - p) * 12 + o * 10).toFixed(2)}px)` : undefined,
          }}
        >
          {i > 0 && <Arrow size={hSize * 0.62} color={COLORS.accent} strokeWidth={2.4} />}
          <span style={{ fontFamily: FONT_STACK, fontSize: hSize, fontWeight: 720, letterSpacing: '-0.045em', color: COLORS.text, lineHeight: 1.08 }}>{w}</span>
        </div>
      </MotionBlur>
    );
  });

  const subP = sp(F, G.admin - 14, SPRING.settle);
  const subtitle = (
    <div
      style={{
        fontFamily: FONT_STACK,
        fontSize: vertical ? 30 : 30,
        color: COLORS.textDim,
        fontWeight: 500,
        letterSpacing: '-0.01em',
        opacity: Math.min(1, subP * 1.5) * (1 - out(3)),
        transform: `translateY(${(1 - subP) * 20}px)`,
        textAlign: vertical ? 'center' : 'left',
      }}
    >
      {COPY.structure.subtitle}
    </div>
  );

  // ── Role badges ───────────────────────────────────────────────────────
  const roleStarts = [G.admin, G.rm, G.sup];
  const badgeW = vertical ? 900 : 480;
  const badges = COPY.structure.roles.map((role, i) => {
    const s = roleStarts[i] - 6;
    const p = sp(F, s, SPRING.snap);
    const pPrev = sp(F - 1, s, SPRING.snap);
    const active = F >= roleStarts[i] && (i === 2 || F < roleStarts[i + 1]);
    const lit = active ? ramp(F, roleStarts[i], roleStarts[i] + 10) : F >= roleStarts[i] ? 0.35 : 0;
    const o = out(4 + i);
    const dx = vertical ? 0 : (1 - p) * -90;
    const dy = vertical ? (1 - p) * 70 : 0;
    const dxPrev = vertical ? 0 : (1 - pPrev) * -90;
    const dyPrev = vertical ? (1 - pPrev) * 70 : 0;
    const Icon = ROLE_ICONS[i];
    if (p <= 0.001) return <div key={role.key} style={{ height: 104 }} />;
    return (
      <MotionBlur key={role.key} vx={dx - dxPrev} vy={dy - dyPrev}>
        <div style={{ transform: `translate(${dx - o * 50}px, ${dy}px)`, opacity: Math.min(1, p * 1.6) * (1 - o) }}>
          <Glass radius={22} glow={lit} style={{ width: badgeW, height: 104, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', boxSizing: 'border-box' }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                display: 'grid',
                placeItems: 'center',
                background: lit > 0.5 ? `linear-gradient(150deg, #7FA0FF, ${COLORS.accent})` : alpha(COLORS.accent, 0.14),
                border: `1px solid ${alpha(COLORS.accent, 0.5)}`,
                boxShadow: lit > 0.5 ? `0 0 26px ${alpha(COLORS.accent, 0.6 * lit)}` : undefined,
              }}
            >
              <Icon size={28} color={lit > 0.5 ? '#fff' : COLORS.accentSoft} strokeWidth={2.2} />
            </div>
            <div style={{ flex: 1, fontFamily: FONT_STACK }}>
              <div style={{ fontSize: 27, fontWeight: 720, color: COLORS.text, letterSpacing: '-0.025em' }}>{role.title}</div>
              <div style={{ fontSize: 19, color: COLORS.textDim, marginTop: 3 }}>{role.scope}</div>
            </div>
            <ScopePie span={ROLE_SPANS[i]} size={50} lit={lit} />
          </Glass>
        </div>
      </MotionBlur>
    );
  });

  // ── Workflow stepper ─────────────────────────────────────────────────
  const stepVis = ramp(F, G.stepAt(0) - 4, G.stepAt(0) + 18) * (1 - ramp(F, G.stepsOut, G.stepsOut + 20, 0, 1, EASE.in));
  const activeStep = F < G.stepAt(1) ? 0 : F < G.stepAt(2) ? 1 : 2;
  const stepLit = (i: number) => {
    const on = ramp(F, G.stepAt(i), G.stepAt(i) + 12);
    const off = i < 2 ? ramp(F, G.stepAt(i + 1), G.stepAt(i + 1) + 12) : 0;
    return Math.max(0, on - off);
  };
  const scrim = stepVis > 0.001 && (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: stepVis,
        background: vertical
          ? 'linear-gradient(180deg, rgba(6,7,11,0.82) 0%, rgba(6,7,11,0.55) 16%, rgba(6,7,11,0) 26%)'
          : 'linear-gradient(90deg, rgba(6,7,11,0.78) 0%, rgba(6,7,11,0.5) 26%, rgba(6,7,11,0) 40%)',
      }}
    />
  );
  const stepper =
    stepVis > 0.001 &&
    (vertical ? (
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, opacity: stepVis, fontFamily: FONT_STACK }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          {COPY.workflow.steps.map((t, i) => {
            const lit = stepLit(i);
            const done = activeStep > i;
            return (
              <Glass key={t} radius={999} glow={lit} fill={0.8 + lit} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 26px 14px 16px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 20, display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 800, color: '#fff', background: lit > 0.5 || done ? COLORS.accent : 'rgba(255,255,255,0.08)' }}>
                  {`0${i + 1}`}
                </div>
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: lit > 0.5 ? COLORS.text : COLORS.textDim }}>{t}</span>
              </Glass>
            );
          })}
        </div>
        <div style={{ position: 'relative', height: 80, marginTop: 26 }}>
          {COPY.workflow.stepDetails.map((d, i) => {
            const lit = stepLit(i);
            return (
              <div key={i} style={{ position: 'absolute', left: 90, right: 90, top: 0, textAlign: 'center', fontSize: 31, lineHeight: 1.3, color: COLORS.textDim, opacity: lit, transform: `translateY(${(1 - lit) * 14}px)` }}>
                {d}
              </div>
            );
          })}
        </div>
      </div>
    ) : (
      <div style={{ position: 'absolute', left: 110, top: 300, width: 560, opacity: stepVis, fontFamily: FONT_STACK }}>
        <div style={{ position: 'absolute', left: 25, top: 50, width: 2, height: 252, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{ width: 2, height: `${ramp(F, G.stepAt(0), G.stepAt(2) + 60, 0, 100, EASE.smooth)}%`, background: COLORS.accent, boxShadow: `0 0 12px ${COLORS.accent}` }} />
        </div>
        {COPY.workflow.steps.map((t, i) => {
          const lit = stepLit(i);
          const done = activeStep > i;
          return (
            <div key={t} style={{ position: 'relative', height: 150, display: 'flex', gap: 22 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#fff',
                  background: lit > 0.5 || done ? `linear-gradient(150deg, #7FA0FF, ${COLORS.accent})` : '#141826',
                  border: `1px solid ${alpha(COLORS.accent, 0.5)}`,
                  boxShadow: lit > 0.5 ? `0 0 26px ${alpha(COLORS.accent, 0.7 * lit)}` : undefined,
                  transform: `scale(${1 + 0.08 * lit})`,
                }}
              >
                {`0${i + 1}`}
              </div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: 46, fontWeight: 720, letterSpacing: '-0.04em', color: lit > 0.5 ? COLORS.text : COLORS.textFaint, lineHeight: 1.05 }}>{t}</div>
                <div style={{ fontSize: 22, color: COLORS.textDim, lineHeight: 1.35, marginTop: 8, maxWidth: 440, opacity: lit, transform: `translateY(${(1 - lit) * 10}px)` }}>
                  {COPY.workflow.stepDetails[i]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ));

  const structureVisible = F < G.overlaysOut + 40;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {structureVisible &&
        (vertical ? (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', gap: 10 }}>{headline}</div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 210 }}>{subtitle}</div>
            <div style={{ position: 'absolute', left: cx - badgeW / 2, top: 1468, display: 'flex', flexDirection: 'column', gap: 14 }}>{badges}</div>
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', left: 110, top: 150, display: 'flex', flexDirection: 'column' }}>{headline}</div>
            <div style={{ position: 'absolute', left: 112, top: 440 }}>{subtitle}</div>
            <div style={{ position: 'absolute', left: 110, top: 524, display: 'flex', flexDirection: 'column', gap: 16 }}>{badges}</div>
          </>
        ))}
      {scrim}
      {stepper}
    </AbsoluteFill>
  );
};
