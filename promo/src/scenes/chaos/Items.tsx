import React from 'react';
import { AlertTriangle, Clock, Mail, Paperclip, PhoneMissed } from 'lucide-react';
import { COLORS, COPY } from '../../config';
import { FONT_STACK } from '../../lib/fonts';
import { alpha } from '../../lib/util';
import type { ChaosItem } from './sim';

const SENDERS = [
  { n: 'Ahmed · Market 7', c: '#3E5A9E' },
  { n: 'Sara · Cashier', c: '#8A4E6B' },
  { n: 'Soran · Night shift', c: '#3F7D6A' },
  { n: 'Rostam · Market 2', c: '#8C6A3A' },
];

const base: React.CSSProperties = { fontFamily: FONT_STACK, boxSizing: 'border-box' };

const Bubble: React.FC<{ it: ChaosItem; hero?: boolean }> = ({ it, hero }) => {
  const s = SENDERS[it.variant % SENDERS.length];
  const outgoing = !hero && it.variant === 3;
  const size = hero ? 27 : 21;
  return (
    <div
      style={{
        ...base,
        position: 'relative',
        width: it.w,
        height: it.h,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: hero ? '16px 22px 16px 16px' : '12px 18px 12px 12px',
        borderRadius: 24,
        borderBottomLeftRadius: outgoing ? 24 : 7,
        borderBottomRightRadius: outgoing ? 7 : 24,
        background: outgoing ? 'linear-gradient(180deg, #2A3B6B, #22315A)' : 'linear-gradient(180deg, #1D2230, #171B26)',
        border: `1px solid ${hero ? alpha(COLORS.warm, 0.45) : 'rgba(255,255,255,0.09)'}`,
        boxShadow: hero
          ? `0 20px 50px -18px rgba(0,0,0,0.9), 0 0 40px ${alpha(COLORS.warm, 0.18)}`
          : '0 18px 40px -16px rgba(0,0,0,0.85)',
      }}
    >
      <div
        style={{
          width: hero ? 44 : 34,
          height: hero ? 44 : 34,
          borderRadius: '50%',
          flexShrink: 0,
          background: hero ? `linear-gradient(140deg, ${COLORS.warm}, #E07B2C)` : s.c,
          color: '#fff',
          fontSize: hero ? 16 : 13,
          fontWeight: 700,
          display: 'grid',
          placeItems: 'center',
          letterSpacing: '-0.02em',
        }}
      >
        {hero ? 'AM' : s.n.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: hero ? 15 : 13, color: COLORS.textDim, fontWeight: 600, marginBottom: 3 }}>
          {hero ? 'Area Manager · now' : s.n}
        </div>
        <div style={{ fontSize: size, lineHeight: 1.27, color: COLORS.text, fontWeight: hero ? 650 : 500, letterSpacing: '-0.012em' }}>
          {it.text}
        </div>
      </div>
      {(hero || it.variant === 1) && (
        <div
          style={{
            position: 'absolute',
            right: -6,
            top: -6,
            width: hero ? 26 : 20,
            height: hero ? 26 : 20,
            borderRadius: 13,
            background: COLORS.danger,
            color: '#fff',
            fontSize: hero ? 14 : 11,
            fontWeight: 800,
            display: 'grid',
            placeItems: 'center',
            boxShadow: `0 0 16px ${alpha(COLORS.danger, 0.7)}`,
          }}
        >
          {hero ? 3 : 1}
        </div>
      )}
    </div>
  );
};

const Note: React.FC<{ it: ChaosItem }> = ({ it }) => (
  <div
    style={{
      ...base,
      width: it.w,
      height: it.h,
      padding: '30px 18px 18px',
      background: it.variant % 2 ? 'linear-gradient(170deg, #FFE08A, #FFC24D)' : 'linear-gradient(170deg, #FFD27A, #FFB547)',
      borderRadius: 4,
      boxShadow: '0 22px 40px -18px rgba(0,0,0,0.9), inset 0 -18px 30px rgba(160,90,0,0.12)',
      color: '#3B2A08',
      fontSize: 24,
      fontWeight: 650,
      lineHeight: 1.18,
      fontStyle: 'italic',
      letterSpacing: '-0.02em',
      position: 'relative',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: -9,
        left: '50%',
        width: 74,
        height: 22,
        marginLeft: -37,
        background: 'rgba(255,255,255,0.42)',
        transform: `rotate(${it.variant % 2 ? -4 : 3}deg)`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
      }}
    />
    {it.text}
  </div>
);

const Sheet: React.FC<{ it: ChaosItem }> = ({ it }) => {
  const c = COPY.chaos;
  const cell: React.CSSProperties = {
    borderRight: '1px solid #D3D9E3',
    borderBottom: '1px solid #D3D9E3',
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    fontSize: 15,
    color: '#1F2937',
    fontVariantNumeric: 'tabular-nums',
  };
  const tone = (v: string): React.CSSProperties =>
    v.startsWith('#')
      ? { color: '#C81E1E', background: '#FDE4E4', fontWeight: 700 }
      : v === '???' || v === 'TBD'
        ? { background: '#FFF3C4', fontWeight: 700 }
        : {};
  return (
    <div style={{ ...base, width: it.w, height: it.h, borderRadius: 8, overflow: 'hidden', background: '#F6F8FB', boxShadow: '0 24px 50px -20px rgba(0,0,0,0.9)' }}>
      <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', background: '#1E7A46', color: '#fff', fontSize: 13, fontWeight: 700 }}>
        <span style={{ width: 16, height: 16, borderRadius: 3, background: 'rgba(255,255,255,0.25)', display: 'grid', placeItems: 'center', fontSize: 10 }}>X</span>
        shift_schedule_v7_FINAL(2).xlsx
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 0.8fr 1fr', gridAutoRows: 34 }}>
        {['', ...c.sheetHeader].map((h, i) => (
          <div key={`h${i}`} style={{ ...cell, background: '#E8EDF3', fontWeight: 700, fontSize: 13, color: '#4B5563', justifyContent: i === 0 ? 'center' : undefined }}>
            {h}
          </div>
        ))}
        {c.sheetRows.map((row, r) => (
          <React.Fragment key={r}>
            <div style={{ ...cell, background: '#E8EDF3', fontSize: 12, color: '#6B7280', justifyContent: 'center' }}>{r + 2}</div>
            {row.map((v, k) => (
              <div key={k} style={{ ...cell, ...tone(v) }}>
                {v}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const Missed: React.FC<{ it: ChaosItem }> = ({ it }) => (
  <div
    style={{
      ...base,
      width: it.w,
      height: it.h,
      borderRadius: it.h / 2,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 22px 0 10px',
      background: 'linear-gradient(180deg, #221A20, #1A1519)',
      border: `1px solid ${alpha(COLORS.danger, 0.35)}`,
      boxShadow: '0 18px 40px -16px rgba(0,0,0,0.85)',
      color: COLORS.text,
      fontSize: 19,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}
  >
    <div style={{ width: 44, height: 44, borderRadius: 22, background: alpha(COLORS.danger, 0.18), display: 'grid', placeItems: 'center' }}>
      <PhoneMissed size={22} color={COLORS.danger} strokeWidth={2.4} />
    </div>
    {it.text}
  </div>
);

const Counter: React.FC<{ it: ChaosItem; count: number }> = ({ it, count }) => (
  <div
    style={{
      ...base,
      width: it.w,
      height: it.h,
      borderRadius: 22,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '0 20px',
      background: 'linear-gradient(180deg, #2A1519, #1C1114)',
      border: `1px solid ${alpha(COLORS.danger, 0.5)}`,
      boxShadow: `0 20px 44px -16px rgba(0,0,0,0.9), 0 0 36px ${alpha(COLORS.danger, 0.25)}`,
    }}
  >
    <PhoneMissed size={30} color={COLORS.danger} strokeWidth={2.4} />
    <div style={{ fontSize: 46, fontWeight: 800, color: '#FF7A86', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', width: 62 }}>{count}</div>
    <div style={{ fontSize: 17, color: COLORS.textDim, fontWeight: 600, lineHeight: 1.1 }}>{it.text}</div>
  </div>
);

const Email: React.FC<{ it: ChaosItem }> = ({ it }) => (
  <div
    style={{
      ...base,
      width: it.w,
      height: it.h,
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '0 18px',
      background: '#F5F6F8',
      boxShadow: '0 24px 50px -20px rgba(0,0,0,0.9)',
      color: '#111827',
    }}
  >
    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E3E7EE', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Mail size={20} color="#4B5563" />
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ color: '#DC2626', fontWeight: 800 }}>!</span> Area Ops · 07:42
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.015em' }}>{it.text}</div>
    </div>
    <Paperclip size={18} color="#6B7280" />
  </div>
);

const Badge: React.FC<{ it: ChaosItem }> = ({ it }) => (
  <div
    style={{
      ...base,
      width: it.w,
      height: it.h,
      borderRadius: it.h / 2,
      background: 'radial-gradient(circle at 35% 30%, #FF7C88, #E5293D)',
      color: '#fff',
      fontSize: it.text.length > 2 ? 26 : 30,
      fontWeight: 800,
      display: 'grid',
      placeItems: 'center',
      letterSpacing: '-0.03em',
      boxShadow: `0 0 34px ${alpha(COLORS.danger, 0.6)}, 0 14px 30px -10px rgba(0,0,0,0.8)`,
    }}
  >
    {it.text}
  </div>
);

const Misc: React.FC<{ it: ChaosItem }> = ({ it }) => {
  const late = it.text.startsWith('Late');
  const overdue = it.text.startsWith('Overdue');
  const color = late ? COLORS.warm : overdue ? COLORS.danger : COLORS.textDim;
  const Icon = late ? AlertTriangle : overdue ? Clock : Mail;
  return (
    <div
      style={{
        ...base,
        width: it.w,
        height: it.h,
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 18px',
        background: 'linear-gradient(180deg, #1E2230, #171A25)',
        border: `1px solid ${alpha(color, 0.4)}`,
        boxShadow: '0 18px 40px -16px rgba(0,0,0,0.85)',
        color: COLORS.text,
        fontSize: 20,
        fontWeight: 650,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={22} color={color} strokeWidth={2.4} />
      {it.text}
    </div>
  );
};

export const ChaosVisual: React.FC<{ it: ChaosItem; counter: number }> = ({ it, counter }) => {
  switch (it.kind) {
    case 'hero':
      return <Bubble it={it} hero />;
    case 'bubble':
      return <Bubble it={it} />;
    case 'note':
      return <Note it={it} />;
    case 'sheet':
      return <Sheet it={it} />;
    case 'missed':
      return <Missed it={it} />;
    case 'counter':
      return <Counter it={it} count={counter} />;
    case 'email':
      return <Email it={it} />;
    case 'badge':
      return <Badge it={it} />;
    case 'misc':
      return <Misc it={it} />;
  }
};
