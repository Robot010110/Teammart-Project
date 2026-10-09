import React from 'react';
import { Img, staticFile } from 'remotion';
import { Lock } from 'lucide-react';
import { COLORS } from '../config';
import { FONT_STACK } from '../lib/fonts';

/** Logical phone geometry (points). Screen = 47 pt status bar + 844 pt app viewport. */
export const PHONE = {
  w: 412,
  h: 913,
  bezel: 11,
  radius: 64,
  screenRadius: 54,
  statusH: 47,
  viewW: 390,
  viewH: 844,
} as const;

const StatusBar: React.FC<{ time?: string }> = ({ time = '9:41' }) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: PHONE.statusH,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 30px 0 36px',
      color: '#FFFFFF',
      fontFamily: FONT_STACK,
      fontWeight: 600,
      fontSize: 16,
      zIndex: 5,
    }}
  >
    <span style={{ letterSpacing: '-0.01em' }}>{time}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* Signal */}
      <svg width={18} height={12} viewBox="0 0 18 12">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 4.6} y={9 - i * 3} width={3.2} height={3 + i * 3} rx={0.8} fill="#fff" />
        ))}
      </svg>
      {/* Wi-Fi */}
      <svg width={16} height={12} viewBox="0 0 16 12">
        <path d="M8 11.2 5.6 8.6a3.4 3.4 0 0 1 4.8 0z" fill="#fff" />
        <path d="M3.4 6.4a6.5 6.5 0 0 1 9.2 0l-1.3 1.3a4.6 4.6 0 0 0-6.6 0z" fill="#fff" />
        <path d="M1 4a9.9 9.9 0 0 1 14 0l-1.3 1.3a8 8 0 0 0-11.4 0z" fill="#fff" />
      </svg>
      {/* Battery */}
      <svg width={27} height={13} viewBox="0 0 27 13">
        <rect x={0.5} y={0.5} width={23} height={12} rx={3.5} fill="none" stroke="rgba(255,255,255,0.45)" />
        <rect x={2} y={2} width={18} height={9} rx={2.2} fill="#fff" />
        <rect x={24.5} y={4.2} width={2} height={4.6} rx={1} fill="rgba(255,255,255,0.45)" />
      </svg>
    </div>
  </div>
);

/**
 * Phone frame rendered at logical size and scaled to `width` px.
 * Children are laid out in the 390×844 app viewport under the status bar.
 */
export const Phone: React.FC<{
  width: number;
  children?: React.ReactNode;
  screenshot?: string;
  screenBg?: string;
  style?: React.CSSProperties;
  glare?: number;
}> = ({ width, children, screenshot, screenBg = COLORS.app.bg, style, glare = 1 }) => {
  const s = width / PHONE.w;
  return (
    <div style={{ width, height: PHONE.h * s, position: 'relative', ...style }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: PHONE.w,
          height: PHONE.h,
          transform: `scale(${s})`,
          transformOrigin: '0 0',
          borderRadius: PHONE.radius,
          background: 'linear-gradient(150deg, #4A505C 0%, #1A1D24 22%, #0E1015 55%, #2C313B 100%)',
          boxShadow: [
            '0 60px 120px -30px rgba(0,0,0,0.9)',
            '0 0 0 1px rgba(255,255,255,0.10)',
            'inset 0 0 0 1.5px rgba(255,255,255,0.14)',
            'inset 0 0 0 4px rgba(0,0,0,0.55)',
          ].join(', '),
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: PHONE.bezel,
            borderRadius: PHONE.screenRadius,
            overflow: 'hidden',
            background: screenBg,
          }}
        >
          <StatusBar />
          <div style={{ position: 'absolute', top: PHONE.statusH, left: 0, width: PHONE.viewW, height: PHONE.viewH, overflow: 'hidden' }}>
            {screenshot && <Img src={staticFile(screenshot)} style={{ width: PHONE.viewW, height: PHONE.viewH, display: 'block' }} />}
            {children}
          </div>
          {/* Dynamic Island */}
          <div
            style={{
              position: 'absolute',
              top: 11,
              left: '50%',
              width: 118,
              height: 34,
              marginLeft: -59,
              borderRadius: 20,
              background: '#000',
              zIndex: 6,
            }}
          />
          {/* Screen glare */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.55 * glare,
              background: 'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 28%, rgba(255,255,255,0) 45%)',
              pointerEvents: 'none',
              zIndex: 7,
            }}
          />
        </div>
      </div>
    </div>
  );
};

/** Desktop browser window. Content area is 16:10 at the given width. */
export const BrowserFrame: React.FC<{
  width: number;
  title: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ width, title, children, style }) => {
  const LOGICAL = 1440;
  const BAR = 52;
  const s = width / LOGICAL;
  const contentH = (LOGICAL * 10) / 16;
  return (
    <div style={{ width, height: (contentH + BAR) * s, position: 'relative', ...style }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: LOGICAL,
          height: contentH + BAR,
          transform: `scale(${s})`,
          transformOrigin: '0 0',
          borderRadius: 22,
          overflow: 'hidden',
          background: '#0C0E15',
          boxShadow: '0 70px 140px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.10)',
        }}
      >
        <div
          style={{
            height: BAR,
            display: 'flex',
            alignItems: 'center',
            padding: '0 22px',
            gap: 10,
            background: 'linear-gradient(180deg, #1A1D27, #12141C)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, opacity: 0.9 }} />
          ))}
          <div
            style={{
              margin: '0 auto',
              width: 560,
              height: 32,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: COLORS.textDim,
              fontFamily: FONT_STACK,
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            <Lock size={13} strokeWidth={2.4} />
            {title}
          </div>
          <div style={{ width: 62 }} />
        </div>
        <div style={{ position: 'relative', width: LOGICAL, height: contentH, overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
};
