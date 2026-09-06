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

// createMarket — POST /api/markets. Admin or Regional Manager; an RM is
// checked server-side against their own zoneIds and gets a real 403 for
// any other zone (see marketsController.createMarket), so the zone
// picker in the UI is a convenience, never the security boundary.
// body: { name, zoneId (number), status? }
export function createMarket(body) {
  return apiRequest("/markets", { method: "POST", body });
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

// --- Supervisor directory (Admin / Regional Manager) ---
// A supervisor is a User assigned to a market (Market.supervisorId /
// overlookingSupervisorId), not a separate model — so these live in the
// markets service alongside the markets they're derived from. Scope is
// taken from the caller's own token server-side; there is no zone or
// market parameter here to pass, by design.

export function listAccessibleSupervisors() {
  return apiRequest("/markets/supervisors");
}

export function getAccessibleSupervisor(userId) {
  return apiRequest(`/markets/supervisors/${userId}`);
}
