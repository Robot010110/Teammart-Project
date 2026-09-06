import { apiRequest } from "./apiClient";

// itemReportService.js — talks to /api/products (search only) and
// /api/item-reports (the Expired/Wasted Items module). Mirrors
// backend/src/controllers/productsController.js and
// itemReportsController.js one function per endpoint, same pattern as
// every other service file.

export function searchProducts({ search, barcode } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (barcode) params.set("barcode", barcode);
  const query = params.toString();
  return apiRequest(`/products${query ? `?${query}` : ""}`);
}

// payload: { productId, condition, quantity, notes?, imageUrl? }
export function createItemReport(payload) {
  return apiRequest("/item-reports", { method: "POST", body: payload });
}

export function listItemReports({ year, month } = {}) {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (month) params.set("month", month);
  const query = params.toString();
  return apiRequest(`/item-reports${query ? `?${query}` : ""}`);
}

// --- Staff-only (Supervisor Mode) ---
export function listItemReportsForMarket({ marketId, employeeId, condition, status } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (employeeId) params.set("employeeId", employeeId);
  if (condition) params.set("condition", condition);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiRequest(`/item-reports/market${query ? `?${query}` : ""}`);
}

// listZoneItemReports — the Regional Manager's zone-wide view of the
// SAME ItemReport rows an employee files and their Supervisor reviews.
// Note there is no zoneId/marketId parameter by design: the backend
// derives the scope from the caller's own token, so there is nothing
// here a client could change to reach another zone (see
// itemReportsController.listZoneItemReports).
// period: "today" | "week" | "month" | "all"
export function listZoneItemReports({ period, condition, page, pageSize } = {}) {
  const params = new URLSearchParams();
  if (period) params.set("period", period);
  if (condition) params.set("condition", condition);
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return apiRequest(`/item-reports/zone${query ? `?${query}` : ""}`);
}

// deleteItemReport — staff-only, real persisted (soft) delete; leaves
// the report's own market feed and the employee's own history
// immediately.
export function deleteItemReport(id) {
  return apiRequest(`/item-reports/${id}`, { method: "DELETE" });
}
