import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import * as THREE from 'three';
import { ClipboardList, Play, UserRound } from 'lucide-react';
import { COLORS, LOOK } from '../../config';
import { CheckBurst } from '../../components/CheckBurst';
import { Phone, PHONE } from '../../components/Devices';
import { Glass } from '../../components/Glass';
import { MotionBlur } from '../../components/MotionBlur';
import { useCopy, useLang, useProspect, useStructure } from '../../i18n/copy';
import { FONT_STACK } from '../../lib/fonts';
import { EASE, mix, ramp, sp, SPRING } from '../../lib/motion';
import { useAbsoluteFrame, useFrameStep } from '../../lib/timing';
import { alpha, useLayout, type LayoutMode } from '../../lib/util';
import type { Structure } from '../../structure/model';
import { B3, B4 } from './beats';
import { applyCamera, cameraAt, nodeLight, nodePop, nodePos, projectPoint, scopeSectors } from './choreo';
import { StructureOverlays, WorkflowStepper } from './Overlays';
import { clipPlan, PhoneClip, type ClipId } from './PhoneClip';
import { World } from './World';

/**
 * S3 STRUCTURE + S4 WORKFLOW (0:09–0:27).
 *
 * The org is a real 3D scene (three.js): the HQ blooms from the light of
 * the beat, zones, markets and employees grow out on arcing edges, and the
 * camera flies the hierarchy while each role's scope lights up on the disc.
 * Then a task travels it — Supervisor → employee → back → zone → HQ — and
 * at each stop a phone rises out of the node playing the real app,
 * recorded end to end (scripts/record-flows.cjs).
 *
 * The WebGL layer is composited with `screen`, so it reads as light over
 * the film's own background; labels, phones and type are DOM, pinned to
 * nodes through the same camera the renderer uses.
 */

const LABEL_LIFT = [0.95, 0.62, 0.45, 0.32];

const useProjector = (F: number, mode: LayoutMode, st: Structure, mirror: boolean, W: number, H: number) => {
  const cam = useMemo(() => new THREE.PerspectiveCamera(), []);
  applyCamera(cam, cameraAt(F, mode, st, mirror), W, H);
  return (idx: number, lift = 0) => {
    const p = nodePos(st.nodes[idx]);
    return projectPoint(cam, [p[0], p[1] + lift, p[2]], W, H);
  };
};

const NodeLabel: React.FC<{ x: number; y: number; text: string; opacity: number; size: number; strong?: boolean; blur?: number }> = ({ x, y, text, opacity, size, strong, blur = 0 }) =>
  opacity <= 0.01 ? null : (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', opacity, filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined }}>
      <div
        style={{
          padding: `${size * 0.28}px ${size * 0.62}px`,
          borderRadius: 999,
          fontFamily: FONT_STACK,
          fontSize: size,
          fontWeight: strong ? 700 : 600,
          color: strong ? '#FFFFFF' : COLORS.text,
          whiteSpace: 'nowrap',
          background: strong ? alpha(COLORS.accent, 0.85) : 'rgba(12,15,26,0.72)',
          border: `1px solid ${strong ? alpha('#FFFFFF', 0.35) : 'rgba(255,255,255,0.12)'}`,
          boxShadow: strong ? `0 0 24px ${alpha(COLORS.accent, 0.6)}` : '0 6px 18px rgba(0,0,0,0.4)',
        }}
      >
        {text}
      </div>
    </div>
  );

type PhoneSpec = { id: ClipId; node: number; win: readonly [number, number]; role: string; Icon: React.ElementType };

export const GraphScene: React.FC = () => {
  const F = useAbsoluteFrame();
  const step = useFrameStep();
  const { W, H, mode, pick } = useLayout();
  const st = useStructure();
  const copy = useCopy();
  const prospect = useProspect();
  const { lang, rtl } = useLang();
  const project = useProjector(F, mode, st, rtl, W, H);
  const projectPrev = useProjector(F - step, mode, st, rtl, W, H);

  // The whole world fades out under the dashboard's arrival.
  const worldOpacity = 1 - ramp(F, B4.fade[0], B4.fade[1], 0, 1, EASE.in);
  const cs = cameraAt(F, mode, st, rtl);
  // Labels share the world's focus: soft while a phone is up.
  const labelBlur = Math.min(7, Math.max(0, cs.aperture - 0.00012) * 2600);

  // ── Labels ────────────────────────────────────────────────────────────
  const sc = scopeSectors(F);
  const inWorkflow = ramp(F, B4.push[0], B4.push[1]);
  const labelSize = pick({ landscape: 20, portrait: 24, square: 18 });
  const labels: React.ReactNode[] = [];
  st.nodes.forEach((n) => {
    const pop = nodePop(F, n);
    if (pop < 0.05) return;
    const lit = nodeLight(F, n, st);
    let show = 0;
    let strong = false;
    let text = n.label;
    if (n.level === 0) show = ramp(F, B3.hq + 24, B3.hq + 40);
    if (n.level === 1) show = 1 - 0.5 * inWorkflow * (n.idx === st.focusZone ? 0 : 1);
    if (n.level === 2 && n.zone === st.nodes[st.focusZone].zone) {
      show = Math.max(sc.rm, sc.sup, inWorkflow) * (n.idx === st.focusMarket ? 1 : 0.8);
      strong = n.idx === st.focusMarket && (sc.sup > 0.5 || inWorkflow > 0.5);
    }
    if (n.idx === st.focusEmployee) {
      text = prospect.employee;
      show = ramp(F, B4.down[0], B4.down[1]);
      strong = true;
    }
    if (show <= 0.01) return;
    const p = project(n.idx, LABEL_LIFT[n.level]);
    if (!p.visible) return;
    labels.push(
      <NodeLabel key={n.idx} x={p.x} y={p.y} text={text} size={labelSize * (n.level === 0 ? 1.1 : 1)} strong={strong} opacity={Math.min(1, pop) * show * (0.35 + 0.65 * lit)} blur={labelBlur} />,
    );
  });

  // ── Phones ────────────────────────────────────────────────────────────
  const phones: PhoneSpec[] = [
    { id: 'supervisor-assigns', node: st.focusMarket, win: B4.phoneA, role: copy.workflow.assignedBy, Icon: ClipboardList },
    { id: 'employee-completes-task', node: st.focusEmployee, win: B4.phoneB, role: prospect.employee, Icon: UserRound },
    { id: 'supervisor-approves', node: st.focusMarket, win: B4.phoneC, role: copy.workflow.assignedBy, Icon: ClipboardList },
  ];
  const P = pick({
    landscape: { x: 0.715, y: 0.535, w: 362, pill: 19 },
    portrait: { x: 0.5, y: 0.56, w: 480, pill: 26 },
    square: { x: 0.735, y: 0.53, w: 288, pill: 17 },
  });
  const slot = { x: (rtl ? 1 - P.x : P.x) * W, y: P.y * H };
  const phoneW = P.w;
  const phoneH = PHONE.h * (phoneW / PHONE.w);

  const phoneEls = phones.map((ph) => {
    const [a, b] = ph.win;
    if (F < a - 2 || F > b + 10) return null;
    const node = project(ph.node, 0.2);
    const nodePrev = projectPrev(ph.node, 0.2);
    const pIn = sp(F, a, SPRING.heavy);
    const pInPrev = sp(F - step, a, SPRING.heavy);
    const pOut = ramp(F, b - 14, b + 6, 0, 1, EASE.in);
    const pOutPrev = ramp(F - step, b - 14, b + 6, 0, 1, EASE.in);
    const k = Math.min(1, pIn) * (1 - pOut);
    const kPrev = Math.min(1, pInPrev) * (1 - pOutPrev);
    const x = mix(node.x, slot.x, k);
    const y = mix(node.y, slot.y, k);
    const xPrev = mix(nodePrev.x, slot.x, kPrev);
    const yPrev = mix(nodePrev.y, slot.y, kPrev);
    const scale = mix(0.08, 1, pIn) * mix(1, 0.08, pOut);
    const tilt = (1 - Math.min(1, pIn)) * (rtl ? 22 : -22) + pOut * (rtl ? -18 : 18);
    const opacity = Math.min(1, pIn * 2) * (1 - ramp(pOut, 0.6, 1));
    const { speed } = clipPlan(lang, ph.id, a + 10, b - 10);
    const pillP = sp(F, a + 14, SPRING.snap) * (1 - ramp(F, b - 16, b - 4));
    // Leader from the node to the phone, so the device reads as "inside" that node.
    const leader = ramp(F, a + 8, a + 22) * (1 - ramp(F, b - 18, b - 8));
    const edgeX = slot.x + (node.x < slot.x ? -1 : 1) * (phoneW / 2);
    return (
      <React.Fragment key={ph.id}>
        {leader > 0.01 && (
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <defs>
              <linearGradient id={`lead-${ph.id}`} gradientUnits="userSpaceOnUse" x1={node.x} y1={node.y} x2={edgeX} y2={slot.y}>
                <stop offset="0" stopColor="#DCE5FF" stopOpacity={0.9} />
                <stop offset="1" stopColor={COLORS.accent} stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <path
              d={`M ${node.x} ${node.y} C ${mix(node.x, edgeX, 0.5)} ${node.y}, ${mix(node.x, edgeX, 0.5)} ${slot.y}, ${edgeX} ${slot.y}`}
              fill="none"
              stroke={`url(#lead-${ph.id})`}
              strokeWidth={2}
              strokeDasharray="5 7"
              opacity={leader}
            />
            <circle cx={node.x} cy={node.y} r={6 * leader} fill="#FFFFFF" style={{ filter: `drop-shadow(0 0 8px ${COLORS.accent})` }} />
          </svg>
        )}
        <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: 20 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)' }}>
            <MotionBlur vx={x - xPrev} vy={y - yPrev} amount={1.2}>
              <div style={{ transform: `perspective(1800px) rotateY(${tilt}deg) scale(${scale})`, opacity }}>
                <Phone width={phoneW}>
                  <PhoneClip id={ph.id} F={F} from={a + 10} to={b - 10} />
                </Phone>
              </div>
            </MotionBlur>
          </div>
          {pillP > 0.01 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: -phoneH / 2 - P.pill * 3.6,
                transform: `translate(-50%, ${(1 - pillP) * 14}px)`,
                opacity: Math.min(1, pillP * 1.6),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                fontFamily: FONT_STACK,
                whiteSpace: 'nowrap',
              }}
            >
              <Glass radius={999} glow={0.6} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `${P.pill * 0.4}px ${P.pill * 0.9}px`, background: 'rgba(16,19,30,0.86)' }}>
                <ph.Icon size={P.pill} color={COLORS.accentSoft} strokeWidth={2.3} />
                <span style={{ fontSize: P.pill, fontWeight: 700, color: COLORS.text }}>{ph.role}</span>
              </Glass>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: P.pill * 0.72, fontWeight: 600, color: COLORS.textDim }}>
                <Play size={P.pill * 0.62} fill={COLORS.accentSoft} color={COLORS.accentSoft} />
                {copy.workflow.realBadge.replace('{speed}', speed.toFixed(1))}
              </span>
            </div>
          )}
        </div>
      </React.Fragment>
    );
  });

  // ── Approved: burst on the market, then the news travels up ──────────
  const market = project(st.focusMarket, 0.2);
  const approvedP = sp(F, B4.approvedText, SPRING.snap) * (1 - ramp(F, B4.stepsOut + 10, B4.stepsOut + 30, 0, 1, EASE.in));
  const burstSize = pick({ landscape: 120, portrait: 140, square: 100 });
  const approved = F >= B4.check - 2 && F < B4.stepsOut + 34 && (
    <>
      <div style={{ position: 'absolute', left: market.x, top: market.y }}>
        <CheckBurst frame={F} start={B4.check} size={burstSize} />
      </div>
      {approvedP > 0.01 && (
        <div
          style={{
            position: 'absolute',
            top: market.y - burstSize * 0.42,
            ...(rtl ? { right: W - market.x + burstSize * 0.72 } : { left: market.x + burstSize * 0.72 }),
            opacity: Math.min(1, approvedP * 1.5),
            transform: `translateX(${(1 - approvedP) * (rtl ? 30 : -30)}px)`,
            fontFamily: FONT_STACK,
          }}
        >
          <div style={{ fontSize: burstSize * 0.4, fontWeight: 760, color: COLORS.text, letterSpacing: rtl ? 0 : '-0.035em', lineHeight: 1.1 }}>{copy.workflow.approvedLabel}</div>
          <div style={{ marginTop: 6, fontSize: burstSize * 0.17, fontWeight: 600, color: COLORS.accentSoft, whiteSpace: 'nowrap' }}>{copy.workflow.approvedDetail}</div>
        </div>
      )}
    </>
  );

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ mixBlendMode: 'screen', opacity: worldOpacity }}>
        <ThreeCanvas width={W} height={H} dpr={LOOK.scale3d} flat gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}>
          <World F={F} step={step} st={st} mode={mode} mirror={rtl} W={W} H={H} samples={LOOK.motionBlurSamples3d} bloom={LOOK.bloom} />
        </ThreeCanvas>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: worldOpacity, pointerEvents: 'none' }}>{labels}</AbsoluteFill>
      <StructureOverlays />
      <WorkflowStepper />
      <AbsoluteFill style={{ opacity: worldOpacity }}>
        {approved}
        {phoneEls}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
