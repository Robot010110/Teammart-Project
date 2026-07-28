import { apiRequest } from "./apiClient";

// attendanceService.js — talks to /api/attendance (the Employee's own
// worked hours + supervisor adjustment history). Mirrors
// backend/src/controllers/attendanceController.js one function per
// endpoint, same pattern as activityService.js / suddenTaskService.js.

export function getAttendanceSummary() {
  return apiRequest("/attendance/summary");
}

export function listAttendanceAdjustments() {
  return apiRequest("/attendance/adjustments");
}
