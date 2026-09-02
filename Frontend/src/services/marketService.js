import { apiRequest } from "./apiClient";

// marketService.js — talks to /api/markets. Mirrors
// backend/src/controllers/marketsController.js. Staff-only; for
// Supervisor Mode this is always scoped server-side to the caller's own
// market (a Supervisor token can never see another market's row).

export function listMarkets() {
  return apiRequest("/markets");
}

export function getMarket(id) {
  return apiRequest(`/markets/${id}`);
}

// updateMarket — Admin or the owning Regional Manager. Currently used
// for photoUrl (a market's own storefront photo — see Market.photoUrl's
// schema comment); the same generic endpoint also accepts name/status,
// unchanged from before this was added.
export function updateMarket(id, body) {
  return apiRequest(`/markets/${id}`, { method: "PATCH", body });
}

// Admin Phase 2 — ADMIN-only (or the owning Regional Manager). Pass null
// to unassign. Reassigning to a different market automatically clears
// the stale prior assignment server-side (see marketsController's own
// comment).
export function assignMarketSupervisor(marketId, supervisorId) {
  return apiRequest(`/markets/${marketId}/supervisor`, { method: "PATCH", body: { supervisorId } });
}

export function assignMarketOverlookingSupervisor(marketId, overlookingSupervisorId) {
  return apiRequest(`/markets/${marketId}/overlooking-supervisor`, { method: "PATCH", body: { overlookingSupervisorId } });
}
