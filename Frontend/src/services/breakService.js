import { apiRequest } from "./apiClient";

// breakService.js — talks to /api/breaks (Phase 1 foundation). Mirrors
// backend/src/controllers/breaksController.js. Works for both Employee/
// Cashier and Supervisor/Overlooking, same as attendanceService's
// checkIn/checkOut — the backend decides ownership from the token, never
// from anything sent here.
//
// remainingSeconds on the returned break is computed server-side, fresh,
// every call (see breakService.remainingSeconds on the backend) — never
// trust a locally-decremented countdown across a refresh; always re-poll
// this instead.

// getMyBreak — the caller's current break, or null if none. Poll this
// (e.g. every 15-30s while a break is ACTIVE) to keep a countdown in
// sync with the server rather than trusting a local timer.
export function getMyBreak() {
  return apiRequest("/breaks/me");
}

export function confirmBreak(breakId) {
  return apiRequest(`/breaks/${breakId}/confirm`, { method: "PATCH" });
}

export function cancelBreak(breakId, reason) {
  return apiRequest(`/breaks/${breakId}/cancel`, { method: "PATCH", body: { reason } });
}
