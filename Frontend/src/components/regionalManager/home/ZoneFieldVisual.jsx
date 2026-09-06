import { useEffect, useId, useMemo, useState } from "react";

// ZoneFieldVisual.jsx — the glowing "territory" behind the Zone Overview
// card's numbers.
//
// An important honesty note about what this is and is not: this app
// stores no coordinates for a market (see the Market model — name,
// status, zone, supervisor, employees, no lat/lng), so this is NOT a
// map and deliberately does not draw a real country, region or border.
// It is an abstract field: one glowing point per REAL market in the
// zone, each coloured by that market's REAL status, laid out on a
// deterministic scatter. Positions are decorative; the number of
// points, their colours and their tooltips are real.
//
// Deterministic is the point — a plain Math.random() would reshuffle
// every point on each re-render (and this card re-renders whenever the
// page reloads its data), which reads as a glitch. The tiny LCG below
// is seeded from the market's own id, so a given market always lands in
// the same spot for as long as it exists.
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pointFor(id, index, total) {
  const seed = seedFrom(id);
  const jitterA = ((seed % 1000) / 1000 - 0.5) * 2; // -1..1
  const jitterB = (((seed >>> 10) % 1000) / 1000 - 0.5) * 2;

  // Spread the points around a wide ellipse so a zone with 3 markets and
  // a zone with 20 both fill the card instead of clumping in the middle.
  // Centred on the contour drawn below (cx 50, cy 34 in this 100x66
  // viewBox) — not on 50,50, which would push half the points off the
  // bottom edge of a card that is only 66 units tall.
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + jitterA * 0.55;
  const radius = 0.45 + jitterB * 0.32;
  return {
    x: 50 + Math.cos(angle) * radius * 44,
    y: 34 + Math.sin(angle) * radius * 24,
  };
}

const TONE = {
  alert: { fill: "#F87171", glow: "rgba(248,113,113,0.9)" },
  idle: { fill: "#64748B", glow: "rgba(100,116,139,0.7)" },
  active: { fill: "#FFB35C", glow: "rgba(244,122,32,0.95)" },
};

export default function ZoneFieldVisual({ markets = [], problemMarketIds }) {
  const uid = useId();

  // index.css's prefers-reduced-motion block only silences CSS
  // animations; SVG SMIL <animate> below is not covered by it, so the
  // preference has to be honoured explicitly here.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduceMotion(mq.matches);
    const onChange = (e) => setReduceMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const points = useMemo(() => {
    const alerts = problemMarketIds ?? new Set();
    return markets.map((m, i) => {
      const { x, y } = pointFor(m.id, i, markets.length);
      const tone = alerts.has(m.id) ? "alert" : m.status === "ACTIVE" ? "active" : "idle";
      return { id: m.id, name: m.name, status: m.status, x, y, ...TONE[tone] };
    });
  }, [markets, problemMarketIds]);

  return (
    <svg
      viewBox="0 0 100 66"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label={`${markets.length} markets in this zone`}
    >
      <defs>
        <radialGradient id={`${uid}-field`} cx="50%" cy="52%" r="58%">
          <stop offset="0%" stopColor="#F47A20" stopOpacity="0.20" />
          <stop offset="55%" stopColor="#F47A20" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#F47A20" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {/* Abstract territory — a soft organic contour, not a real border. */}
      <ellipse cx="50" cy="34" rx="44" ry="27" fill={`url(#${uid}-field)`} />
      <ellipse
        cx="50"
        cy="34"
        rx="40"
        ry="23.5"
        fill="none"
        stroke="rgba(244,122,32,0.32)"
        strokeWidth="0.45"
        strokeDasharray="3 2.4"
      />

      {/* Latitude-style guide lines — depth only, no geographic meaning. */}
      {[16, 27, 41, 52].map((y) => (
        <line key={y} x1="8" y1={y} x2="92" y2={y} stroke="rgba(148,180,255,0.06)" strokeWidth="0.3" />
      ))}

      {points.map((p, i) => (
        <g key={p.id}>
          <title>{`${p.name} — ${p.status.toLowerCase()}`}</title>
          <circle cx={p.x} cy={p.y} r="3.4" fill={p.glow} filter={`url(#${uid}-soft)`} opacity="0.6">
            {/* Slow, staggered breathing — subtle enough to read as
                "live", never as an animation demo. */}
            {!reduceMotion && (
              <animate
                attributeName="opacity"
                values="0.32;0.72;0.32"
                dur="4.5s"
                begin={`${(i % 5) * 0.9}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
          <circle cx={p.x} cy={p.y} r="1.25" fill={p.fill} />
        </g>
      ))}
    </svg>
  );
}
