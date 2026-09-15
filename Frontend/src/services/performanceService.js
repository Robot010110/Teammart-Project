import { apiRequest } from "./apiClient";

// performanceService.js — the client for the Performance engine's API.
//
// Every number this returns is computed server-side from real reviewed
// work, attendance and penalty records. Nothing in the frontend
// calculates, adjusts or fabricates a score: the UI's only job is to
// present what the backend already decided, and to say honestly when
// there is nothing to present (status: "NO_DATA").
//
// What an employee receives here is already redacted by the API itself
// (see performanceView.js on the backend): correction severity and the
// internal quality-point values are removed server-side, not hidden in
// React. A staff caller hitting the same endpoints gets the fuller shape.

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// --- Employee self-service -------------------------------------------

// The homepage figure. Defaults to the CURRENT MONTH server-side — the
// spec is explicit that the home card shows the month, never the week.
export function getMyPerformance({ periodType } = {}) {
  return apiRequest(`/performance/me${query({ periodType })}`);
}

export function getMyPerformanceHistory({ periodType = "WEEK", limit } = {}) {
  return apiRequest(`/performance/me/history${query({ periodType, limit })}`);
}

export function getMyPerformanceAggregate({ months = 6 } = {}) {
  return apiRequest(`/performance/me/aggregate${query({ months })}`);
}

export function getMyPerformanceReviews({ from, to } = {}) {
  return apiRequest(`/performance/me/reviews${query({ from, to })}`);
}

// periodStart is a plain calendar date, "YYYY-MM-DD".
export function getMyPerformancePeriod(periodType, periodStart) {
  return apiRequest(`/performance/me/periods/${periodType}/${periodStart}`);
}

// --- Management ------------------------------------------------------

export function getEmployeePerformance(employeeId, { periodType } = {}) {
  return apiRequest(`/performance/employees/${employeeId}${query({ periodType })}`);
}

export function getEmployeePerformanceHistory(employeeId, { periodType = "WEEK", limit } = {}) {
  return apiRequest(`/performance/employees/${employeeId}/history${query({ periodType, limit })}`);
}

export function getEmployeePerformanceAggregate(employeeId, { months = 6 } = {}) {
  return apiRequest(`/performance/employees/${employeeId}/aggregate${query({ months })}`);
}

export function getEmployeePerformancePeriod(employeeId, periodType, periodStart) {
  return apiRequest(`/performance/employees/${employeeId}/periods/${periodType}/${periodStart}`);
}

export function getMarketPerformance({ marketId, periodType = "MONTH", offset = 1 } = {}) {
  return apiRequest(`/performance/market${query({ marketId, periodType, offset })}`);
}

export function getZonePerformance({ zoneId, periodType = "MONTH", offset = 1 } = {}) {
  return apiRequest(`/performance/zone${query({ zoneId, periodType, offset })}`);
}
