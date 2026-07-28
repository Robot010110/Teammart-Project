import { useEffect, useState } from "react";
import AttendanceSummaryCards from "./AttendanceSummaryCards";
import AttendanceTargetBar from "./AttendanceTargetBar";
import AttendanceAdjustmentHistory from "./AttendanceAdjustmentHistory";
import ErrorBanner from "../common/ErrorBanner";
import { getAttendanceSummary } from "../../services/attendanceService";
import { ApiError } from "../../services/apiClient";

// AttendanceSection.jsx — worked hours, not a task. Fetches
// GET /api/attendance/summary on mount and composes the three display
// pieces below it. No mutation UI here — logging hours and adjustments is
// a staff action (see attendanceController.js), not something an
// employee does to themselves.

export default function AttendanceSection() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    return getAttendanceSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your attendance."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] animate-pulse h-[280px]" />;
  }
  if (error) {
    return <ErrorBanner message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-3">
      <AttendanceSummaryCards summary={summary} />
      <AttendanceTargetBar summary={summary} />
      <AttendanceAdjustmentHistory adjustments={summary.adjustments} />
    </div>
  );
}
