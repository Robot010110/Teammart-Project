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
