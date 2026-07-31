import { apiRequest } from "./apiClient";

// priceReportService.js — talks to /api/price-reports (a Cashier flagging
// a shelf-vs-POS price mismatch). Mirrors
// backend/src/controllers/priceReportsController.js one function per
// endpoint the Cashier UI actually calls (the staff-side
// listPriceReportsForMarket has no frontend caller yet — no Supervisor
// screen exists — same as several other backend-ready endpoints in this
// app).

// payload: { productName, barcode?, shelfPrice, systemPrice, notes?, photoUrl? }
export function createPriceReport(payload) {
  return apiRequest("/price-reports", { method: "POST", body: payload });
}

export function listPriceReports() {
  return apiRequest("/price-reports");
}
