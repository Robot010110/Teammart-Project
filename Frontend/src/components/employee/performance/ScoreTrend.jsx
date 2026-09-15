import { useState } from "react";
import { useTranslation } from "react-i18next";

// ScoreTrend.jsx — the score over time, weekly or monthly.
//
// Deliberately a plain SVG rather than a chart dependency: the series is
// at most 13 points and this app has no charting library, so adding one
// for a sparkline-scale line would be a lot of weight for very little.
//
// Only periods the backend actually scored are plotted. A NO_DATA period
// (score === null) leaves a genuine GAP in the line rather than being
// drawn at zero — a week nobody worked is not a week of terrible
// performance, and joining across it would draw a cliff that never
// happened.

const WIDTH = 320;
const HEIGHT = 96;
const PAD = 8;

function toPoints(periods) {
  // History arrives most-recent-first; a time series reads oldest-first.
  const series = [...(periods ?? [])].reverse();
  const scored = series.filter((p) => p?.score != null);
  if (scored.length === 0) return { points: [], series: [] };

  const max = 100;
  const min = Math.min(60, ...scored.map((p) => p.score));
  const range = Math.max(max - min, 1);

  const points = series.map((p, i) => {
    const x = PAD + (i * (WIDTH - PAD * 2)) / Math.max(series.length - 1, 1);
    if (p?.score == null) return { x, y: null, period: p };
    const y = HEIGHT - PAD - ((p.score - min) / range) * (HEIGHT - PAD * 2);
    return { x, y, period: p };
  });
  return { points, series };
}

// Builds one path per unbroken run of scored periods, so a gap stays a gap.
function segments(points) {
  const out = [];
  let run = [];
  for (const point of points) {
    if (point.y == null) {
      if (run.length > 1) out.push(run);
      run = [];
    } else {
      run.push(point);
    }
  }
  if (run.length > 1) out.push(run);
  return out;
}

function periodLabel(period) {
  if (!period?.periodStart) return "";
  const d = new Date(period.periodStart);
  return period.periodType === "MONTH"
    ? d.toLocaleDateString("en-US", { month: "short" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ScoreTrend({ weekly, monthly }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("WEEK");

  const periods = mode === "WEEK" ? weekly : monthly;
  const { points } = toPoints(periods);
  const scored = points.filter((p) => p.y != null);

  return (
    <section className="rounded-[18px] p-3 bg-[#0D1223]/80 border border-white/[0.07]">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-[13px] font-semibold text-white">{t("emp.perfTrend")}</h3>
        <div className="flex gap-1">
          {[["WEEK", t("emp.perfWeekly")], ["MONTH", t("emp.perfMonthly")]].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                mode === key
                  ? "bg-white/[0.10] border-white/[0.16] text-white"
                  : "bg-transparent border-white/[0.08] text-[#8B93A8]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {scored.length < 2 ? (
        <p className="py-6 text-center text-[11px] text-[#5C6479]">{t("emp.perfNotEnoughTrend")}</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-[96px]" role="img" aria-label={t("emp.perfTrend")}>
            {segments(points).map((run, i) => (
              <polyline
                key={i}
                fill="none"
                stroke="#F47A20"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={run.map((p) => `${p.x},${p.y}`).join(" ")}
              />
            ))}
            {scored.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#F47A20" />
            ))}
          </svg>

          <div className="mt-1 flex items-center justify-between text-[10px] text-[#5C6479]">
            <span>{periodLabel(scored[0]?.period)}</span>
            <span>{periodLabel(scored[scored.length - 1]?.period)}</span>
          </div>
        </>
      )}
    </section>
  );
}
