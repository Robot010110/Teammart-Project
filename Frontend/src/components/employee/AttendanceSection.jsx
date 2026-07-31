import { useState } from "react";
import AttendanceSummaryCards from "./AttendanceSummaryCards";
import AttendanceCalendar from "./AttendanceCalendar";
import AttendanceAdjustmentHistory from "./AttendanceAdjustmentHistory";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import MonthPager from "../common/MonthPager";
import { getAttendanceMonth } from "../../services/attendanceService";
import { useAsync } from "../../hooks/useAsync";

// AttendanceSection.jsx — worked hours, not a task. Fetches
// GET /api/attendance/month for the selected month (defaults to current)
// and composes the summary tiles, day-by-day calendar, and adjustment
// history below it. No mutation UI here — importing records and adding
// adjustments are staff actions (see attendanceController.js), not
// something an employee does to themselves.

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
          <AttendanceAdjustmentHistory adjustments={data.adjustments} />
        </>
      )}
    </div>
  );
}
