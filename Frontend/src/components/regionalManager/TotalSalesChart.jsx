import { useEffect, useState } from "react";

// TotalSalesChart.jsx — Market Activities §2/§8: a compact bar+line trend
// for the zone's last N days of Total Sales, purely presentational (real
// data comes from totalSalesService.getZoneSalesSummary — see
// RmMarketActivitiesPage.jsx). No charting library — this app has none
// installed, and one bar chart doesn't warrant adding a dependency.
//
// Animation: bars/line start collapsed and grow into place on mount via
// a plain CSS transition (mounted flips true one tick after the initial
// render, so the browser has a "0" state to transition away from) —
// no animation library, matches this app's existing "no new dependency
// unless truly warranted" convention.
export default function TotalSalesChart({ trend }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const width = 320;
  const height = 120;
  const padTop = 14;
  const padBottom = 4;
  const chartHeight = height - padTop - padBottom;
  const n = trend.length;
  const barWidth = Math.min(28, (width / n) * 0.55);
  const slot = width / n;

  const max = Math.max(...trend.map((t) => t.total), 1);

  const points = trend.map((t, i) => {
    const x = slot * i + slot / 2;
    const barHeight = (t.total / max) * chartHeight;
    const y = padTop + (chartHeight - barHeight);
    return { x, y, barHeight, total: t.total };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${(mounted ? p.y : height - padBottom).toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="tsc-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="tsc-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {points.map((p, i) => (
        <rect
          key={i}
          x={p.x - barWidth / 2}
          y={mounted ? p.y : height - padBottom}
          width={barWidth}
          height={mounted ? p.barHeight : 0}
          rx={6}
          fill="url(#tsc-bar)"
          style={{ transition: `y 700ms cubic-bezier(0.22,1,0.36,1) ${i * 55}ms, height 700ms cubic-bezier(0.22,1,0.36,1) ${i * 55}ms` }}
        />
      ))}

      <path
        d={linePath}
        fill="none"
        stroke="url(#tsc-line)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "d 800ms cubic-bezier(0.22,1,0.36,1) 200ms", opacity: mounted ? 1 : 0, transitionProperty: "d, opacity" }}
      />

      {last && (
        <circle
          cx={last.x}
          cy={mounted ? last.y : height - padBottom}
          r={4.5}
          fill="#22d3ee"
          style={{ transition: "cy 800ms cubic-bezier(0.22,1,0.36,1) 200ms, opacity 400ms 700ms" }}
          opacity={mounted ? 1 : 0}
        >
          <animate attributeName="r" values="4.5;6;4.5" dur="2.2s" repeatCount="indefinite" begin="1s" />
        </circle>
      )}
    </svg>
  );
}
