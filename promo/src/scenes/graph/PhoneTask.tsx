import React from 'react';
import { Bell, Camera, Check, ChevronLeft, Clock, Home, ListChecks, MapPin, MessageCircle, Package, Settings, Upload, User, Users } from 'lucide-react';
import { COLORS, COPY } from '../../config';
import { Tap } from '../../components/CheckBurst';
import { FONT_STACK } from '../../lib/fonts';
import { EASE, mix, pulse, ramp, sp, SPRING, stagger } from '../../lib/motion';
import { alpha } from '../../lib/util';
import { G } from './timeline';

/**
 * In-phone UI, laid out in the real app's 390×844 viewport and styled with
 * TeamMart's own tokens (orange primary, navy cards, lucide icons) — it is a
 * faithful rebuild of the app's task detail screen (Frontend: SuddenTask
 * detail), so it matches the real screenshots later in the film.
 */
const A = COLORS.app;
const T = COPY.workflow.task;

/** Where the task card sits in the viewport — used to launch the "lift" chip. */
export const PHONE_CARD_CENTER = { x: 195, y: 266 };

const Label: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7385', fontWeight: 700 }}>
    {icon}
    {children}
  </div>
);

const StepDot: React.FC<{ state: 'done' | 'active' | 'todo'; n: number; pop: number; green: number }> = ({ state, n, pop, green }) => {
  const done = state === 'done';
  const active = state === 'active';
  const color = done ? (green > 0.5 ? A.green : A.orange) : active ? A.orange : '#3A4256';
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        display: 'grid',
        placeItems: 'center',
        background: done ? color : active ? alpha(A.orange, 0.15) : 'rgba(255,255,255,0.04)',
        border: `2px solid ${color}`,
        color: done ? '#fff' : active ? A.orange : '#6B7385',
        fontSize: 12,
        fontWeight: 800,
        transform: `scale(${0.7 + 0.3 * pop})`,
        boxShadow: done || active ? `0 0 16px ${alpha(color, 0.45)}` : undefined,
      }}
    >
      {done ? <Check size={15} strokeWidth={3.2} /> : n}
    </div>
  );
};

/** A tiny restocked-shelf "photo" for the evidence slot. */
const ShelfPhoto: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <div style={{ width: w, height: h, borderRadius: 12, overflow: 'hidden', position: 'relative', background: 'linear-gradient(180deg, #DDE6F0, #B7C5D6)' }}>
    {[0, 1, 2].map((row) => (
      <div key={row} style={{ position: 'absolute', left: 8, right: 8, top: 8 + row * (h / 3.1), height: h / 3.1 - 8, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${62 + ((i * 37 + row * 13) % 30)}%`,
              borderRadius: 3,
              background: ['#FFFFFF', '#F4F7FB', '#2F6FED', '#FFFFFF', '#E9EEF6', '#F3B23E'][(i + row * 2) % 6],
              boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.08)',
            }}
          />
        ))}
        <div style={{ position: 'absolute', left: -8, right: -8, bottom: -4, height: 4, background: '#8392A6' }} />
      </div>
    ))}
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%)' }} />
  </div>
);

export const PhoneTask: React.FC<{ frame: number }> = ({ frame: f }) => {
  // Content populates after the notification.
  const reveal = (i: number) => sp(f, stagger(G.detail, i, 3), SPRING.snap);
  const rv = (i: number): React.CSSProperties => {
    const p = reveal(i);
    return { opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 14}px)` };
  };
  const skeleton = 1 - ramp(f, G.detail, G.detail + 10);

  const started = f >= G.tapStart + 3;
  const done = f >= G.tapDone + 3;
  const line1 = ramp(f, G.tapStart + 2, G.tapStart + 16, 0, 1, EASE.out);
  const line2 = ramp(f, G.tapDone + 2, G.tapDone + 16, 0, 1, EASE.out);
  const pop2 = started ? sp(f, G.tapStart + 12, SPRING.pop) : 1;
  const pop3 = done ? sp(f, G.tapDone + 12, SPRING.pop) : 1;
  const green = ramp(f, G.tapDone + 6, G.tapDone + 18);
  const elapsed = started ? Math.max(0, Math.floor((f - G.tapStart) / 4.2)) : 0;

  const photoFlash = pulse(f, G.photo, G.photo + 14, 0.15);
  const photoIn = sp(f, G.photo + 4, SPRING.pop);
  const hasPhoto = f >= G.photo + 4;

  const btnLabel = done ? 'Completed' : started ? 'Mark Complete' : 'Start Task';
  const btnMorph = pulse(f, G.tapStart + 1, G.tapStart + 14, 0.3) + pulse(f, G.tapDone + 1, G.tapDone + 14, 0.3);
  const btnColor = done ? mix(0, 1, green) : 0;

  const notifIn = sp(f, G.notif, SPRING.snap);
  const notifOut = ramp(f, G.notifOut, G.notifOut + 14, 0, 1, EASE.in);
  const notifY = -110 + 118 * notifIn - 130 * notifOut;
  const lift = sp(f, G.lift, SPRING.snap);

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: FONT_STACK, color: A.text, background: `radial-gradient(ellipse at 50% 0%, #121B33 0%, ${A.bg} 55%)` }}>
      {/* App header */}
      <div style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${A.orange}, #C95C10)`, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 800, color: '#fff', boxShadow: `0 0 14px ${alpha(A.orange, 0.5)}` }}>
            TM
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.02em' }}>
            TEAM<span style={{ color: A.orange }}>MART</span>
          </div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', position: 'relative' }}>
          <Bell size={17} color="#C9CFDB" />
          {f >= G.notif && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, background: A.orange, fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', transform: `scale(${sp(f, G.notif + 4, SPRING.pop)})` }}>
              1
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: A.textDim, ...rv(0) }}>
        <ChevronLeft size={15} /> Back to Tasks
      </div>

      {/* Task card */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 96,
          width: 358,
          height: 340,
          borderRadius: 18,
          padding: 16,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #141D33, #0F1628)',
          border: `1px solid ${lift > 0.01 ? alpha(COLORS.accent, 0.3 + 0.5 * lift) : 'rgba(255,255,255,0.08)'}`,
          boxShadow: lift > 0.01 ? `0 0 ${40 * lift}px ${alpha(COLORS.accent, 0.4 * lift)}` : '0 10px 30px -12px rgba(0,0,0,0.6)',
          transform: `scale(${1 + 0.03 * lift})`,
        }}
      >
        {skeleton > 0 && (
          <div style={{ position: 'absolute', inset: 16, opacity: skeleton }}>
            {[0.3, 0.7, 0.5, 0.9, 0.8, 0.6].map((w, i) => (
              <div key={i} style={{ height: i === 1 ? 20 : 12, width: `${w * 100}%`, marginBottom: 16, borderRadius: 6, background: `linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,${0.09 + 0.05 * Math.sin(f * 0.25 + i)}), rgba(255,255,255,0.05))` }} />
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...rv(1) }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              color: done ? A.green : A.orange,
              background: alpha(done ? A.green : A.orange, 0.14),
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: done ? A.green : A.orange }} />
            {done ? 'Completed' : T.priority}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: started && !done ? A.orange : A.textDim, fontVariantNumeric: 'tabular-nums' }}>
            <Clock size={13} />
            {started ? `${done ? 'Done in' : 'In progress'} · 00:${String(Math.min(elapsed, 59)).padStart(2, '0')}` : '30m'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center', ...rv(2) }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: alpha(A.navy, 0.9), border: '1px solid rgba(120,150,255,0.25)', display: 'grid', placeItems: 'center' }}>
            <Package size={22} color="#7FA0FF" />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 750, letterSpacing: '-0.02em' }}>{T.title}</div>
            <div style={{ fontSize: 12.5, color: A.textDim, marginTop: 2 }}>
              {T.category} · {T.location}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13.5, lineHeight: 1.45, color: '#A6AEC2', marginTop: 12, ...rv(3) }}>{T.description}</div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '14px 0 12px', ...rv(3) }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 10, ...rv(4) }}>
          <div>
            <Label icon={<Clock size={11} />}>Due time</Label>
            <div style={{ fontSize: 13.5, fontWeight: 650, marginTop: 3 }}>{T.dueTime}</div>
          </div>
          <div>
            <Label icon={<MapPin size={11} />}>Location</Label>
            <div style={{ fontSize: 13.5, fontWeight: 650, marginTop: 3 }}>{T.location}</div>
          </div>
          <div>
            <Label icon={<User size={11} />}>Assigned by</Label>
            <div style={{ fontSize: 13.5, fontWeight: 650, marginTop: 3 }}>{COPY.workflow.assignedBy}</div>
          </div>
          <div>
            <Label icon={<Users size={11} />}>Assigned to</Label>
            <div style={{ fontSize: 13.5, fontWeight: 650, marginTop: 3 }}>{COPY.workflow.assignee}</div>
          </div>
        </div>

        {/* 3-step tracker */}
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14, ...rv(5) }}>
          <div style={{ position: 'relative', height: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 22px' }}>
            {[0, 1].map((k) => {
              const fill = k === 0 ? line1 : line2;
              return (
                <div key={k} style={{ position: 'absolute', top: 13, height: 2, left: k === 0 ? 50 : 177, width: 99, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                  <div style={{ width: `${fill * 100}%`, height: 2, background: green > 0.5 ? A.green : A.orange, borderRadius: 1 }} />
                </div>
              );
            })}
            <StepDot state="done" n={1} pop={1} green={green} />
            <StepDot state={done ? 'done' : started ? 'active' : 'todo'} n={2} pop={pop2} green={green} />
            <StepDot state={done ? 'done' : 'todo'} n={3} pop={pop3} green={green} />
          </div>
          <div style={{ position: 'relative', height: 16, marginTop: 6, fontSize: 11, color: A.textDim, fontWeight: 600 }}>
            {[
              { x: 36, t: 'Assigned', c: undefined },
              { x: 163, t: 'In Progress', c: started ? A.text : undefined },
              { x: 290, t: 'Completed', c: done ? A.green : undefined },
            ].map((l) => (
              <span key={l.t} style={{ position: 'absolute', left: l.x, transform: 'translateX(-50%)', whiteSpace: 'nowrap', color: l.c }}>
                {l.t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Photo evidence */}
      <div style={{ position: 'absolute', left: 16, top: 450, width: 358, height: 152, borderRadius: 18, padding: 16, boxSizing: 'border-box', background: 'linear-gradient(180deg, #121A2E, #0E1525)', border: '1px solid rgba(255,255,255,0.08)', ...rv(6) }}>
        <div style={{ fontSize: 15, fontWeight: 750 }}>Photo Evidence</div>
        <div style={{ fontSize: 12, color: A.textDim, marginTop: 3 }}>{hasPhoto ? 'Photo attached · ready to submit' : 'Attach a photo before marking this task complete.'}</div>
        {!hasPhoto ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {[
              { icon: <Camera size={17} color={A.orange} />, t: 'Take Photo' },
              { icon: <Upload size={17} color={A.orange} />, t: 'Upload Photo' },
            ].map((b) => (
              <div key={b.t} style={{ flex: 1, height: 60, borderRadius: 12, border: '1.5px dashed rgba(255,255,255,0.14)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, fontWeight: 650, color: '#C9CFDB' }}>
                {b.icon}
                {b.t}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', transform: `scale(${0.85 + 0.15 * photoIn})`, opacity: Math.min(1, photoIn * 1.5), transformOrigin: 'left center' }}>
            <ShelfPhoto w={96} h={62} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: A.green }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, background: A.green, display: 'grid', placeItems: 'center' }}>
                <Check size={13} color="#04140D" strokeWidth={3.4} />
              </div>
              dairy_aisle4.jpg
            </div>
          </div>
        )}
        {photoFlash > 0 && <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: `rgba(255,255,255,${0.85 * photoFlash})` }} />}
      </div>

      {/* Primary action */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 620,
          width: 358,
          height: 54,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 16,
          fontWeight: 750,
          color: '#fff',
          background: btnColor > 0 ? `linear-gradient(180deg, ${A.green}, #1FB57F)` : `linear-gradient(180deg, #FF8A33, ${A.orange})`,
          boxShadow: `0 12px 28px -10px ${alpha(btnColor > 0 ? A.green : A.orange, 0.7)}`,
          transform: `scale(${1 - 0.04 * btnMorph})`,
          ...rv(7),
        }}
      >
        {done && <Check size={18} strokeWidth={3} />}
        {btnLabel}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 72, display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: 'rgba(9,13,24,0.94)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {[
          { i: <Home size={20} />, t: 'Home' },
          { i: <ListChecks size={20} />, t: 'Tasks', on: true },
          { i: <Users size={20} />, t: 'Team' },
          { i: <MessageCircle size={20} />, t: 'Chat' },
          { i: <Settings size={20} />, t: 'Settings' },
        ].map((n) => (
          <div key={n.t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 600, color: n.on ? A.orange : '#7C8499' }}>
            {n.i}
            {n.t}
          </div>
        ))}
      </div>

      {/* Taps */}
      <Tap frame={f} at={G.tapStart} x={195} y={647} />
      <Tap frame={f} at={G.photo - 3} x={104} y={539} scale={0.8} />
      <Tap frame={f} at={G.tapDone} x={195} y={647} />

      {/* Push notification */}
      {f >= G.notif - 1 && notifOut < 1 && (
        <div
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            top: notifY,
            height: 84,
            borderRadius: 22,
            padding: '12px 14px',
            boxSizing: 'border-box',
            display: 'flex',
            gap: 12,
            background: 'rgba(30,35,48,0.96)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 18px 40px -10px rgba(0,0,0,0.8)',
            zIndex: 30,
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: `linear-gradient(135deg, ${A.orange}, #C95C10)`, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800 }}>TM</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#AEB5C5', fontWeight: 600 }}>
              <span>TEAMMART</span>
              <span>now</span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 750, marginTop: 2 }}>{COPY.workflow.notification}</div>
            <div style={{ fontSize: 13, color: '#C9CFDB', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {T.title} · from {COPY.workflow.assignedBy}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
