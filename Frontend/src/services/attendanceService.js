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

// getExtraHoursBalance — the current employee's banked extra-work-hours
// balance (see attendanceController.computeExtraHoursBalance for how
// it's derived — never a stored/cached number).
export function getExtraHoursBalance() {
  return apiRequest("/attendance/extra-hours-balance");
}

// --- Staff-only (Supervisor Mode) — same data, for an arbitrary
// employee the caller has market access to instead of themselves. ---

export function getEmployeeAttendanceMonth(employeeId, { year, month } = {}) {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (month) params.set("month", month);
  const query = params.toString();
  return apiRequest(`/attendance/employee/${employeeId}/month${query ? `?${query}` : ""}`);
}

export function getEmployeeExtraHoursBalance(employeeId) {
  return apiRequest(`/attendance/employee/${employeeId}/extra-hours-balance`);
}

// payload: { employeeId, date, newRequiredHours: 4-16, reason }
export function createRequiredHoursAdjustment(payload) {
  return apiRequest("/attendance/required-hours-adjustments", { method: "POST", body: payload });
}

// payload: { employeeId, date, hours: 0-24, reason }
export function setPunishmentHours(payload) {
  return apiRequest("/attendance/punishment-hours", { method: "POST", body: payload });
}
