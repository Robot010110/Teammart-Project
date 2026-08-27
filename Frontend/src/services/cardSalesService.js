import { apiRequest } from "./apiClient";

// cardSalesService.js — talks to /api/card-sales. Mirrors
// backend/src/controllers/cardSalesController.js: submit is Supervisor
// or Overlooking only; the day/history views are open to any staff with
// market access.

// payload: { date, shift: "MORNING"|"AFTERNOON"|"NIGHT", photoUrl, photoUrl2? }
export function submitCardSales(payload) {
  return apiRequest("/card-sales", { method: "POST", body: payload });
}

// Returns { date, slots: { MORNING, AFTERNOON, NIGHT: { status, report } } }
export function getCardSalesDay(marketId, date) {
  const params = new URLSearchParams({ marketId, date });
  return apiRequest(`/card-sales/day?${params.toString()}`);
}

export function listCardSalesHistory({ marketId, from, to } = {}) {
  const params = new URLSearchParams({ marketId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiRequest(`/card-sales/history?${params.toString()}`);
}

// deleteCardSalesReport — staff with market access, real persisted
// (soft) delete.
export function deleteCardSalesReport(id) {
  return apiRequest(`/card-sales/${id}`, { method: "DELETE" });
}
