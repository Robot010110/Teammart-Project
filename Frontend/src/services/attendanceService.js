import { apiRequest } from "./apiClient";

// attendanceService.js — talks to /api/attendance (the Employee's own
// monthly attendance: check-in/out, breaks, shift, day-off, and
// reward/extra/penalty adjustments). Mirrors
// backend/src/controllers/attendanceController.js — one endpoint,
// getAttendanceMonth, returns everything a month view needs in one call.

export function getAttendanceMonth({ year, month } = {}) {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (month) params.set("month", month);
  const query = params.toString();
  return apiRequest(`/attendance/month${query ? `?${query}` : ""}`);
}

// getPerformanceHistory — Attendance Rate for each of the last `months`
// *completed* calendar months (current month is never included; see
// backend/src/controllers/attendanceController.js for why).
export function getPerformanceHistory({ months } = {}) {
  const params = new URLSearchParams();
  if (months) params.set("months", months);
  const query = params.toString();
  return apiRequest(`/attendance/performance-history${query ? `?${query}` : ""}`);
}
