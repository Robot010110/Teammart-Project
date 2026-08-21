import { apiRequest } from "./apiClient";

// totalSalesService.js — talks to /api/total-sales. Mirrors
// backend/src/controllers/totalSalesController.js: submit is
// Supervisor-only, list is Regional-Manager/Admin-only (see that
// controller's own comment on why there is deliberately no
// Supervisor-facing read endpoint here).

// payload: { date, amount, photoUrl }
export function submitTotalSales(payload) {
  return apiRequest("/total-sales", { method: "POST", body: payload });
}

export function listTotalSalesReports({ marketId, date, from, to } = {}) {
  const params = new URLSearchParams({ marketId });
  if (date) params.set("date", date);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiRequest(`/total-sales?${params.toString()}`);
}
