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

export function listTotalSalesReports({ marketId, date, from, to, status } = {}) {
  const params = new URLSearchParams({ marketId });
  if (date) params.set("date", date);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (status) params.set("status", status);
  return apiRequest(`/total-sales?${params.toString()}`);
}

// Cleanup Phase §10 — Regional Manager Approve/Reject on a submitted
// report. payload: { status: "APPROVED" | "REJECTED", rejectionReason? }
export function reviewTotalSalesReport(id, payload) {
  return apiRequest(`/total-sales/${id}/review`, { method: "PATCH", body: payload });
}

// deleteTotalSalesReport — Regional Manager/Admin-only, real persisted
// (soft) delete (matches the same restriction as viewing/reviewing this
// report type).
export function deleteTotalSalesReport(id) {
  return apiRequest(`/total-sales/${id}`, { method: "DELETE" });
}
