import { useId } from "react";

// SupervisorWindBackground.jsx — the flowing orange/gold wind behind the
// Supervisor hero card. Purely decorative (aria-hidden, pointer-events
// none, renders no data) and structurally guaranteed to loop with no
// visible jump: each wave layer is the SAME path drawn twice, side by
// side, inside a group exactly twice as wide as one tile. Animating that
// group by translateX(-50%) means the instant the animation completes
// one cycle, the visible content is pixel-identical to frame zero — the
// loop can't show a seam because there is nothing structurally different
// between "just started" and "just finished". See the animate-wind-*
// keyframes in index.css for the three independent speeds this relies on
// (28s/42s/60s — linear, never easing, so the motion never visibly
// speeds up or slows down at any point in the cycle).
//
// Three layers at different speed/opacity/brightness = the depth the
// brief asks for ("primary wave, slower secondary, faint third") without
// any layer moving in lockstep with another, which is what would read as
// flat/mechanical instead of organic.
//
// One tile is 400×200 user units; the viewBox is 800×200 so both copies
// of every layer are visible and the translate math is exact.
const TILE_W = 400;
const VIEW_W = TILE_W * 2;
const VIEW_H = 200;

// Deterministic "random" particle positions — a fixed seeded sequence
// (same technique as HeroTexture.jsx on the Performance page) so the
// texture doesn't visibly re-shuffle on every re-render.
const PARTICLES = (() => {
  let s = 20260904;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: 22 }, () => ({
    cx: rnd() * TILE_W,
    cy: 30 + rnd() * 140,
    r: 0.6 + rnd() * 1.4,
    o: 0.15 + rnd() * 0.35,
  }));
})();

// One tile's wave path, offset vertically by `baseline`. A gentle two-hump
// curve rather than sharp geometry — "soft flowing wind", not cyberpunk
// zigzags — built from smooth cubic segments.
function wavePath(baseline, amplitude) {
  const y1 = baseline - amplitude;
  const y2 = baseline + amplitude;
  return `M 0 ${baseline} C ${TILE_W * 0.14} ${y1}, ${TILE_W * 0.36} ${y1}, ${TILE_W * 0.5} ${baseline} C ${TILE_W * 0.64} ${y2}, ${TILE_W * 0.86} ${y2}, ${TILE_W} ${baseline}`;
}

export default function SupervisorWindBackground() {
  const uid = useId();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${uid}-hot`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFC26A" stopOpacity="0" />
            <stop offset="20%" stopColor="#FFC26A" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#F47A20" stopOpacity="0.95" />
            <stop offset="85%" stopColor="#E0561A" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#E0561A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-mid`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F9A03C" stopOpacity="0" />
            <stop offset="30%" stopColor="#F9A03C" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#F47A20" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F47A20" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-faint`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFD9A0" stopOpacity="0" />
            <stop offset="40%" stopColor="#FFD9A0" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#FFD9A0" stopOpacity="0" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-30%" y="-100%" width="160%" height="300%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <filter id={`${uid}-glow-soft`} x="-30%" y="-100%" width="160%" height="300%">
            <feGaussianBlur stdDeviation="5.5" />
          </filter>
        </defs>

        {/* Faint third wave — slowest, dimmest, sets ambient depth. */}
        <g className="animate-wind-faint" style={{ width: VIEW_W * 2 }}>
          {[0, 1].map((i) => (
            <path
              key={i}
              d={wavePath(150, 22)}
              transform={`translate(${i * TILE_W}, 0)`}
              fill="none"
              stroke={`url(#${uid}-faint)`}
              strokeWidth="1"
              opacity="0.5"
            />
          ))}
        </g>

        {/* Secondary wave — slower, mid-brightness. */}
        <g className="animate-wind-slow">
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${i * TILE_W}, 0)`}>
              <path d={wavePath(60, 26)} fill="none" stroke={`url(#${uid}-mid)`} strokeWidth="2" filter={`url(#${uid}-glow-soft)`} opacity="0.7" />
              <path d={wavePath(60, 26)} fill="none" stroke={`url(#${uid}-mid)`} strokeWidth="1.2" />
            </g>
          ))}
        </g>

        {/* Primary wave — fastest, brightest, the one the eye actually
            follows. Bloom + crisp core, same two-layer glow technique
            used on the Attendance/Performance rings elsewhere. */}
        <g className="animate-wind-fast">
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${i * TILE_W}, 0)`}>
              <path d={wavePath(105, 34)} fill="none" stroke={`url(#${uid}-hot)`} strokeWidth="3.5" filter={`url(#${uid}-glow)`} opacity="0.85" />
              <path d={wavePath(105, 34)} fill="none" stroke={`url(#${uid}-hot)`} strokeWidth="1.6" strokeLinecap="round" />
            </g>
          ))}
        </g>

        {/* Sparse warm particles, tied to the slow layer's speed so they
            drift rather than dart. */}
        <g className="animate-wind-slow">
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${i * TILE_W}, 0)`} fill="#FFC26A">
              {PARTICLES.map((p, j) => (
                <circle key={j} cx={p.cx} cy={p.cy} r={p.r} opacity={p.o} />
              ))}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
