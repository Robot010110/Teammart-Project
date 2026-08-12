import { apiRequest } from "./apiClient";

// priceReportService.js — talks to /api/price-reports (a Cashier flagging
// a shelf-vs-POS price mismatch). Mirrors
// backend/src/controllers/priceReportsController.js one function per
// endpoint.

// payload: { productName, barcode?, shelfPrice, systemPrice, notes?, photoUrl? }
export function createPriceReport(payload) {
  return apiRequest("/price-reports", { method: "POST", body: payload });
}

export function listPriceReports() {
  return apiRequest("/price-reports");
}

// --- Staff-only (Supervisor Mode) ---
export function listPriceReportsForMarket({ marketId, status } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiRequest(`/price-reports/market${query ? `?${query}` : ""}`);
}
