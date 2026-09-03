import { apiRequest } from "./apiClient";

// leaveRequestService.js — talks to /api/leave-requests (Off Day /
// Personal Leave requests, spec §10). Mirrors
// backend/src/controllers/leaveRequestsController.js one function per
// endpoint the Employee UI actually calls — the staff-side approval
// queue has no frontend caller yet (no Supervisor screen exists), same
// as several other backend-ready endpoints in this app. Shared by both
// EmployeeWorkspace.jsx (Worker) and CashierWorkspace.jsx (Cashier).

// payload: { date, type: "WEEKLY_OFF" | "MONTHLY_OFF" | "EMERGENCY_OFF" |
//            "PERSONAL_LEAVE" | "EARNED_DAY_OFF", reason? }
// hoursSpent for EARNED_DAY_OFF is always set server-side (fixed 8h
// exchange rate) — never accepted from here, see leaveRequestsController.
//
// WEEKLY_OFF/MONTHLY_OFF/EMERGENCY_OFF (the Attendance calendar's Choose
// Off Type sheet — see OffDaySheet.jsx) return with `status: "APPROVED"`
// immediately and a `notified: boolean` flag — there is no review step
// for these three, unlike PERSONAL_LEAVE/EARNED_DAY_OFF below.
export function createLeaveRequest(payload) {
  return apiRequest("/leave-requests", { method: "POST", body: payload });
}

// date: a Date or ISO string for the day the employee tapped. Real
// weekly/monthly usage for the week/month containing it — powers
// OffDaySheet's live "1/1 Used" quota display and disabled-option
// explanations. This is UX only; the backend re-checks authoritatively
// on create regardless of what this returned.
export function getOffDayQuota(date) {
  const iso = date instanceof Date ? date.toISOString().slice(0, 10) : date;
  return apiRequest(`/leave-requests/quota?date=${encodeURIComponent(iso)}`);
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
