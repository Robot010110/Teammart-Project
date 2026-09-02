import { apiRequest } from "./apiClient";

// suddenTaskService.js — talks to /api/sudden-tasks (an urgent task a
// Supervisor pushes at an employee). Mirrors
// backend/src/controllers/suddenTasksController.js one function per
// endpoint, same as activityService.js does for /api/activities.

export function listSuddenTasks({ status, priority, employeeId } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  if (employeeId) params.set("employeeId", employeeId);
  const query = params.toString();
  return apiRequest(`/sudden-tasks${query ? `?${query}` : ""}`);
}

export function getSuddenTask(id) {
  return apiRequest(`/sudden-tasks/${id}`);
}

// My Tasks redesign — ASSIGNED -> IN_PROGRESS, starts the real
// server-side timer (startedAt). Completion is only allowed after this.
export function startSuddenTask(id) {
  return apiRequest(`/sudden-tasks/${id}/start`, { method: "PATCH" });
}

// evidenceUrl is optional — a task can still be completed without a
// photo, but when the caller has one (see SuddenTaskDetailScreen), it's
// attached here.
export function completeSuddenTask(id, evidenceUrl) {
  return apiRequest(`/sudden-tasks/${id}/complete`, { method: "PATCH", body: { evidenceUrl } });
}

// --- Staff-only (Supervisor Mode) ---
// listSuddenTasks above already works for a staff caller too — the
// backend force-scopes a SUPERVISOR token to their own market regardless
// of any marketId passed, so no separate "for market" wrapper is needed,
// unlike leave-requests/wasted-overall/etc. (those have a genuinely
// different staff-only route+response shape; this one doesn't).

// payload: { employeeId, title, description, priority?, category?,
// dueAt?, location?, notes? } — category/dueAt/location/notes are all
// optional (My Tasks redesign).
export function assignSuddenTask(payload) {
  return apiRequest("/sudden-tasks/assign", { method: "POST", body: payload });
}
