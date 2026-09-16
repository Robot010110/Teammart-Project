import { apiRequest } from "./apiClient";

// zoneActivitiesService.js — talks to /api/zone-activities. Mirrors
// backend/src/controllers/zoneActivitiesController.js. Regional Manager
// (own zones, derived from their token) and Admin — no zoneId/marketId
// parameter is exposed here on purpose: the backend derives scope from
// the caller's own token, so there is nothing a client could change to
// reach another zone (same "deliberately no zoneId param" convention as
// itemReportService.listZoneItemReports).

// period: "today" | "week" | "month"
export function getZoneActivityCounts({ period } = {}) {
  const params = new URLSearchParams();
  if (period) params.set("period", period);
  const query = params.toString();
  return apiRequest(`/zone-activities/counts${query ? `?${query}` : ""}`);
}

export function listZoneActivityCategory(category, { period, page, pageSize } = {}) {
  const params = new URLSearchParams();
  if (period) params.set("period", period);
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return apiRequest(`/zone-activities/${category}${query ? `?${query}` : ""}`);
}

// Department Closing — dedicated Market -> Shift -> Department -> Photo
// drill-down. Mirrors the three dedicated backend routes registered
// before the generic "/:category" catch-all in zoneActivities.routes.js.

// PAGE 2 — every authorized market with Completed/Expected shifts.
export function listDepartmentClosingMarkets({ period } = {}) {
  const params = new URLSearchParams();
  if (period) params.set("period", period);
  const query = params.toString();
  return apiRequest(`/zone-activities/department-closing/markets${query ? `?${query}` : ""}`);
}

// PAGE 3 — one market's day-by-day, shift-by-shift completion.
export function getDepartmentClosingMarket(marketId, { period } = {}) {
  const params = new URLSearchParams();
  if (period) params.set("period", period);
  const query = params.toString();
  return apiRequest(`/zone-activities/department-closing/markets/${marketId}${query ? `?${query}` : ""}`);
}

// PAGE 4 / "Show All" — every department's latest valid record for one
// exact market + date + shift.
export function getDepartmentClosingShift(marketId, date, shift) {
  return apiRequest(
    `/zone-activities/department-closing/markets/${marketId}/shifts/${date}/${shift}`
  );
}
