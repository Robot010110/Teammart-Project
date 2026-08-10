import { apiRequest } from "./apiClient";

// suddenTaskService.js — talks to /api/sudden-tasks (an urgent task a
// Supervisor pushes at an employee). Mirrors
// backend/src/controllers/suddenTasksController.js one function per
// endpoint, same as activityService.js does for /api/activities.
//
// No create/assign function here on purpose — assigning a Sudden Task is
// a staff action (POST /api/sudden-tasks/assign) with no Supervisor UI
// yet. The endpoint exists and is tested; add the wrapper here once that
// module is built.

export function listSuddenTasks({ status, priority } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  const query = params.toString();
  return apiRequest(`/sudden-tasks${query ? `?${query}` : ""}`);
}

export function getSuddenTask(id) {
  return apiRequest(`/sudden-tasks/${id}`);
}

// evidenceUrl is optional — a task can still be completed without a
// photo, but when the caller has one (see SuddenTaskDetailScreen), it's
// attached here.
export function completeSuddenTask(id, evidenceUrl) {
  return apiRequest(`/sudden-tasks/${id}/complete`, { method: "PATCH", body: { evidenceUrl } });
}
