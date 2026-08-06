import { apiRequest } from "./apiClient";

// leaveRequestService.js — talks to /api/leave-requests (Off Day /
// Personal Leave requests, spec §10). Mirrors
// backend/src/controllers/leaveRequestsController.js one function per
// endpoint the Employee UI actually calls — the staff-side approval
// queue has no frontend caller yet (no Supervisor screen exists), same
// as several other backend-ready endpoints in this app. Shared by both
// EmployeeWorkspace.jsx (Worker) and CashierWorkspace.jsx (Cashier).

// payload: { date, type: "MONTHLY_OFF" | "PERSONAL_LEAVE", reason? }
export function createLeaveRequest(payload) {
  return apiRequest("/leave-requests", { method: "POST", body: payload });
}

export function listMyLeaveRequests() {
  return apiRequest("/leave-requests");
}
