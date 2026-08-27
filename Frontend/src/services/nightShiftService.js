import { apiRequest } from "./apiClient";

// nightShiftService.js — talks to /api/night-shift, plus the Washing
// Market completion flow which deliberately reuses the existing generic
// Activity endpoints (see activitiesController.updateActivity/addActivityImage's
// own Night Shift extension) rather than a bespoke submission endpoint —
// this file exposes those same activityService functions again here so a
// caller never has to import two service files to run one workflow.
export { addActivityImage, deleteActivityImage, updateActivity, prepareImageForUpload } from "./activityService";

// GET /api/night-shift/my-dashboard — employee-only. Returns
// { employeeId, marketId, operationalShift, operationalDate,
//   mainDepartment, additionalDepartments, tasks: [{ id, key, name,
//   description, requiresEvidence, minPhotos, photoCount, status, label,
//   images }] }
export function getMyNightShiftDashboard() {
  return apiRequest("/night-shift/my-dashboard");
}

// --- Staff-only (management) -----------------------------------------

// GET /api/night-shift/task-definitions — any staff role (ADMIN,
// REGIONAL_MANAGER, SUPERVISOR, OVERLOOKING_SUPERVISOR).
export function listTaskDefinitions() {
  return apiRequest("/night-shift/task-definitions");
}

// POST /api/night-shift/task-definitions — ADMIN-only.
export function createTaskDefinition(payload) {
  return apiRequest("/night-shift/task-definitions", { method: "POST", body: payload });
}

// PATCH /api/night-shift/task-definitions/:id — ADMIN-only.
export function updateTaskDefinition(id, payload) {
  return apiRequest(`/night-shift/task-definitions/${id}`, { method: "PATCH", body: payload });
}

// GET /api/night-shift/market/:marketId — staff-only management view,
// server-scoped to markets the caller actually has access to (Supervisor:
// their own market; RM/Overlooking: their zone's markets; Admin: any).
// Returns the raw Activity rows (category NIGHT_SHIFT_TASK) for that
// market, most recent first, each with { images, nightShiftTaskDefinition,
// employee: { id, name, employeeCode, operationalShift } }.
export function listNightShiftActivityForMarket(marketId) {
  return apiRequest(`/night-shift/market/${marketId}`);
}
