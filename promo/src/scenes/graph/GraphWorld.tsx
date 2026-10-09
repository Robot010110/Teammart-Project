import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Check, Clock, Layers, MapPin, Package, Store, Undo2 } from 'lucide-react';
import { COLORS, COPY } from '../../config';
import { CheckBurst, Tap } from '../../components/CheckBurst';
import { Phone, PHONE } from '../../components/Devices';
import { Glass } from '../../components/Glass';
import { LogoMark } from '../../components/Logo';
import { MotionBlur } from '../../components/MotionBlur';
import { dofBlur, project, Projected } from '../../lib/camera';
import { FONT_STACK } from '../../lib/fonts';
import { EASE, mix, pulse, ramp, sp, SPRING, stagger } from '../../lib/motion';
import { useAbsoluteFrame } from '../../lib/timing';
import { alpha, useLayout } from '../../lib/util';
import { DEPTH, EDGES, GNode, HQ, Level, NODES, polar, RADII, RM_SPAN, RM_ZONE, SUP_MARKET, SUP_SPAN } from './model';
import { PHONE_CARD_CENTER, PhoneTask } from './PhoneTask';
import { cameraAt, dofAt, G } from './timeline';

/**
 * S3 STRUCTURE + S4 WORKFLOW share one world: the radial hierarchy, its
 * camera, and every object that travels through it.
 */

const edgeStart = (n: GNode) =>
  n.level === 1 ? stagger(G.zones, n.order, G.zoneGap) : n.level === 2 ? stagger(G.markets, n.order, G.marketGap) : stagger(G.employees, n.order, G.employeeGap);
const edgeDur = (lv: Level) => (lv === 1 ? G.zoneDraw : lv === 2 ? G.marketDraw : G.employeeDraw);
const popAt = (n: GNode) => (n.level === 0 ? G.hqPop : edgeStart(n) + edgeDur(n.level) * 0.78);

const cubic = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

type Pt = { x: number; y: number };

/** Point at arc-length fraction `frac` of a cubic Bézier (sampled). */
const pointAtFrac = (p0: Pt, c1: Pt, c2: Pt, p3: Pt, frac: number): Pt => {
  const N = 20;
  const pts: Pt[] = [];
  const acc: number[] = [0];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push({ x: cubic(p0.x, c1.x, c2.x, p3.x, t), y: cubic(p0.y, c1.y, c2.y, p3.y, t) });
    if (i > 0) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const target = frac * acc[N];
  for (let i = 1; i <= N; i++) {
    if (acc[i] >= target) {
      const k = (target - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
      return { x: mix(pts[i - 1].x, pts[i].x, k), y: mix(pts[i - 1].y, pts[i].y, k) };
    }
  }
  return p3;
};

const sectorPath = (c: Pt, r0: number, r1: number, a0: number, a1: number) => {
  const pt = (r: number, a: number) => `${(c.x + r * Math.cos((a * Math.PI) / 180)).toFixed(2)} ${(c.y + r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${pt(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${pt(r1, a1)} L ${pt(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${pt(r0, a0)} Z`;
};

const NodeView: React.FC<{ n: GNode; frame: number }> = ({ n, frame }) => {
  if (n.level === 0) {
    return (
      <Glass radius={48} glow={0.8} style={{ width: 96, height: 96, display: 'grid', placeItems: 'center', borderRadius: 48 }}>
        <LogoMark size={54} frame={frame} start={G.hqPop + 2} glow={0.6} />
      </Glass>
    );
  }
  if (n.level === 1) {
    return (
      <div
        style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(circle at 50% 30%, #22305A, #10172A 70%)',
          border: `1.5px solid ${alpha(COLORS.accent, 0.75)}`,
          boxShadow: `0 0 28px ${alpha(COLORS.accent, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.15)`,
        }}
      >
        <Layers size={27} color={COLORS.accentSoft} strokeWidth={2.1} />
      </div>
    );
  }
  if (n.level === 2) {
    return (
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(circle at 50% 30%, #1C2644, #111829 70%)',
          border: `1px solid ${alpha(COLORS.accentSoft, 0.5)}`,
          boxShadow: `0 0 18px ${alpha(COLORS.accent, 0.22)}`,
        }}
      >
        <Store size={20} color={COLORS.accentSoft} strokeWidth={2.1} />
      </div>
    );
  }
  return (
    <div
      style={{
        width: 17,
        height: 17,
        borderRadius: 9,
        background: 'radial-gradient(circle at 40% 35%, #E3EAFF, #7E9BFF 70%)',
        boxShadow: `0 0 12px ${alpha(COLORS.accent, 0.7)}`,
      }}
    />
  );
};

const TaskCard: React.FC<{ width: number }> = ({ width }) => {
  const T = COPY.workflow.task;
  return (
    <Glass radius={22} glow={0.55} style={{ width, padding: 20, boxSizing: 'border-box', fontFamily: FONT_STACK, color: COLORS.text }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: alpha(COLORS.accent, 0.16), border: `1px solid ${alpha(COLORS.accent, 0.4)}`, display: 'grid', placeItems: 'center' }}>
          <Package size={26} color={COLORS.accentSoft} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 25, fontWeight: 750, letterSpacing: '-0.025em' }}>{T.title}</div>
          <div style={{ fontSize: 16, color: COLORS.textDim, marginTop: 2 }}>{T.category}</div>
        </div>
        <div style={{ padding: '5px 12px', borderRadius: 999, fontSize: 15, fontWeight: 750, color: COLORS.warm, background: alpha(COLORS.warm, 0.14), border: `1px solid ${alpha(COLORS.warm, 0.35)}` }}>
          {T.priority}
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '16px 0 14px' }} />
      <div style={{ display: 'flex', gap: 22, fontSize: 16, color: COLORS.textDim, fontWeight: 550 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <MapPin size={17} /> {T.location}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: COLORS.warm }}>
          <Clock size={17} /> {T.due}
        </span>
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: COLORS.textDim }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: alpha(COLORS.accent, 0.3), display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: COLORS.text }}>RM</div>
        {COPY.workflow.assignedBy} → <span style={{ color: COLORS.text, fontWeight: 650 }}>{COPY.workflow.assignee}</span>
      </div>
    </Glass>
  );
};

const ApprovalCard: React.FC<{ width: number; frame: number }> = ({ width, frame }) => {
  const press = pulse(frame, G.approveTap - 1, G.approveTap + 10, 0.3);
  return (
    <Glass radius={22} glow={0.5} style={{ width, padding: 20, boxSizing: 'border-box', fontFamily: FONT_STACK, color: COLORS.text }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(180deg, #DDE6F0, #B7C5D6)', position: 'relative', flexShrink: 0 }}>
          {[0, 1].map((r) => (
            <div key={r} style={{ position: 'absolute', left: 5, right: 5, top: 6 + r * 29, height: 24, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ flex: 1, height: `${65 + ((i * 29 + r * 11) % 30)}%`, borderRadius: 2, background: ['#fff', '#2F6FED', '#F4F7FB', '#F3B23E'][(i + r) % 4] }} />
              ))}
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 23, fontWeight: 750, letterSpacing: '-0.02em' }}>{COPY.workflow.task.title}</div>
          <div style={{ fontSize: 15.5, color: COLORS.textDim, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={16} color={COLORS.accentSoft} strokeWidth={3} /> Completed by {COPY.workflow.assignee} · photo attached
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
        <div style={{ flex: 1, height: 48, borderRadius: 13, border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, fontWeight: 650, color: COLORS.textDim }}>
          <Undo2 size={17} /> Return
        </div>
        <div
          style={{
            flex: 1.4,
            height: 48,
            borderRadius: 13,
            background: `linear-gradient(180deg, #6B90FF, ${COLORS.accent})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 17,
            fontWeight: 750,
            boxShadow: `0 10px 30px -8px ${alpha(COLORS.accent, 0.8)}`,
            transform: `scale(${1 - 0.05 * press})`,
          }}
        >
          <Check size={18} strokeWidth={3} /> {COPY.workflow.approveButton}
        </div>
      </div>
    </Glass>
  );
};

export const GraphWorld: React.FC = () => {
  const F = useAbsoluteFrame();
  const layout = useLayout();
  const { W, H, cx, cy, vertical } = layout;

  const projAt = (f: number) => {
    const { cam, o } = cameraAt(f, layout);
    return (n: GNode): Projected => project(n.x, n.y, DEPTH[n.level], cam, o.x, o.y);
  };
  const shot = cameraAt(F, layout);
  const { cam, o } = shot;
  const proj = projAt(F);
  const P = NODES.map(proj);
  const dof = dofAt(F);

  // ── Scopes & dimming ──────────────────────────────────────────────────
  const adminT = sp(F, G.admin, SPRING.settle);
  const rmT = sp(F, G.rm, SPRING.settle);
  const supT = sp(F, G.sup, SPRING.settle);
  const restore = ramp(F, G.pull[0], G.pull[1], 0, 1, EASE.smooth);
  const supMarket = NODES[SUP_MARKET].market;
  const nodeAlpha = (n: GNode) => {
    const inRM = n.zone === 2;
    const inSup = n.idx === RM_ZONE || n.market === supMarket;
    let a = mix(1, inRM ? 1 : n.level === 0 ? 0.5 : 0.3, Math.min(1, rmT));
    a *= mix(1, inSup || !inRM ? 1 : 0.62, Math.min(1, supT));
    return mix(a, 1, restore);
  };
  const scopeFade = 1 - ramp(F, G.push[0], G.push[0] + G.len(40), 0, 0.75, EASE.smooth) - 0.25 * restore;

  // Workflow glow on the RM → Supervisor branch.
  const flash = pulse(F, G.check + 4, G.check + G.len(56), 0.2);
  const wireDown = pulse(F, G.down[0] - 4, G.down[1] + 12, 0.6);
  const wireUp = pulse(F, G.up[0] - 4, G.up[1] + 12, 0.6);
  const branchGlow = (from: number, to: number) => {
    const n = NODES[to];
    if (from === RM_ZONE && to === SUP_MARKET) return Math.max(wireDown, wireUp, flash);
    if (n.level === 3 && n.market === supMarket) return flash * 0.85;
    return 0;
  };

  // Phone presence drives the world's dim/blur.
  const phoneIn = sp(F, G.phoneIn, SPRING.heavy);
  const phoneOut = ramp(F, G.phoneOut, G.phoneOut + G.len(36), 0, 1, EASE.in);
  const phoneUp = Math.min(1, phoneIn) * (1 - phoneOut);

  // Fast pull-back → radial smear.
  const camPrev = cameraAt(F - 1, layout).cam;
  const zoomSpeed = Math.abs(Math.log(cam.zoom) - Math.log(camPrev.zoom));
  const pullBlur = F >= G.pull[0] ? Math.min(11, zoomSpeed * 240) : Math.min(2.5, zoomSpeed * 90);
  const worldOpacity = 1 - ramp(F, G.bgFade[0], G.bgFade[1], 0, 0.82, EASE.smooth) - ramp(F, G.bgFade[1], G.end, 0, 0.18);
  const worldFilter = phoneUp * 7 + pullBlur;

  const levelBlur = (lv: number) => dofBlur(DEPTH[lv], dof.focus, dof.strength, cam.zoom);

  // ── Edges (screen space; endpoints live on different parallax planes) ──
  const edgesByLevel: Record<number, React.ReactNode[]> = { 1: [], 2: [], 3: [] };
  const heads: React.ReactNode[] = [];
  EDGES.forEach((e, i) => {
    const a = NODES[e.from];
    const b = NODES[e.to];
    const t = ramp(F, edgeStart(b), edgeStart(b) + edgeDur(b.level), 0, 1, EASE.out);
    if (t <= 0) return;
    const pa = P[e.from];
    const pb = P[e.to];
    const rMid = (RADII[a.level] + RADII[b.level]) / 2;
    const pMid = (DEPTH[a.level] + DEPTH[b.level]) / 2;
    const w1 = polar(rMid, a.level === 0 ? b.angle : a.angle);
    const w2 = polar(rMid, b.angle);
    const c1 = project(w1.x, w1.y, pMid, cam, o.x, o.y);
    const c2 = project(w2.x, w2.y, pMid, cam, o.x, o.y);
    const d = `M ${pa.x.toFixed(2)} ${pa.y.toFixed(2)} C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)} ${c2.x.toFixed(2)} ${c2.y.toFixed(2)} ${pb.x.toFixed(2)} ${pb.y.toFixed(2)}`;
    const al = Math.min(nodeAlpha(a), nodeAlpha(b));
    const glow = branchGlow(e.from, e.to);
    const sw = (e.level === 3 ? 1.2 : 1.6) * Math.min(2.4, pb.s);
    edgesByLevel[e.level].push(
      <g key={i}>
        {glow > 0.01 && <path d={d} stroke={alpha(COLORS.accent, 0.35 * glow)} strokeWidth={sw * 7} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - t} />}
        <path
          d={d}
          stroke={glow > 0.01 ? alpha('#DCE5FF', 0.5 + 0.5 * glow) : alpha(COLORS.accentSoft, (e.level === 3 ? 0.22 : 0.34) * al)}
          strokeWidth={sw * (1 + glow * 0.8)}
          fill="none"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - t}
        />
      </g>,
    );
    if (t > 0 && t < 1) {
      const h = pointAtFrac(pa, c1, c2, pb, t);
      const r = (e.level === 3 ? 2.6 : 3.6) * Math.min(2, pb.s);
      heads.push(<circle key={`h${i}`} cx={h.x} cy={h.y} r={r} fill="#FFFFFF" style={{ filter: `drop-shadow(0 0 ${6 * r}px ${COLORS.accent})` }} />);
    }
  });

  // ── Ring guides ──────────────────────────────────────────────────────
  const rings = ([1, 2, 3] as Level[]).map((lv) => {
    const c = project(0, 0, DEPTH[lv], cam, o.x, o.y);
    const start = lv === 1 ? G.zones : lv === 2 ? G.markets : G.employees;
    const t = ramp(F, start - 6, start + 50, 0, 1, EASE.out);
    if (t <= 0) return null;
    return (
      <circle
        key={lv}
        cx={c.x}
        cy={c.y}
        r={RADII[lv] * c.s}
        fill="none"
        stroke={alpha(COLORS.accentSoft, 0.07)}
        strokeWidth={1}
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - t}
        transform={`rotate(-90 ${c.x} ${c.y})`}
      />
    );
  });

  // ── Scopes (drawn on the market plane) ───────────────────────────────
  const sc = project(0, 0, 1, cam, o.x, o.y);
  const outerR = (RADII[3] + 50) * sc.s;
  const rotDeg = cam.rot;
  const rmSpan = RM_SPAN * sp(F, G.rm, SPRING.snap);
  const supSpan = SUP_SPAN * sp(F, G.sup, SPRING.snap);
  const sweep = ramp(F, G.admin + 2, G.admin + G.len(62), 0, 1, EASE.inOut);

  // ── Labels ───────────────────────────────────────────────────────────
  const labelFor = (n: GNode) => {
    if (n.level !== 1 && n.level !== 2) return null;
    const off = n.level === 1 ? 24 : 9.5;
    const w = polar(n.r, n.angle + off);
    const pp = project(w.x, w.y, DEPTH[n.level], cam, o.x, o.y);
    const pop = sp(F, popAt(n) + 4, SPRING.snap);
    if (pop <= 0.01) return null;
    const size = (n.level === 1 ? 21 : 14) * Math.min(1.9, pp.s);
    return (
      <div
        key={`l${n.idx}`}
        style={{
          position: 'absolute',
          left: pp.x,
          top: pp.y,
          transform: `translate(-50%, -50%) scale(${0.8 + 0.2 * pop})`,
          opacity: Math.min(1, pop) * nodeAlpha(n) * (n.level === 2 ? 0.75 : 1),
          fontFamily: FONT_STACK,
          fontSize: size,
          fontWeight: n.level === 1 ? 700 : 600,
          letterSpacing: n.level === 1 ? '-0.01em' : '0.04em',
          color: n.level === 1 ? COLORS.text : COLORS.textDim,
          whiteSpace: 'nowrap',
        }}
      >
        {n.label}
      </div>
    );
  };

  // ── Workflow objects ─────────────────────────────────────────────────
  const rmP = P[RM_ZONE];
  const supP = P[SUP_MARKET];

  const phoneW = vertical ? 590 : 396;
  const phoneH = PHONE.h * (phoneW / PHONE.w);
  const rest = vertical ? { x: cx, y: cy + 150 } : { x: cx + 160, y: cy + 4 };
  const phonePos = (f: number) => {
    const pIn = Math.min(1.2, sp(f, G.phoneIn, SPRING.heavy));
    const pOut = ramp(f, G.phoneOut, G.phoneOut + G.len(36), 0, 1, EASE.in);
    const k = pIn * (1 - pOut);
    const node = projAt(f)(NODES[SUP_MARKET]);
    return { x: mix(node.x, rest.x, k), y: mix(node.y, rest.y, k) + Math.sin(f * 0.03) * 5 * k, k };
  };
  const ph = phonePos(F);
  const phPrev = phonePos(F - 1);
  // Slow push on the phone while the Supervisor works (UI gets bigger, more legible).
  const phonePush = (f: number) => 1 + 0.08 * ramp(f, G.detail, G.tapDone + 20, 0, 1, EASE.smooth);
  const phoneScale = mix(0.06, 1, Math.max(0, ph.k)) * phonePush(F);
  const cardScreen = (f: number) => {
    const p = phonePos(f);
    const s = mix(0.06, 1, Math.max(0, p.k)) * phonePush(f) * (phoneW / PHONE.w);
    return {
      x: p.x - (PHONE.w / 2) * s + (PHONE.bezel + PHONE_CARD_CENTER.x) * s,
      y: p.y - (PHONE.h / 2) * s + (PHONE.bezel + PHONE.statusH + PHONE_CARD_CENTER.y) * s,
    };
  };

  // The packet: down the wire on assign, back up through the market on complete.
  const chipStart = cardScreen(G.lift + 14);
  const packetPos = (f: number): Pt | null => {
    const pr = projAt(f);
    const rm = pr(NODES[RM_ZONE]);
    const sm = pr(NODES[SUP_MARKET]);
    if (f >= G.cardOut + 2 && f <= G.down[1] + 2) {
      const t = ramp(f, G.down[0], G.down[1], 0, 1, EASE.inOut);
      return { x: mix(rm.x, sm.x, t), y: mix(rm.y, sm.y, t) };
    }
    if (f >= G.up[0] && f <= G.up[1] + 2) {
      const t = ramp(f, G.up[0], G.up[1], 0, 1, EASE.inOut);
      const u = 1 - t;
      return {
        x: u * u * chipStart.x + 2 * u * t * sm.x + t * t * rm.x,
        y: u * u * chipStart.y + 2 * u * t * sm.y + t * t * rm.y,
      };
    }
    return null;
  };
  const pk = packetPos(F);
  const pkPrev = packetPos(F - 1) ?? pk;
  const packetGrow = ramp(F, G.cardOut + 2, G.cardOut + 12, 0.3, 1, EASE.out) * (1 - ramp(F, G.down[1], G.down[1] + 4)) +
    (F >= G.up[0] ? 1 - ramp(F, G.up[1], G.up[1] + 4) : 0);

  // Task card at the RM node.
  const cardP = sp(F, G.cardIn, SPRING.snap);
  const cardQ = ramp(F, G.cardOut, G.cardOut + G.len(12), 0, 1, EASE.in);
  const cardW = vertical ? 560 : 460;

  // Chip lifting off the phone.
  const chipT = sp(F, G.lift + 6, SPRING.snap);
  const chipQ = ramp(F, G.up[0] - 2, G.up[0] + 8, 0, 1, EASE.in);
  const chipPos = { x: chipStart.x, y: chipStart.y - 70 * chipT * (vertical ? 1.4 : 1) };

  const apIn = sp(F, G.approveIn, SPRING.snap);
  const apOut = ramp(F, G.check - 2, G.check + G.len(12), 0, 1, EASE.in);
  const apW = vertical ? 580 : 470;
  const approvedP = sp(F, G.approvedText, SPRING.snap);
  const approvedOut = ramp(F, G.pull[0] - 6, G.pull[0] + G.len(14), 0, 1, EASE.in);

  return (
    <AbsoluteFill style={{ opacity: worldOpacity }}>
      {/* The world (dims and defocuses when the phone takes the stage). */}
      <AbsoluteFill style={{ opacity: 1 - 0.42 * phoneUp, filter: worldFilter > 0.3 ? `blur(${worldFilter.toFixed(2)}px)` : undefined }}>
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          {rings}
          {/* Admin: the whole disc */}
          {adminT > 0.01 && scopeFade > 0.01 && (
            <g opacity={scopeFade}>
              <circle cx={sc.x} cy={sc.y} r={outerR * Math.min(1, adminT)} fill={alpha(COLORS.accent, 0.075 * (1 - 0.65 * Math.min(1, rmT)))} />
              <circle cx={sc.x} cy={sc.y} r={outerR * Math.min(1, adminT)} fill="none" stroke={alpha(COLORS.accentSoft, 0.55 * (1 - 0.55 * Math.min(1, rmT)))} strokeWidth={1.5} />
            </g>
          )}
          {/* Regional Manager: one zone's wedge */}
          {rmSpan > 0.2 && scopeFade > 0.01 && (
            <path
              d={sectorPath(sc, (RADII[1] - 48) * sc.s, outerR, 90 + rotDeg - rmSpan, 90 + rotDeg + rmSpan)}
              fill={alpha(COLORS.accent, 0.13)}
              stroke={alpha(COLORS.accentSoft, 0.8)}
              strokeWidth={1.5}
              opacity={scopeFade}
            />
          )}
          {/* Supervisor: one market's wedge */}
          {supSpan > 0.2 && scopeFade > 0.01 && (
            <path
              d={sectorPath(sc, (RADII[2] - 40) * sc.s, outerR - 4, 90 + rotDeg - supSpan, 90 + rotDeg + supSpan)}
              fill={alpha('#DCE5FF', 0.1)}
              stroke={alpha('#FFFFFF', 0.85)}
              strokeWidth={1.6}
              opacity={scopeFade}
            />
          )}
        </svg>
        {/* Admin sweep beam */}
        {sweep > 0 && sweep < 1 && (
          <div
            style={{
              position: 'absolute',
              left: sc.x - outerR,
              top: sc.y - outerR,
              width: outerR * 2,
              height: outerR * 2,
              borderRadius: '50%',
              opacity: Math.sin(sweep * Math.PI),
              background: `conic-gradient(from ${sweep * 360}deg, transparent 0deg, transparent 300deg, ${alpha(COLORS.accent, 0.38)} 359deg, transparent 360deg)`,
            }}
          />
        )}

        {/* Bloom: the point of light becomes the HQ node. SFX: bloom-whomp */}
        {(() => {
          const t = ramp(F, G.start - 2, G.start + G.len(40), 0, 1, EASE.out);
          if (t <= 0 || t >= 1) return null;
          const hq = P[HQ];
          const r = (RADII[1] + 40) * Math.pow(cam.zoom, DEPTH[1]) * t;
          const g = 260 * (0.4 + t);
          return (
            <>
              <div style={{ position: 'absolute', left: hq.x - g, top: hq.y - g, width: g * 2, height: g * 2, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,255,255,${0.35 * (1 - t)}) 0%, ${alpha(COLORS.accent, 0.3 * (1 - t))} 30%, transparent 65%)` }} />
              <div style={{ position: 'absolute', left: hq.x - r, top: hq.y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: `2px solid ${alpha(COLORS.accentSoft, 0.75 * (1 - t))}`, boxShadow: `0 0 50px ${alpha(COLORS.accent, 0.45 * (1 - t))}, inset 0 0 40px ${alpha(COLORS.accent, 0.25 * (1 - t))}` }} />
            </>
          );
        })()}

        {([1, 2, 3] as Level[]).map((lv) => {
          const bl = (levelBlur(lv) + levelBlur(lv - 1)) / 2;
          return (
            <svg key={lv} width={W} height={H} style={{ position: 'absolute', inset: 0, filter: bl > 0.3 ? `blur(${bl.toFixed(2)}px)` : undefined }}>
              {edgesByLevel[lv]}
            </svg>
          );
        })}
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          {heads}
        </svg>

        {([3, 2, 1, 0] as Level[]).map((lv) => {
          const bl = levelBlur(lv);
          return (
            <AbsoluteFill key={lv} style={{ filter: bl > 0.3 ? `blur(${bl.toFixed(2)}px)` : undefined }}>
              {NODES.filter((n) => n.level === lv).map((n) => {
                const pop = sp(F, popAt(n), SPRING.pop);
                if (pop <= 0.001) return null;
                const pp = P[n.idx];
                const ring = ramp(F, popAt(n), popAt(n) + 30, 0, 1, EASE.out);
                const nodeGlow = n.idx === RM_ZONE ? pulse(F, G.check, G.check + 40, 0.2) : 0;
                return (
                  <div
                    key={n.idx}
                    style={{
                      position: 'absolute',
                      left: pp.x,
                      top: pp.y,
                      width: 0,
                      height: 0,
                      opacity: nodeAlpha(n),
                    }}
                  >
                    {lv <= 2 && ring > 0 && ring < 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: -40 * pp.s * (0.6 + ring),
                          top: -40 * pp.s * (0.6 + ring),
                          width: 80 * pp.s * (0.6 + ring),
                          height: 80 * pp.s * (0.6 + ring),
                          borderRadius: '50%',
                          border: `1.5px solid ${alpha(COLORS.accentSoft, 0.6 * (1 - ring))}`,
                        }}
                      />
                    )}
                    <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(-50%, -50%) scale(${pp.s * pop * (1 + 0.15 * nodeGlow)})` }}>
                      <NodeView n={n} frame={F} />
                    </div>
                  </div>
                );
              })}
              {NODES.filter((n) => n.level === lv).map(labelFor)}
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>

      {/* ── Workflow: assign ─────────────────────────────────────────── */}
      {F >= G.cardIn - 1 && cardQ < 1 && (
        <div
          style={{
            position: 'absolute',
            left: vertical ? rmP.x - cardW / 2 : rmP.x + 72,
            top: vertical ? rmP.y - 330 : rmP.y - 112,
            transformOrigin: vertical ? '50% 100%' : '0% 50%',
            transform: `translate(${vertical ? 0 : (1 - cardP) * -50}px, ${vertical ? (1 - cardP) * 50 : 0}px) scale(${(0.7 + 0.3 * cardP) * (1 - 0.9 * cardQ)})`,
            opacity: Math.min(1, cardP * 1.5) * (1 - cardQ),
          }}
        >
          <TaskCard width={cardW} />
        </div>
      )}

      {/* ── Workflow: complete (the phone) ───────────────────────────── */}
      {F >= G.phoneIn && ph.k > 0.02 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: ph.x - phoneW * 0.62,
              top: ph.y + phoneH * 0.4,
              width: phoneW * 1.24,
              height: phoneW * 0.34,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)',
              transform: `scale(${phoneScale})`,
              opacity: phoneScale,
            }}
          />
          <div style={{ position: 'absolute', left: ph.x, top: ph.y, width: 0, height: 0 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)' }}>
              <MotionBlur vx={ph.x - phPrev.x} vy={ph.y - phPrev.y}>
                <div
                  style={{
                    transform: `perspective(2200px) rotateX(${26 * (1 - Math.min(1, ph.k))}deg) rotateY(${4 * Math.sin((F - G.phoneIn) * 0.018) * Math.min(1, ph.k)}deg) scale(${phoneScale})`,
                    opacity: Math.min(1, ph.k * 2.5),
                  }}
                >
                  <Phone width={phoneW}>
                    <PhoneTask frame={F} />
                  </Phone>
                </div>
              </MotionBlur>
            </div>
          </div>
        </>
      )}

      {/* ── Packet ───────────────────────────────────────────────────── */}
      {pk && packetGrow > 0.01 && (
        <div style={{ position: 'absolute', left: pk.x, top: pk.y, width: 0, height: 0 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)' }}>
            <MotionBlur vx={pk.x - (pkPrev?.x ?? pk.x)} vy={pk.y - (pkPrev?.y ?? pk.y)} amount={1.5}>
              <div style={{ width: 120, height: 120, position: 'relative', transform: `scale(${packetGrow})` }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, ${alpha(COLORS.accent, 0.8)} 16%, ${alpha(COLORS.accent, 0.18)} 42%, transparent 68%)` }} />
                <div style={{ position: 'absolute', left: 46, top: 46, width: 28, height: 28, borderRadius: 14, background: '#fff', display: 'grid', placeItems: 'center' }}>
                  {F >= G.up[0] ? <Check size={18} color={COLORS.accent} strokeWidth={3.4} /> : <Package size={16} color={COLORS.accent} strokeWidth={2.6} />}
                </div>
              </div>
            </MotionBlur>
          </div>
        </div>
      )}
      {/* Impact ripple when the packet lands. */}
      {(() => {
        const t = ramp(F, G.down[1], G.down[1] + 26, 0, 1, EASE.out);
        if (t <= 0 || t >= 1) return null;
        const r = 30 + 160 * t;
        return <div style={{ position: 'absolute', left: supP.x - r, top: supP.y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: `2px solid ${alpha(COLORS.accentSoft, 0.8 * (1 - t))}` }} />;
      })()}

      {/* Chip lifting off the phone. */}
      {F >= G.lift + 6 && chipQ < 1 && (
        <div
          style={{
            position: 'absolute',
            left: chipPos.x,
            top: chipPos.y,
            transform: `translate(-50%, -50%) scale(${(0.6 + 0.4 * chipT) * (1 - 0.85 * chipQ)})`,
            opacity: Math.min(1, chipT * 1.5) * (1 - chipQ),
          }}
        >
          <Glass radius={999} glow={0.9} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 22px 12px 14px', fontFamily: FONT_STACK, fontSize: vertical ? 26 : 21, fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap' }}>
            <div style={{ width: 30, height: 30, borderRadius: 15, background: COLORS.accent, display: 'grid', placeItems: 'center' }}>
              <Check size={18} color="#fff" strokeWidth={3.2} />
            </div>
            {COPY.workflow.task.title}
          </Glass>
        </div>
      )}

      {/* ── Workflow: approve ────────────────────────────────────────── */}
      {F >= G.approveIn - 1 && apOut < 1 && (
        <div
          style={{
            position: 'absolute',
            left: vertical ? rmP.x - apW / 2 : rmP.x + 84,
            top: vertical ? rmP.y - 330 : rmP.y - 100,
            transformOrigin: vertical ? '50% 100%' : '0% 50%',
            transform: `scale(${(0.75 + 0.25 * apIn) * (1 - 0.25 * apOut)})`,
            opacity: Math.min(1, apIn * 1.5) * (1 - apOut),
          }}
        >
          <ApprovalCard width={apW} frame={F} />
          <Tap frame={F} at={G.approveTap} x={apW * 0.7} y={126} scale={1.3} />
        </div>
      )}
      {F >= G.check && F < G.pull[1] && (
        <div style={{ position: 'absolute', left: rmP.x, top: rmP.y, width: 0, height: 0, opacity: 1 - approvedOut }}>
          <CheckBurst frame={F} start={G.check} size={vertical ? 230 : 200} />
        </div>
      )}
      {approvedP > 0.01 && approvedOut < 1 && (
        <div
          style={{
            position: 'absolute',
            left: rmP.x,
            top: rmP.y + (vertical ? 190 : 165),
            transform: `translate(-50%, ${(1 - approvedP) * 30}px)`,
            opacity: Math.min(1, approvedP * 1.4) * (1 - approvedOut),
            textAlign: 'center',
            fontFamily: FONT_STACK,
          }}
        >
          <div style={{ fontSize: vertical ? 64 : 54, fontWeight: 760, letterSpacing: '-0.04em', color: COLORS.text, textShadow: `0 0 40px ${alpha(COLORS.accent, 0.6)}` }}>
            {COPY.workflow.approvedLabel}
          </div>
          <div style={{ fontSize: vertical ? 26 : 22, color: COLORS.textDim, marginTop: 4, whiteSpace: 'nowrap' }}>
            {COPY.workflow.task.title} · just now
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
