import { useState } from "react";
import AttendanceSummaryCards from "./AttendanceSummaryCards";
import AttendanceCalendar from "./AttendanceCalendar";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import MonthPager from "../common/MonthPager";
import { getAttendanceMonth } from "../../services/attendanceService";
import { useAsync } from "../../hooks/useAsync";

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

  const { data, error, loading, reload } = useAsync(() => getAttendanceMonth({ year, month }), {
    deps: [year, month],
    fallbackError: "Could not load your attendance.",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <MonthPager year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {loading && <SkeletonCard className="h-[280px]" />}
      {!loading && error && <ErrorBanner message={error} onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <AttendanceSummaryCards summary={data.summary} />
          <AttendanceCalendar days={data.days} />
        </>
      )}
    </div>
  );
}
