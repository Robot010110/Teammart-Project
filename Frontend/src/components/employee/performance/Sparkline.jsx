import { useId } from "react";

// Sparkline.jsx — the tiny trend line inside a breakdown card.
//
// Plots a real series only. `values` is oldest-first and may contain
// nulls for periods with no data; those are skipped rather than drawn as
// zero. Fewer than two real values means there is nothing to show a
// trend for, so the component renders nothing at all rather than a
// straight decorative line.
export default function Sparkline({ values, color, width = 62, height = 22 }) {
  const uid = useId();
  const pts = (values ?? [])
    .map((v, i) => (v == null ? null : { v, i }))
    .filter(Boolean);

  if (pts.length < 2) return null;

  const xs = values.length - 1 || 1;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;

  const coords = pts.map((p) => ({
    x: (p.i / xs) * (width - 2) + 1,
    y: height - 3 - ((p.v - min) / span) * (height - 6),
  }));

  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const area = `${d} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-f`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`${uid}-g`} x="-30%" y="-60%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <path d={area} fill={`url(#${uid}-f)`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" filter={`url(#${uid}-g)`} opacity="0.8" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
