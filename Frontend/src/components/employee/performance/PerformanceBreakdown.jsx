import { Users, ClipboardList, Award, ShieldCheck, ArrowUpRight, ArrowDownRight } from "lucide-react";
import AnimatedNumber from "../../common/AnimatedNumber";
import Sparkline from "./Sparkline";

// PerformanceBreakdown.jsx — a horizontally swipeable row of the real
// components of this employee's performance.
//
// On the metrics: the design's example list (Attendance / Tasks /
// Activity Quality / Compliance) is a visual reference, and TeamMart has
// no compliance model and no employee-facing task-completion rate — so
// those two are NOT fabricated. What is shown is what the backend can
// really answer:
//
//   Attendance       GET /api/attendance/performance-history — real
//                    attendanceRate per COMPLETED month (that endpoint
//                    deliberately never reports the in-progress month).
//   Activity Quality GET /api/activities/performance — approved / reviewed.
//   Reviewed Work    the same summary's real totalReviewed count.
//   Consistency      share of returned weekly buckets with any reviewed
//                    activity — derived from real history.
//
// Sparklines and trend deltas are drawn ONLY where a real series exists
// (see Sparkline.jsx, which renders nothing below two real points).
// A metric with no data shows an em dash, never a zero placeholder.
//
// Horizontal scroll rather than a 4-up grid: four readable cards do not
// fit across a 360px phone without shrinking the numbers to nothing.

const TONES = {
  emerald: { text: "text-emerald-400", hex: "#34D399", bg: "bg-emerald-500/[0.12]", border: "border-emerald-500/[0.22]", glow: "shadow-[0_0_14px_1px_rgba(52,211,153,0.35)]" },
  orange: { text: "text-[#F9A03C]", hex: "#F9A03C", bg: "bg-[#F47A20]/[0.12]", border: "border-[#F47A20]/[0.22]", glow: "shadow-[0_0_14px_1px_rgba(244,122,32,0.35)]" },
  violet: { text: "text-violet-400", hex: "#A78BFA", bg: "bg-violet-500/[0.12]", border: "border-violet-500/[0.22]", glow: "shadow-[0_0_14px_1px_rgba(167,139,250,0.35)]" },
  sky: { text: "text-sky-400", hex: "#38BDF8", bg: "bg-sky-500/[0.12]", border: "border-sky-500/[0.22]", glow: "shadow-[0_0_14px_1px_rgba(56,189,248,0.35)]" },
};

function MetricCard({ icon: Icon, label, value, suffix = "", tone, series, delta, deltaSuffix = "%", caption }) {
  const t = TONES[tone];
  const has = value != null;

  return (
    <article
      className={`snap-start shrink-0 w-[152px] rounded-[18px] p-3 bg-[#0D1223]/80 border ${t.border} shadow-[0_8px_28px_-12px_rgba(0,0,0,0.9)]`}
    >
      <span className={`w-9 h-9 rounded-xl grid place-items-center ${t.bg} ${t.glow} ${t.text}`}>
        <Icon size={16} strokeWidth={2.1} />
      </span>

      <p className="mt-2.5 text-[12px] font-medium text-white">{label}</p>
      <p className={`mt-0.5 font-display text-[24px] font-bold leading-none tabular-nums ${has ? t.text : "text-[#4C5266]"}`}>
        {has ? (
          <>
            <AnimatedNumber value={value} />
            {suffix}
          </>
        ) : (
          "—"
        )}
      </p>

      <div className="mt-2 flex items-end justify-between gap-1.5 h-[24px]">
        {delta != null ? (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
              delta > 0 ? "text-emerald-400" : delta < 0 ? "text-[#FF5C5C]" : "text-[#5C6479]"
            }`}
          >
            {delta > 0 ? <ArrowUpRight size={11} /> : delta < 0 ? <ArrowDownRight size={11} /> : null}
            {delta > 0 ? "+" : ""}
            {delta}
            {deltaSuffix}
          </span>
        ) : (
          <span className="text-[10px] text-[#4C5266] leading-tight">{caption}</span>
        )}
        <Sparkline values={series} color={t.hex} />
      </div>
    </article>
  );
}

export default function PerformanceBreakdown({ summary, weekly, attendanceHistory, attendanceError, onViewAll }) {
  // Attendance — API returns newest-first; a sparkline reads oldest-first.
  const attendanceSeries = [...(attendanceHistory ?? [])]
    .reverse()
    .map((m) => m.summary?.attendanceRate ?? null);
  const attendanceRate = attendanceHistory?.[0]?.summary?.attendanceRate ?? null;
  const prevAttendance = attendanceHistory?.[1]?.summary?.attendanceRate ?? null;
  const attendanceDelta =
    attendanceRate != null && prevAttendance != null ? Math.round(attendanceRate - prevAttendance) : null;

  // Activity quality — weekly rates, oldest-first for the sparkline.
  const qualitySeries = [...(weekly ?? [])].reverse().map((w) => w.rate);
  const qualityDelta =
    weekly?.[0]?.rate != null && weekly?.[1]?.rate != null
      ? Math.round(weekly[0].rate - weekly[1].rate)
      : null;

  // Reviewed volume — real counts per week.
  const reviewedSeries = [...(weekly ?? [])].reverse().map((w) => w.totalReviewed);
  const reviewedDelta =
    weekly?.[0] && weekly?.[1] ? weekly[0].totalReviewed - weekly[1].totalReviewed : null;

  const reviewedWeeks = (weekly ?? []).filter((w) => w.totalReviewed > 0).length;
  const totalWeeks = (weekly ?? []).length;
  const consistency = totalWeeks > 0 ? (reviewedWeeks / totalWeeks) * 100 : null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-white">Performance Breakdown</h2>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[12px] font-semibold text-[#F47A20] hover:text-[#ff8b36] transition-colors"
          >
            View All
          </button>
        )}
      </div>

      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2.5 overflow-x-auto snap-x pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
          <MetricCard
            icon={Users}
            label="Attendance"
            value={attendanceRate == null ? null : Math.round(attendanceRate)}
            suffix="%"
            tone="emerald"
            series={attendanceSeries}
            delta={attendanceDelta}
            caption={attendanceError ? "Unavailable" : "No completed month yet"}
          />
          <MetricCard
            icon={ClipboardList}
            label="Reviewed Work"
            value={summary?.totalReviewed ?? null}
            tone="orange"
            series={reviewedSeries}
            delta={reviewedDelta}
            deltaSuffix=""
            caption={`${summary?.approved ?? 0} approved`}
          />
          <MetricCard
            icon={Award}
            label="Activity Quality"
            value={summary?.rate == null ? null : Math.round(summary.rate)}
            suffix="%"
            tone="violet"
            series={qualitySeries}
            delta={qualityDelta}
            caption="Approved share of reviewed work"
          />
          <MetricCard
            icon={ShieldCheck}
            label="Consistency"
            value={consistency == null ? null : Math.round(consistency)}
            suffix="%"
            tone="sky"
            series={(weekly ?? []).slice().reverse().map((w) => (w.totalReviewed > 0 ? 1 : 0))}
            caption={totalWeeks > 0 ? `Active ${reviewedWeeks}/${totalWeeks} weeks` : "Not enough history"}
          />
        </div>
      </div>
    </section>
  );
}
