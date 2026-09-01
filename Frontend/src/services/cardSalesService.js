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

// Market Activities §3 — the zone-wide Card Sales completion summary.
// Returns { date, markets: [{marketId,name,completedCount,totalShifts,status,lastReminderAt}], summary }.
// status is one of COMPLETED | PENDING_REMINDER | NOT_COMPLETED | PENDING.
export function getZoneCardSalesSummary({ date } = {}) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  const query = params.toString();
  return apiRequest(`/card-sales/zone-summary${query ? `?${query}` : ""}`);
}

// Market Activities §4 — nudge a market that hasn't finished today's Card
// Sales reporting. Refused (409, surfaced as ApiError) once that market
// has already fully reported.
export function sendCardSalesReminder({ marketId, date }) {
  return apiRequest("/card-sales/remind", { method: "POST", body: { marketId, date } });
}
