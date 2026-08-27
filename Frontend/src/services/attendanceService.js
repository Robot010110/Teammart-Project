import { apiRequest } from "./apiClient";

// attendanceService.js — talks to /api/attendance (the Employee's own
// monthly attendance: check-in/out, breaks, shift, day-off, and
// reward/extra/penalty adjustments). Mirrors
// backend/src/controllers/attendanceController.js — one endpoint,
// getAttendanceMonth, returns everything a month view needs in one call.

// checkIn/checkOut — Phase 1 cross-role live attendance: works for
// Employee/Cashier AND Supervisor/Overlooking, through the exact same
// backend endpoint/AttendanceRecord table (see
// attendanceController.checkIn's own comment). No body — the server's
// own clock is the only source of truth for the timestamp.
export function checkIn() {
  return apiRequest("/attendance/check-in", { method: "POST" });
}

export function checkOut() {
  return apiRequest("/attendance/check-out", { method: "POST" });
}

// startBreak/endBreak — self-service break tied directly to today's
// AttendanceRecord (Repair Pass §1). The 4-hour-after-check-in gate is
// enforced server-side (attendanceController.startBreak) — this call can
// fail with a real error message before the 4-hour mark, it never
// silently succeeds just because the button was clickable.
export function startBreak() {
  return apiRequest("/attendance/break-start", { method: "POST" });
}

export function endBreak() {
  return apiRequest("/attendance/break-end", { method: "POST" });
}

// getTodayAttendance — this account's own AttendanceRecord for today (or
// null). Called on mount so check-in/break/check-out state survives a
// refresh or re-login instead of resetting to "Not checked in yet" until
// the next button tap.
export function getTodayAttendance() {
  return apiRequest("/attendance/today");
}

// getMyStaffAttendanceMonth — Supervisor/Overlooking's own attendance
// (Phase 1). Deliberately a different, simpler shape than
// getAttendanceMonth above — Worker/Cashier-only extra/required/
// punishment-hours business rules don't apply to staff (see the backend
// controller's own comment).
export function getMyStaffAttendanceMonth({ year, month } = {}) {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (month) params.set("month", month);
  const query = params.toString();
  return apiRequest(`/attendance/me/month${query ? `?${query}` : ""}`);
}

export function getAttendanceMonth({ year, month } = {}) {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (month) params.set("month", month);
  const query = params.toString();
  return apiRequest(`/attendance/month${query ? `?${query}` : ""}`);
}

// confirmStillWorking — answers the "Are you still working?" missing-
// checkout prompt with Yes (spec §7). See attendanceController.js's own
// comment: this is an acknowledgement, not itself a source of extra-hours
// data — a real checkOut is still what the calculation actually uses.
export function confirmStillWorking(recordId) {
  return apiRequest("/attendance/still-working", { method: "POST", body: { recordId } });
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

// Extra-hours self-submission (spec §10-14) — employee submits a claim
// for one date, PENDING until their market's Supervisor reviews it. See
// attendanceController.js's own comment on why this is deliberately kept
// separate from the reward/extra RequiredHoursAdjustment above and never
// folded into the attendance-rate/extra-hours-balance calculations.

// payload: { date, hours, reason? }
export function submitExtraHours(payload) {
  return apiRequest("/attendance/extra-hours", { method: "POST", body: payload });
}

export function listMyExtraHoursRequests() {
  return apiRequest("/attendance/extra-hours");
}

// deleteMyExtraHoursRequest — cancel your own still-PENDING Extra Hours
// request. Once a Supervisor has decided it, it can no longer be
// cancelled this way (see attendanceController.deleteMyExtraHoursRequest).
export function deleteMyExtraHoursRequest(id) {
  return apiRequest(`/attendance/extra-hours/${id}`, { method: "DELETE" });
}

// deleteMyRequiredHoursAdjustment / deleteMyPunishment — dismiss your
// OWN Required Hours Adjustment / Penalty, only once it's old enough
// (see attendanceController.js's MANUAL_CLEAR_AFTER_DAYS) — a fresh one
// is staff-only to remove, so this can never be used to erase a
// just-applied penalty. Both are also eventually cleared automatically
// after 30 days regardless (maintenanceScheduler.runAdjustmentRetentionSweep).
export function deleteMyRequiredHoursAdjustment(id) {
  return apiRequest(`/attendance/required-hours-adjustments/${id}`, { method: "DELETE" });
}

export function deleteMyPunishment(attendanceRecordId) {
  return apiRequest(`/attendance/${attendanceRecordId}/punishment`, { method: "DELETE" });
}

// getAttendanceHistory — the current employee's combined Work/Attendance
// History (spec §13): every extra-hours submission (any status) plus
// every day with punishment hours applied, newest first. Never
// hardcoded — every row comes straight from the database.
export function getAttendanceHistory({ months } = {}) {
  const params = new URLSearchParams();
  if (months) params.set("months", months);
  const query = params.toString();
  return apiRequest(`/attendance/history${query ? `?${query}` : ""}`);
}

// --- Staff-only (Supervisor Mode) ---

// payload: { marketId?, status?, employeeId? }
export function listExtraHoursRequestsForMarket({ marketId, status, employeeId } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (status) params.set("status", status);
  if (employeeId) params.set("employeeId", employeeId);
  const query = params.toString();
  return apiRequest(`/attendance/extra-hours/market${query ? `?${query}` : ""}`);
}

// payload: { status: "APPROVED" | "REJECTED", reviewNote? }
export function reviewExtraHoursRequest(requestId, payload) {
  return apiRequest(`/attendance/extra-hours/${requestId}/review`, { method: "POST", body: payload });
}
