import { useId, useMemo, useState } from "react";

// PerformanceTrendChart.jsx — the Performance Trend card.
//
// Both views plot REAL data, just bucketed differently:
//   Week   one point per day, Mon-Sun of the current week, each day's
//          rate derived from the employee's own activities (the same
//          GET /api/activities list this page already loads — no extra
//          request, no new endpoint).
//   Month  the monthly buckets returned by
//          GET /api/activities/performance-history, unchanged.
// Day/month labels match the reference's axis; the underlying metric is
// still the backend's own approved / (approved + rejected).
//
// A bucket with nothing reviewed has no rate and is genuinely ABSENT
// from the line rather than plotted as 0%, which would misread as
// "scored zero that day".
//
// The glow is layered the same way as the score ring: a wide blurred
// copy of the path, then a tighter one, then the crisp stroke — so the
// light traces the real curve. No charting library; one <svg>, which
// keeps it cheap on a phone.

const W = 340;
const H = 176;
const AXIS_W = 30; // left gutter for the % labels
const PAD_R = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 30;
const PLOT_L = AXIS_W;
const PLOT_R = W - PAD_R;
const BASE_Y = H - PAD_BOTTOM;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  return d;
}

// Catmull-Rom -> cubic Bezier: the smooth curve the reference has, while
// still passing exactly through every real point.
function smoothPath(pts) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${
      p2.y - (p3.y - p1.y) / 6
    }, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function PerformanceTrendChart({ activities, monthly }) {
  const uid = useId();
  const [period, setPeriod] = useState("week");
  const [activeKey, setActiveKey] = useState(null);

  // Week — bucket real activities into Mon-Sun of the current week.
  const weekBuckets = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const buckets = DAY_LABELS.map((label, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return { label, date: d, approved: 0, rejected: 0, totalReviewed: 0, rate: null };
    });
    for (const a of activities ?? []) {
      if (a.status !== "APPROVED" && a.status !== "REJECTED") continue;
      const ad = new Date(a.date);
      const dayStart = new Date(ad.getFullYear(), ad.getMonth(), ad.getDate());
      const idx = Math.round((dayStart - weekStart) / 86400000);
      if (idx < 0 || idx > 6) continue;
      const b = buckets[idx];
      if (a.status === "APPROVED") b.approved += 1;
      else b.rejected += 1;
      b.totalReviewed += 1;
    }
    for (const b of buckets) {
      if (b.totalReviewed > 0) b.rate = (b.approved / b.totalReviewed) * 100;
    }
    return buckets;
  }, [activities]);

  const monthBuckets = useMemo(
    () =>
      [...(monthly ?? [])].reverse().map((m) => ({
        label: new Date(m.year, m.month - 1, 1).toLocaleDateString("en-US", { month: "short" }),
        date: new Date(m.year, m.month - 1, 1),
        approved: m.approved,
        rejected: m.rejected,
        totalReviewed: m.totalReviewed,
        rate: m.rate,
      })),
    [monthly]
  );

  const series = period === "week" ? weekBuckets : monthBuckets;

  const points = useMemo(() => {
    if (series.length === 0) return [];
    const step = series.length > 1 ? (PLOT_R - PLOT_L) / (series.length - 1) : 0;
    const plotH = BASE_Y - PAD_TOP;
    return series
      .map((b, i) =>
        b.rate == null
          ? null
          : {
              // Fixed 0-100 domain — a percentage is meaningful on its own
              // scale, and auto-fitting would make a 2-point swing look
              // like a cliff.
              x: PLOT_L + step * i,
              y: PAD_TOP + plotH * (1 - Math.max(0, Math.min(100, b.rate)) / 100),
              bucket: b,
              index: i,
            }
      )
      .filter(Boolean);
  }, [series]);

  const linePath = useMemo(() => smoothPath(points), [points]);
  const areaPath = useMemo(
    () =>
      points.length === 0
        ? ""
        : `${linePath} L ${points[points.length - 1].x} ${BASE_Y} L ${points[0].x} ${BASE_Y} Z`,
    [linePath, points]
  );

  const active = activeKey != null ? points.find((p) => p.index === activeKey) : null;
  const tooltipDate =
    active &&
    (period === "week"
      ? active.bucket.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      : active.bucket.date.toLocaleDateString("en-US", { month: "long", year: "numeric" }));

  return (
    <section className="rounded-[22px] p-4 bg-[#0D1223]/80 border border-white/[0.07] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-white">Performance Trend</h2>

        <div className="flex items-center gap-0.5 rounded-xl p-1 bg-white/[0.04] border border-white/[0.07]">
          {["week", "month"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                setActiveKey(null);
              }}
              aria-pressed={period === p}
              className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold capitalize transition-all duration-200 ${
                period === p
                  ? "bg-[#F47A20] text-white shadow-[0_0_14px_1px_rgba(244,122,32,0.45)]"
                  : "text-[#8B93A8] hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#4C5266]">
          No performance history yet.
          <br />
          <span className="text-xs">Your trend appears once your activities are reviewed.</span>
        </p>
      ) : (
        // Capped and centred on wide screens: the SVG scales with its
        // viewBox, so on a 900px-wide desktop card the axis labels would
        // scale up with it and render absurdly large. Phones are far
        // below this cap, so mobile is unaffected.
        <div className="mt-3 mx-auto w-full max-w-[560px]">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label={`Performance trend by ${period}. ${points
              .map((p) => `${p.bucket.label}: ${Math.round(p.bucket.rate)}%`)
              .join(". ")}`}
          >
            <defs>
              <linearGradient id={`${uid}-line`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFC26A" />
                <stop offset="55%" stopColor="#FF9330" />
                <stop offset="100%" stopColor="#F05A0F" />
              </linearGradient>
              <linearGradient id={`${uid}-area`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FF9330" stopOpacity="0.55" />
                <stop offset="45%" stopColor="#F47A20" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#F47A20" stopOpacity="0" />
              </linearGradient>
              <filter id={`${uid}-bloom`} x="-40%" y="-120%" width="180%" height="360%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
              <filter id={`${uid}-edge`} x="-30%" y="-80%" width="160%" height="260%">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>

            {/* Gridlines + Y axis at 0/25/50/75/100, matching the reference. */}
            {[100, 75, 50, 25, 0].map((v) => {
              const y = PAD_TOP + (BASE_Y - PAD_TOP) * (1 - v / 100);
              return (
                <g key={v}>
                  <line x1={PLOT_L} y1={y} x2={PLOT_R} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <text x={AXIS_W - 6} y={y + 3} fill="#5C6479" fontSize="8.5" textAnchor="end">
                    {v}%
                  </text>
                </g>
              );
            })}

            <path d={areaPath} fill={`url(#${uid}-area)`} className="animate-fade-in" />

            {/* Glow stack: wide bloom, hot edge, then the crisp stroke. */}
            <path d={linePath} fill="none" stroke={`url(#${uid}-line)`} strokeWidth="7" strokeLinecap="round" filter={`url(#${uid}-bloom)`} opacity="0.55" />
            <path d={linePath} fill="none" stroke={`url(#${uid}-line)`} strokeWidth="3.5" strokeLinecap="round" filter={`url(#${uid}-edge)`} opacity="0.85" />
            <path
              key={`${period}-${points.length}`}
              d={linePath}
              fill="none"
              stroke={`url(#${uid}-line)`}
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-draw-line"
              style={{ strokeDasharray: 1400, strokeDashoffset: 1400 }}
            />

            {/* Drop-line under the active point, as in the reference. */}
            {active && (
              <line x1={active.x} y1={active.y} x2={active.x} y2={BASE_Y} stroke="rgba(244,122,32,0.35)" strokeWidth="1" />
            )}

            {points.map((p) => {
              const isActive = activeKey === p.index;
              return (
                <g key={p.index}>
                  {isActive && <circle cx={p.x} cy={p.y} r="9" fill="#F47A20" opacity="0.22" />}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isActive ? 5 : 3}
                    fill={isActive ? "#FFFFFF" : "#F47A20"}
                    stroke={isActive ? "#F47A20" : "#0D1223"}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    className="transition-all duration-150"
                    style={isActive ? { filter: "drop-shadow(0 0 6px rgba(244,122,32,0.9))" } : undefined}
                  />
                  {/* Generous invisible hit area — a 3px dot is not a touch target. */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="18"
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={() => setActiveKey(isActive ? null : p.index)}
                    onMouseEnter={() => setActiveKey(p.index)}
                    onMouseLeave={() => setActiveKey(null)}
                  />
                </g>
              );
            })}

            {/* X labels — every bucket in week view; thinned in month view. */}
            {series.map((b, i) => {
              if (period === "month" && series.length > 6 && i % 2 !== 0) return null;
              const step = series.length > 1 ? (PLOT_R - PLOT_L) / (series.length - 1) : 0;
              return (
                <text
                  key={`${b.label}-${i}`}
                  x={PLOT_L + step * i}
                  y={H - 9}
                  fill={active?.index === i ? "#C3C9D8" : "#5C6479"}
                  fontSize="9.5"
                  textAnchor="middle"
                >
                  {b.label}
                </text>
              );
            })}

            {/* Tooltip — dark card with border, above the active point. */}
            {active && (
              <g transform={`translate(${Math.max(PLOT_L + 34, Math.min(active.x, PLOT_R - 34))}, ${Math.max(30, active.y - 14)})`}>
                <rect x="-42" y="-34" width="84" height="34" rx="9" fill="#0B1020" stroke="rgba(244,122,32,0.35)" strokeWidth="1" />
                <text x="0" y="-21" fill="#8B93A8" fontSize="8.5" textAnchor="middle">
                  {tooltipDate}
                </text>
                <text x="0" y="-8" fill="#F47A20" fontSize="12" fontWeight="700" textAnchor="middle">
                  {Math.round(active.bucket.rate)}%
                </text>
              </g>
            )}
          </svg>

          <p className="mt-1 text-center text-[10.5px] text-[#4C5266]">
            {active
              ? `${active.bucket.approved}/${active.bucket.totalReviewed} approved`
              : "Tap a point for detail"}
          </p>
        </div>
      )}
    </section>
  );
}
