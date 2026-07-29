import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AttendanceSummaryCards from "./AttendanceSummaryCards";
import AttendanceCalendar from "./AttendanceCalendar";
import AttendanceAdjustmentHistory from "./AttendanceAdjustmentHistory";
import ErrorBanner from "../common/ErrorBanner";
import { getAttendanceMonth } from "../../services/attendanceService";
import { ApiError } from "../../services/apiClient";

// AttendanceSection.jsx — worked hours, not a task. Fetches
// GET /api/attendance/month for the selected month (defaults to current)
// and composes the summary tiles, day-by-day calendar, and adjustment
// history below it. No mutation UI here — importing records and adding
// adjustments are staff actions (see attendanceController.js), not
// something an employee does to themselves.

const MONTH_LABEL = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function AttendanceSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    return getAttendanceMonth({ year, month })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your attendance."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const changeMonth = (delta) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1.5 text-xs text-[#9AA1B4]">
        <button onClick={() => changeMonth(-1)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-white/[0.06]">
          <ChevronLeft size={13} />
        </button>
        <span className="min-w-[110px] text-center">{MONTH_LABEL(year, month)}</span>
        <button onClick={() => changeMonth(1)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-white/[0.06]">
          <ChevronRight size={13} />
        </button>
      </div>

      {loading && <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] animate-pulse h-[280px]" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
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
