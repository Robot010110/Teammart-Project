import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ArrowLeft, ArrowRight, ClipboardList, CornerDownLeft, CornerDownRight, Crown, ShieldCheck } from 'lucide-react';
import { COLORS } from '../../config';
import { Glass } from '../../components/Glass';
import { MotionBlur } from '../../components/MotionBlur';
import { useCopy, useLang, useStructure } from '../../i18n/copy';
import { FONT_STACK } from '../../lib/fonts';
import { EASE, ramp, sp, SPRING } from '../../lib/motion';
import { useAbsoluteFrame, useFrameStep } from '../../lib/timing';
import { alpha, useLayout } from '../../lib/util';
import { B3, B4 } from './beats';

/** Mini pie of a role's slice of the org (the same wedge the 3D disc lights). */
const ScopePie: React.FC<{ span: number; size: number; lit: number }> = ({ span, size, lit }) => {
  const r = size / 2 - 3;
  const c = size / 2;
  const a0 = ((90 - span / 2) * Math.PI) / 180;
  const a1 = ((90 + span / 2) * Math.PI) / 180;
  const path = `M ${c} ${c} L ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`;
  const fill = alpha(COLORS.accent, 0.35 + 0.55 * lit);
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={alpha(COLORS.accentSoft, 0.35)} strokeWidth={1.5} />
      {span >= 360 ? <circle cx={c} cy={c} r={r} fill={fill} /> : <path d={path} fill={fill} />}
      <circle cx={c} cy={c} r={2.5} fill="#fff" />
    </svg>
  );
};

const ROLE_ICONS = [Crown, ShieldCheck, ClipboardList];

/** S3: "Zones → Markets → Employees", the subtitle, and the three role badges. */
export const StructureOverlays: React.FC = () => {
  const F = useAbsoluteFrame();
  const step = useFrameStep();
  const { cx, mode, pick } = useLayout();
  const copy = useCopy();
  const { rtl } = useLang();
  const st = useStructure();
  if (F > B3.overlaysOut + 50) return null;

  const out = (i: number) => ramp(F, B3.overlaysOut + i * 3, B3.overlaysOut + i * 3 + 22, 0, 1, EASE.in);
  const side = (px: number) => (rtl ? { right: px } : { left: px });
  const dir = rtl ? -1 : 1;

  // Headline
  const wordStart = [B3.zones + 4, B3.markets + 4, B3.employees + 6];
  const hSize = pick({ landscape: 80, portrait: 58, square: 56 }) * (rtl ? 0.9 : 1);
  const stacked = mode !== 'portrait';
  const Arrow = stacked ? (rtl ? CornerDownLeft : CornerDownRight) : rtl ? ArrowLeft : ArrowRight;
  const headline = copy.structure.levels.map((w, i) => {
    const p = sp(F, wordStart[i], SPRING.snap);
    const pPrev = sp(F - step, wordStart[i], SPRING.snap);
    const o = out(i);
    const y = (1 - p) * hSize * 0.6;
    const yPrev = (1 - pPrev) * hSize * 0.6;
    return (
      <MotionBlur key={w} vx={0} vy={y - yPrev}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: hSize * 0.22,
            marginInlineStart: stacked ? i * hSize * 0.58 : 0,
            opacity: Math.min(1, p * 1.6) * (1 - o),
            transform: `translate(${-o * 40 * dir}px, ${y}px)`,
            filter: p < 0.97 || o > 0 ? `blur(${Math.max(0, (1 - p) * 12 + o * 10).toFixed(2)}px)` : undefined,
          }}
        >
          {i > 0 && <Arrow size={hSize * 0.62} color={COLORS.accent} strokeWidth={2.4} />}
          <span style={{ fontFamily: FONT_STACK, fontSize: hSize, fontWeight: 720, letterSpacing: rtl ? 0 : '-0.045em', color: COLORS.text, lineHeight: rtl ? 1.3 : 1.08 }}>
            {w}
          </span>
        </div>
      </MotionBlur>
    );
  });

  const subP = sp(F, B3.admin - 14, SPRING.settle);
  const subSize = pick({ landscape: 30, portrait: 30, square: 24 });
  const subtitle = (
    <div
      style={{
        fontFamily: FONT_STACK,
        fontSize: subSize,
        color: COLORS.textDim,
        fontWeight: 500,
        letterSpacing: rtl ? 0 : '-0.01em',
        opacity: Math.min(1, subP * 1.5) * (1 - out(3)),
        transform: `translateY(${(1 - subP) * 20}px)`,
        textAlign: mode === 'portrait' ? 'center' : 'start',
        maxWidth: pick({ landscape: 560, portrait: 900, square: 420 }),
      }}
    >
      {copy.structure.subtitle}
    </div>
  );

  // Role badges — the pie matches each role's real share of this org.
  const spans = [360, st.zoneSpan, st.marketSpan];
  const roleStarts = [B3.admin, B3.rm, B3.sup];
  const B = pick({
    landscape: { w: 500, h: 104, icon: 58, title: 27, scope: 19, gap: 16 },
    portrait: { w: 900, h: 104, icon: 58, title: 29, scope: 21, gap: 14 },
    square: { w: 420, h: 84, icon: 46, title: 22, scope: 16, gap: 10 },
  });
  const badges = copy.structure.roles.map((role, i) => {
    const s = roleStarts[i] - 6;
    const p = sp(F, s, SPRING.snap);
    const pPrev = sp(F - step, s, SPRING.snap);
    const active = F >= roleStarts[i] && (i === 2 || F < roleStarts[i + 1]);
    const lit = active ? ramp(F, roleStarts[i], roleStarts[i] + 10) : F >= roleStarts[i] ? 0.35 : 0;
    const o = out(4 + i);
    const vertical = mode === 'portrait';
    const dx = vertical ? 0 : (1 - p) * -90 * dir;
    const dy = vertical ? (1 - p) * 70 : 0;
    const dxPrev = vertical ? 0 : (1 - pPrev) * -90 * dir;
    const dyPrev = vertical ? (1 - pPrev) * 70 : 0;
    const Icon = ROLE_ICONS[i];
    if (p <= 0.001) return <div key={role.key} style={{ height: B.h }} />;
    return (
      <MotionBlur key={role.key} vx={dx - dxPrev} vy={dy - dyPrev}>
        <div style={{ transform: `translate(${dx - o * 50 * dir}px, ${dy}px)`, opacity: Math.min(1, p * 1.6) * (1 - o) }}>
          <Glass radius={22} glow={lit} style={{ width: B.w, height: B.h, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', boxSizing: 'border-box', background: 'rgba(14,17,28,0.72)' }}>
            <div
              style={{
                width: B.icon,
                height: B.icon,
                flexShrink: 0,
                borderRadius: 16,
                display: 'grid',
                placeItems: 'center',
                background: lit > 0.5 ? `linear-gradient(150deg, #7FA0FF, ${COLORS.accent})` : alpha(COLORS.accent, 0.14),
                border: `1px solid ${alpha(COLORS.accent, 0.5)}`,
                boxShadow: lit > 0.5 ? `0 0 26px ${alpha(COLORS.accent, 0.6 * lit)}` : undefined,
              }}
            >
              <Icon size={B.icon * 0.48} color={lit > 0.5 ? '#fff' : COLORS.accentSoft} strokeWidth={2.2} />
            </div>
            <div style={{ flex: 1, minWidth: 0, fontFamily: FONT_STACK }}>
              <div style={{ fontSize: B.title, fontWeight: 720, color: COLORS.text, letterSpacing: rtl ? 0 : '-0.025em', whiteSpace: 'nowrap' }}>{role.title}</div>
              <div style={{ fontSize: B.scope, color: COLORS.textDim, marginTop: 3, whiteSpace: 'nowrap' }}>{role.scope}</div>
            </div>
            <ScopePie span={spans[i]} size={B.icon * 0.86} lit={lit} />
          </Glass>
        </div>
      </MotionBlur>
    );
  });

  // A soft scrim on the text side keeps type legible over the glow.
  const scrimOn = ramp(F, B3.zones, B3.zones + 30) * (1 - ramp(F, B3.overlaysOut, B3.overlaysOut + 40));
  const scrim =
    mode === 'portrait'
      ? 'linear-gradient(180deg, rgba(6,7,11,0.7) 0%, rgba(6,7,11,0) 16%, rgba(6,7,11,0) 74%, rgba(6,7,11,0.7) 100%)'
      : `linear-gradient(${rtl ? 270 : 90}deg, rgba(6,7,11,0.72) 0%, rgba(6,7,11,0.4) 28%, rgba(6,7,11,0) 44%)`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: scrim, opacity: scrimOn }} />
      {mode === 'portrait' ? (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', gap: 10 }}>{headline}</div>
          <div style={{ position: 'absolute', left: 90, right: 90, top: 216, display: 'flex', justifyContent: 'center' }}>{subtitle}</div>
          <div style={{ position: 'absolute', left: cx - B.w / 2, top: 1468, display: 'flex', flexDirection: 'column', gap: B.gap }}>{badges}</div>
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', ...side(pick({ landscape: 110, portrait: 0, square: 60 })), top: pick({ landscape: 150, portrait: 0, square: 64 }), display: 'flex', flexDirection: 'column' }}>
            {headline}
          </div>
          <div style={{ position: 'absolute', ...side(pick({ landscape: 112, portrait: 0, square: 62 })), top: pick({ landscape: 440, portrait: 0, square: 278 }) }}>{subtitle}</div>
          <div
            style={{
              position: 'absolute',
              ...side(pick({ landscape: 110, portrait: 0, square: 60 })),
              top: pick({ landscape: 524, portrait: 0, square: 372 }),
              display: 'flex',
              flexDirection: 'column',
              gap: B.gap,
            }}
          >
            {badges}
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

/** S4: the three steps, lit one at a time. */
export const WorkflowStepper: React.FC = () => {
  const F = useAbsoluteFrame();
  const { mode, pick } = useLayout();
  const copy = useCopy();
  const { rtl } = useLang();
  const [s0, s1, s2] = B4.step;
  const stepAt = [s0, s1, s2];
  const vis = ramp(F, s0 - 4, s0 + 18) * (1 - ramp(F, B4.stepsOut, B4.stepsOut + 20, 0, 1, EASE.in));
  if (vis <= 0.001) return null;
  const activeStep = F < s1 ? 0 : F < s2 ? 1 : 2;
  const stepLit = (i: number) => {
    const on = ramp(F, stepAt[i], stepAt[i] + 12);
    const off = i < 2 ? ramp(F, stepAt[i + 1], stepAt[i + 1] + 12) : 0;
    return Math.max(0, on - off);
  };
  const side = (px: number) => (rtl ? { right: px } : { left: px });
  const scrim =
    mode === 'portrait'
      ? 'linear-gradient(180deg, rgba(6,7,11,0.85) 0%, rgba(6,7,11,0.55) 15%, rgba(6,7,11,0) 24%)'
      : `linear-gradient(${rtl ? 270 : 90}deg, rgba(6,7,11,0.8) 0%, rgba(6,7,11,0.5) 26%, rgba(6,7,11,0) 42%)`;

  const numberDot = (i: number, size: number) => {
    const lit = stepLit(i);
    const done = activeStep > i;
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: size * 0.36,
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
    );
  };

  if (mode === 'portrait') {
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <AbsoluteFill style={{ background: scrim, opacity: vis }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 110, opacity: vis, fontFamily: FONT_STACK }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
            {copy.workflow.steps.map((t, i) => {
              const lit = stepLit(i);
              return (
                <Glass key={t} radius={999} glow={lit} fill={0.8 + lit} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 12px 12px', paddingInlineStart: 12, paddingInlineEnd: 24 }}>
                  {numberDot(i, 40)}
                  <span style={{ fontSize: 29, fontWeight: 700, letterSpacing: rtl ? 0 : '-0.02em', color: lit > 0.5 ? COLORS.text : COLORS.textDim }}>{t}</span>
                </Glass>
              );
            })}
          </div>
          <div style={{ position: 'relative', height: 90, marginTop: 24 }}>
            {copy.workflow.stepDetails.map((d, i) => {
              const lit = stepLit(i);
              return (
                <div key={i} style={{ position: 'absolute', left: 80, right: 80, top: 0, textAlign: 'center', fontSize: 30, lineHeight: 1.32, color: COLORS.textDim, opacity: lit, transform: `translateY(${(1 - lit) * 14}px)` }}>
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  const S = pick({
    landscape: { left: 110, top: 290, row: 150, dot: 52, title: 46, detail: 22, maxW: 440, width: 560 },
    portrait: { left: 0, top: 0, row: 0, dot: 0, title: 0, detail: 0, maxW: 0, width: 0 },
    square: { left: 60, top: 150, row: 132, dot: 44, title: 38, detail: 19, maxW: 340, width: 420 },
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: scrim, opacity: vis }} />
      <div style={{ position: 'absolute', ...side(S.left), top: S.top, width: S.width, opacity: vis, fontFamily: FONT_STACK }}>
        <div style={{ position: 'absolute', ...side(S.dot / 2 - 1), top: S.dot, width: 2, height: S.row * 2 - S.dot / 2, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{ width: 2, height: `${ramp(F, s0, s2 + 60, 0, 100, EASE.smooth)}%`, background: COLORS.accent, boxShadow: `0 0 12px ${COLORS.accent}` }} />
        </div>
        {copy.workflow.steps.map((t, i) => {
          const lit = stepLit(i);
          return (
            <div key={t} style={{ position: 'relative', height: S.row, display: 'flex', gap: S.dot * 0.42 }}>
              {numberDot(i, S.dot)}
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: S.title, fontWeight: 720, letterSpacing: rtl ? 0 : '-0.04em', color: lit > 0.5 ? COLORS.text : COLORS.textFaint, lineHeight: rtl ? 1.25 : 1.05 }}>{t}</div>
                <div style={{ fontSize: S.detail, color: COLORS.textDim, lineHeight: 1.38, marginTop: 8, maxWidth: S.maxW, opacity: lit, transform: `translateY(${(1 - lit) * 10}px)` }}>
                  {copy.workflow.stepDetails[i]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
