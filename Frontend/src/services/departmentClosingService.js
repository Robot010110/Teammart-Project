import { apiRequest } from "./apiClient";

// departmentClosingService.js — talks to the Department Closing surface
// of /api/activities and /api/markets (Phase 2). Mirrors
// backend/src/controllers/activitiesController.js and
// marketManagementController.js's department-monitoring endpoints.

// submitDepartmentClosing — the employee's own submission. Deliberately
// has no `department` parameter: the backend always uses the employee's
// own real, currently-assigned department (see activitiesController.
// createActivity's own comment) — there is nothing for this call to even
// get wrong on that front.
export function submitDepartmentClosing({ date, time, notes, status = "PENDING", imageUrls }) {
  return apiRequest("/activities", {
    method: "POST",
    body: { category: "DEPARTMENT_CLOSING", date, time, notes, status, imageUrls },
  });
}

// --- Staff-only (Supervisor Mode) ---

// submitDepartmentClosingForEmployee — an authorized Supervisor
// completing it on behalf of an ASSIGNED employee.
export function submitDepartmentClosingForEmployee(employeeId, { date, time, notes, status = "PENDING", imageUrls }) {
  return apiRequest(`/activities/department-closing/${employeeId}`, {
    method: "POST",
    body: { date, time, notes, status, imageUrls },
  });
}

// submitDepartmentClosingForUnassigned — an authorized Supervisor
// completing a genuinely unassigned department (no employee at all).
export function submitDepartmentClosingForUnassigned(marketId, { date, time, notes, status = "PENDING", imageUrls, department }) {
  return apiRequest(`/activities/department-closing/market/${marketId}`, {
    method: "POST",
    body: { date, time, notes, status, imageUrls, department },
  });
}

export function listMarketDepartments(marketId, { date } = {}) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiRequest(`/markets/${marketId}/departments${query}`);
}

export function addMarketDepartment(marketId, name) {
  return apiRequest(`/markets/${marketId}/departments`, { method: "POST", body: { name } });
}

export function getMarketDepartmentCompletion(marketId, { date } = {}) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiRequest(`/markets/${marketId}/departments/completion${query}`);
}

// sendDepartmentReport — the backend independently re-validates
// completion before sending (never trusts anything computed here); this
// call may come back as a 400 (incomplete, override needed) or 409
// (already sent) ApiError — the caller surfaces both distinctly.
export function sendDepartmentReport(marketId, { date, shift, override, overrideReason }) {
  return apiRequest(`/markets/${marketId}/department-report`, {
    method: "POST",
    body: { date, shift, override, overrideReason },
  });
}
