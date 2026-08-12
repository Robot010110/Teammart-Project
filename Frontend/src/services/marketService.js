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
