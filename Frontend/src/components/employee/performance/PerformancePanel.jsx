import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import PerformanceScoreRing from "./PerformanceScoreRing";
import HeroTexture from "./HeroTexture";
import PeriodSelector from "./PeriodSelector";
import CategoryStatusRow from "./CategoryStatusRow";
import CategoryBreakdown from "./CategoryBreakdown";
import StreakCard from "./StreakCard";
import ScoreTrend from "./ScoreTrend";
import { bandForScore } from "./scoreColorBands";
import { useAsync } from "../../../hooks/useAsync";

// PerformancePanel.jsx — the Performance feature itself: pick a period,
// see the score, see exactly why.
//
// Period model, matching the spec:
//   This Week / Last Week / 2 Weeks Ago   from the weekly history
//   This Month / Last Month               monthly (This Month is the
//                                         same figure the home card shows)
//   6 Months / 1 Year                     combined, coverage-weighted
//
// The panel is data-source agnostic: it takes loader functions, so the
// employee's own page and a manager looking at someone else render the
// identical UI against different endpoints. That also means the
// visibility rules are enforced in exactly one place — the API — and this
// component simply shows whatever it was given.
//
// Nothing here computes a score. `categories`, `score` and the streak
// counts all arrive already decided by the backend.
//
// --- 2026-09 visual refinement (ring + 5-category summary) -------------
// Two presentational changes only, both scoped to this page:
//   1. The five category rows collapse into CategoryStatusRow's compact
//      icon strip by default. The full detailed breakdown
//      (CategoryBreakdown, unchanged) is still one tap away — "View
//      details" below the strip — so nothing about the underlying data
//      or its accessibility was removed, only how much of it is shown
//      up front.
//   2. The ring switches to score-band coloring + the settle-in reveal
//      (PerformanceScoreRing's `useScoreBandColor` prop). No other
//      consumer of that ring (e.g. the Regional Manager's Zone
//      Performance card) opts into this, so their behavior is byte-for-
//      byte unchanged.
// No score, category, streak, or history value is computed differently
// than before — every number on this page still comes straight from the
// API responses passed in via loadCurrent/loadHistory/loadAggregate.

const WEEK_OFFSETS = [
  { key: "week-0", offset: 0, label: "emp.perfThisWeek" },
  { key: "week-1", offset: 1, label: "emp.perfLastWeek" },
  { key: "week-2", offset: 2, label: "emp.perfTwoWeeksAgo" },
];

// The score TEXT next to the ring uses the same six-band color system as
// the ring itself (see the reference design), so the number and the ring
// never disagree about what color this score is. NO_DATA keeps the old
// neutral gray — there is no band for "nothing was measured".
function scoreTextClass(score) {
  const band = bandForScore(score);
  if (!band) return "text-[#5C6479]";
  return (
    {
      pink: "text-[#FF6FD8]",
      red: "text-[#FF5C4D]",
      yellow: "text-[#FFCB3D]",
      blue: "text-[#3FA9FF]",
      green: "text-emerald-400",
      gold: "text-[#FFCF4A]",
    }[band.key] ?? "text-white"
  );
}

export default function PerformancePanel({
  loadCurrent,
  loadHistory,
  loadAggregate,
  deps = [],
  title,
}) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState("month-0");
  const [detailsOpen, setDetailsOpen] = useState(false);

  // The current month (the home-card figure) and the weekly history are
  // always loaded: the panel opens on the month, and the trend chart wants
  // the weekly series regardless of which period is selected.
  const { data: current, loading: currentLoading, error: currentError } = useAsync(loadCurrent, { deps });
  const { data: weekly, loading: weeklyLoading } = useAsync(
    () => loadHistory({ periodType: "WEEK", limit: 13 }),
    { deps }
  );
  const { data: monthly } = useAsync(() => loadHistory({ periodType: "MONTH", limit: 12 }), { deps });
  const { data: sixMonth } = useAsync(() => loadAggregate({ months: 6 }), { deps });
  const { data: year } = useAsync(() => loadAggregate({ months: 12 }), { deps });

  // The current WEEK is a separate live call — history only ever returns
  // CLOSED periods, so "This Week" cannot come from it.
  const { data: currentWeek } = useAsync(() => loadCurrent({ periodType: "WEEK" }), { deps });

  const options = useMemo(
    () => [
      { key: "month-0", label: t("emp.perfThisMonth") },
      { key: "month-1", label: t("emp.perfLastMonth") },
      ...WEEK_OFFSETS.map((w) => ({ key: w.key, label: t(w.label) })),
      { key: "agg-6", label: t("emp.perfSixMonths") },
      { key: "agg-12", label: t("emp.perfOneYear") },
    ],
    [t]
  );

  // Resolve the selected period to something renderable. Each branch
  // returns a uniform shape so the view below never branches on source.
  const selected = useMemo(() => {
    const weeklyPeriods = weekly?.periods ?? [];
    const monthlyPeriods = monthly?.periods ?? [];

    if (period === "month-0") {
      return { kind: "period", data: current?.current, label: t("emp.perfThisMonth"), provisional: true };
    }
    if (period === "month-1") {
      return { kind: "period", data: monthlyPeriods[0], label: t("emp.perfLastMonth") };
    }
    if (period === "week-0") {
      return { kind: "period", data: currentWeek?.current, label: t("emp.perfThisWeek"), provisional: true };
    }
    if (period === "week-1" || period === "week-2") {
      const index = period === "week-1" ? 0 : 1;
      return { kind: "period", data: weeklyPeriods[index], label: options.find((o) => o.key === period)?.label };
    }
    if (period === "agg-6") return { kind: "aggregate", data: sixMonth, label: t("emp.perfSixMonths") };
    return { kind: "aggregate", data: year, label: t("emp.perfOneYear") };
  }, [period, current, currentWeek, weekly, monthly, sixMonth, year, t, options]);

  const score = selected.data?.score ?? null;
  const noData = selected.data == null || selected.data?.status === "NO_DATA" || score == null;

  return (
    <div className="flex flex-col gap-3">
      {title && <h2 className="px-1 text-[15px] font-semibold text-white">{title}</h2>}

      <PeriodSelector value={period} onChange={setPeriod} options={options} />

      {/* Hero — the score for whichever period is selected. */}
      <section className="relative overflow-hidden rounded-[22px] p-4 bg-[#0D1223]/80 border border-white/[0.07] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.8)]">
        <HeroTexture />
        <div className="relative flex items-center gap-4">
          <div className="shrink-0">
            {/* animateKey includes the period so switching periods always
                replays the settle-in travel, even on the rare occasion two
                different periods land on an identical score. */}
            <PerformanceScoreRing rate={score} size={132} useScoreBandColor animateKey={`${period}:${score}`} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#8B93A8]">{selected.label}</p>
            <p className={`mt-0.5 font-display text-[30px] font-bold leading-none tabular-nums ${scoreTextClass(score)}`}>
              {noData ? "—" : score}
              {!noData && <span className="text-[14px] font-medium text-[#5C6479]"> / 100</span>}
            </p>

            {currentLoading || weeklyLoading ? (
              <p className="mt-1.5 text-[11px] text-[#5C6479]">{t("emp.loadingPerformance")}</p>
            ) : noData ? (
              // Honest empty state. A period with nothing measurable is NOT
              // a zero, and must never be displayed as one.
              <p className="mt-1.5 text-[11px] leading-snug text-[#5C6479]">{t("emp.perfNoDataPeriod")}</p>
            ) : (
              <>
                {selected.provisional && (
                  <p className="mt-1.5 text-[10.5px] text-[#8B93A8]">{t("emp.perfInProgress")}</p>
                )}
                {selected.kind === "aggregate" && selected.data?.coverage && (
                  <p className="mt-1.5 text-[10.5px] text-[#8B93A8]">
                    {t("emp.perfCoverage", { coverage: selected.data.coverage })}
                  </p>
                )}
                {selected.data?.inputsComplete === false && (
                  <p className="mt-1 text-[10.5px] text-amber-400/90">{t("emp.perfPartialHistory")}</p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {currentError && (
        <p className="px-1 text-[11px] text-[#FF5C5C]">{t("emp.couldNotLoadPerformance")}</p>
      )}

      {/* Why am I this score? — the compact five-category strip is the
          new primary view; only meaningful for a single period, since an
          aggregate has no single set of categories behind it. */}
      {selected.kind === "period" && !noData && (
        <section>
          <div className="flex items-center justify-between px-1 mb-2">
            <h3 className="text-[13px] font-semibold text-white">{t("emp.perfBreakdownTitle")}</h3>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-medium text-[#8B93A8] hover:text-white transition-colors"
              aria-expanded={detailsOpen}
            >
              {detailsOpen ? t("emp.perfHideDetails") : t("emp.perfViewDetails")}
              <ChevronDown size={13} className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          <CategoryStatusRow categories={selected.data?.categories} onOpenDetails={() => setDetailsOpen(true)} />

          {/* The full detailed breakdown — completely unchanged component,
              just tucked behind this toggle instead of always expanded.
              All the same data (reviewed counts, penalty hours, streak
              numbers, etc.) is still reachable here. */}
          {detailsOpen && (
            <div className="mt-2.5">
              <CategoryBreakdown categories={selected.data?.categories} />
            </div>
          )}
        </section>
      )}

      <StreakCard streaks={current?.streaks} />

      <ScoreTrend weekly={weekly?.periods} monthly={monthly?.periods} />
    </div>
  );
}
