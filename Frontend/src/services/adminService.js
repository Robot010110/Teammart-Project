import { apiRequest } from "./apiClient";

// adminService.js — Admin Phase 1: company-wide visibility. Mirrors
// backend/src/controllers/adminController.js (overview + search) and
// the new company-wide endpoints on the existing attendance/activities
// controllers. ADMIN-only server-side — every function here 403s for
// any other role regardless of what the frontend does.

export function getCompanyOverview() {
  return apiRequest("/admin/overview");
}

export function globalSearch(q) {
  const params = new URLSearchParams({ q });
  return apiRequest(`/admin/search?${params.toString()}`);
}

// listCompanyAttendance — company-wide attendance snapshot for one day
// (default today). Any combination of filters; all optional.
export function listCompanyAttendance({ date, marketId, zoneId, role, shift, status, search } = {}) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (marketId) params.set("marketId", marketId);
  if (zoneId) params.set("zoneId", zoneId);
  if (role) params.set("role", role);
  if (shift) params.set("shift", shift);
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const query = params.toString();
  return apiRequest(`/attendance/company${query ? `?${query}` : ""}`);
}

// listCompanyActivities — company-wide activity feed, capped server-side
// (default 100, most recent first).
export function listCompanyActivities({ marketId, zoneId, category, status, employeeId, take } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (zoneId) params.set("zoneId", zoneId);
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  if (employeeId) params.set("employeeId", employeeId);
  if (take) params.set("take", take);
  const query = params.toString();
  return apiRequest(`/activities/company${query ? `?${query}` : ""}`);
}

// --- Admin Phase 2: administrative control ---
// Mirrors backend/src/controllers/adminAccountController.js. Every
// function here 403s for any non-ADMIN caller regardless of what the
// frontend does — the backend is the real authorization boundary.

export function updateStaffProfile(userId, payload) {
  return apiRequest(`/admin/staff/${userId}`, { method: "PATCH", body: payload });
}

// payload: { role, marketId?, zoneIds? } — required fields depend on
// role (SUPERVISOR/OVERLOOKING_SUPERVISOR need marketId, REGIONAL_MANAGER
// needs zoneIds); the backend validates regardless of what's sent.
export function changeStaffRole(userId, payload) {
  return apiRequest(`/admin/staff/${userId}/role`, { method: "POST", body: payload });
}

// Full-replace a Regional Manager's zone list.
export function setRegionalManagerZones(userId, zoneIds) {
  return apiRequest(`/admin/staff/${userId}/zones`, { method: "POST", body: { zoneIds } });
}

// payload: { role, marketId, password, shift?, username? }
export function demoteStaffToEmployee(userId, payload) {
  return apiRequest(`/admin/staff/${userId}/demote`, { method: "POST", body: payload });
}

// payload: { role, email, password, marketId?, zoneIds?, loginId? }
export function promoteEmployeeToStaff(employeeId, payload) {
  return apiRequest(`/admin/employees/${employeeId}/promote`, { method: "POST", body: payload });
}

export function resetEmployeePassword(employeeId, newPassword) {
  return apiRequest(`/admin/employees/${employeeId}/reset-password`, { method: "POST", body: { newPassword } });
}

export function resetStaffPassword(userId, newPassword) {
  return apiRequest(`/admin/staff/${userId}/reset-password`, { method: "POST", body: { newPassword } });
}

export function setEmployeeAccountStatus(employeeId, status, reason) {
  return apiRequest(`/admin/employees/${employeeId}/status`, { method: "POST", body: { status, reason } });
}

export function setStaffAccountStatus(userId, status, reason) {
  return apiRequest(`/admin/staff/${userId}/status`, { method: "POST", body: { status, reason } });
}

// --- Admin Phase 3: Market Visits / Administrative Inspections, Audit
// Log, Reports ---

// visitType: "VISIT" | "INSPECTION" (default VISIT).
export function startMarketVisit(marketId, { visitType, notes } = {}) {
  return apiRequest(`/admin/markets/${marketId}/visits`, { method: "POST", body: { visitType, notes } });
}

export function completeMarketVisit(visitId, notes) {
  return apiRequest(`/admin/visits/${visitId}/complete`, { method: "PATCH", body: { notes } });
}

export function cancelMarketVisit(visitId, reason) {
  return apiRequest(`/admin/visits/${visitId}/cancel`, { method: "PATCH", body: { reason } });
}

export function listMarketVisits({ marketId, zoneId, status, adminUserId, page, pageSize } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (zoneId) params.set("zoneId", zoneId);
  if (status) params.set("status", status);
  if (adminUserId) params.set("adminUserId", adminUserId);
  if (page) params.set("page", page);
  if (pageSize) params.set("pageSize", pageSize);
  const query = params.toString();
  return apiRequest(`/admin/visits${query ? `?${query}` : ""}`);
}

export function listAuditLog({ actorUserId, action, targetType, marketId, zoneId, dateFrom, dateTo, page, pageSize } = {}) {
  const params = new URLSearchParams();
  if (actorUserId) params.set("actorUserId", actorUserId);
  if (action) params.set("action", action);
  if (targetType) params.set("targetType", targetType);
  if (marketId) params.set("marketId", marketId);
  if (zoneId) params.set("zoneId", zoneId);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (page) params.set("page", page);
  if (pageSize) params.set("pageSize", pageSize);
  const query = params.toString();
  return apiRequest(`/admin/audit${query ? `?${query}` : ""}`);
}

export function getAdminReportsSummary({ marketId, zoneId, dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (zoneId) params.set("zoneId", zoneId);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const query = params.toString();
  return apiRequest(`/admin/reports/summary${query ? `?${query}` : ""}`);
}
