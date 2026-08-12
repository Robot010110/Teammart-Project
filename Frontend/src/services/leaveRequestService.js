import { apiRequest } from "./apiClient";

// leaveRequestService.js — talks to /api/leave-requests (Off Day /
// Personal Leave requests, spec §10). Mirrors
// backend/src/controllers/leaveRequestsController.js one function per
// endpoint the Employee UI actually calls — the staff-side approval
// queue has no frontend caller yet (no Supervisor screen exists), same
// as several other backend-ready endpoints in this app. Shared by both
// EmployeeWorkspace.jsx (Worker) and CashierWorkspace.jsx (Cashier).

// payload: { date, type: "MONTHLY_OFF" | "PERSONAL_LEAVE" | "EARNED_DAY_OFF", reason? }
// hoursSpent for EARNED_DAY_OFF is always set server-side (fixed 8h
// exchange rate) — never accepted from here, see leaveRequestsController.
export function createLeaveRequest(payload) {
  return apiRequest("/leave-requests", { method: "POST", body: payload });
}

export function listMyLeaveRequests() {
  return apiRequest("/leave-requests");
}

// --- Staff-only (Supervisor Mode) ---

export function listLeaveRequestsForMarket({ marketId, status } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiRequest(`/leave-requests/market${query ? `?${query}` : ""}`);
}

export function approveLeaveRequest(id, reviewNote) {
  return apiRequest(`/leave-requests/${id}/approve`, { method: "PATCH", body: { reviewNote } });
}

export function rejectLeaveRequest(id, reviewNote) {
  return apiRequest(`/leave-requests/${id}/reject`, { method: "PATCH", body: { reviewNote } });
}
