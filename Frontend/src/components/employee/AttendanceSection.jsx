import { useState } from "react";
import { Clock3 } from "lucide-react";
import AttendanceSummaryCards from "./AttendanceSummaryCards";
import AttendanceCalendar from "./AttendanceCalendar";
import AttendanceHistoryList from "./AttendanceHistoryList";
import SubmitExtraHoursModal from "./SubmitExtraHoursModal";
import MissingCheckoutBanner from "./MissingCheckoutBanner";
import AttendanceCheckInCard from "../common/AttendanceCheckInCard";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import MonthPager from "../common/MonthPager";
import Toast from "../common/Toast";
import { getAttendanceMonth } from "../../services/attendanceService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

// AttendanceSection.jsx — worked hours, not a task. Fetches
// GET /api/attendance/month for the selected month (defaults to current)
// and composes the summary tiles and day-by-day calendar below it. No
// mutation UI here — importing records and adding adjustments are staff
// actions (see attendanceController.js), not something an employee does
// to themselves.
//
// Adjustment/penalty reasons are shown once, inline per-day inside
// AttendanceCalendar (AdjustmentCallout/PenaltyCallout) — a separate
// AttendanceAdjustmentHistory section used to repeat the same data again
// in its own card directly below the calendar; removed as a duplicate
// vertical section, since every adjustment it listed was already visible
// on its own day in the calendar immediately above it.

export default function AttendanceSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [toast, setToast] = useToast();

  const { data, error, loading, reload } = useAsync(() => getAttendanceMonth({ year, month }), {
    deps: [year, month],
    fallbackError: "Could not load your attendance.",
  });

  function handleSubmitted() {
    setSubmitOpen(false);
    setHistoryKey((k) => k + 1);
    setToast("Extra hours sent to your Supervisor for review.");
  }

  return (
    <div className="space-y-3">
      <AttendanceCheckInCard />
      <MissingCheckoutBanner />

      <div className="flex items-center justify-end">
        <MonthPager year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {loading && <SkeletonCard className="h-[280px]" />}
      {!loading && error && <ErrorBanner message={error} onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <AttendanceSummaryCards summary={data.summary} />
          <AttendanceCalendar days={data.days} onChanged={reload} />
        </>
      )}

      <section className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">History</h2>
          <button
            type="button"
            onClick={() => setSubmitOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
          >
            <Clock3 size={13} /> Submit Extra Hours
          </button>
        </div>
        <AttendanceHistoryList key={historyKey} />
      </section>

      {submitOpen && <SubmitExtraHoursModal onClose={() => setSubmitOpen(false)} onSubmitted={handleSubmitted} />}
      <Toast message={toast} />
    </div>
  );
}
