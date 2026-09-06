import { apiRequest } from "./apiClient";

// staffEmployeeService.js — talks to /api/employees as a staff caller
// (Supervisor Mode's Employees tab). Mirrors
// backend/src/controllers/employeesController.js. A SUPERVISOR token is
// force-scoped server-side to their own market regardless of any
// marketId passed here — this file never needs to (and can't) reach
// another market's employees.

export function listEmployeesByMarket(marketId) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  const query = params.toString();
  return apiRequest(`/employees${query ? `?${query}` : ""}`);
}

// listEmployees — the Regional Manager's global roster filters (spec §3):
// market/role/shift/search, any combination. A REGIONAL_MANAGER token is
// scoped server-side to their own zones' markets regardless of what's
// passed here (see employeesController.listEmployees).
export function listEmployees({ marketId, role, shift, search } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (role) params.set("role", role);
  if (shift) params.set("shift", shift);
  if (search) params.set("search", search);
  const query = params.toString();
  return apiRequest(`/employees${query ? `?${query}` : ""}`);
}

export function getEmployee(id) {
  return apiRequest(`/employees/${id}`);
}

// createEmployee — POST /api/employees (ADMIN/REGIONAL_MANAGER/
// SUPERVISOR, scoped to markets the caller can access — see
// employeesController.createEmployee). Existed on the backend with no
// frontend caller until AdminPeoplePage.jsx's "Add Person" flow; it
// always creates a WORKER (the endpoint has no role field of its own).
// Response includes `temporaryPassword`, returned once only — the
// caller must show it and never assume it can be fetched again.
export function createEmployee({ name, position, secondaryRole, shift, marketId, password }) {
  return apiRequest("/employees", { method: "POST", body: { name, position, secondaryRole, shift, marketId, password } });
}

// updateEmployee — also how a staff member activates a "pending" hire
// (spec §4/§7: an employee created without an employeeCode/username/
// password yet). payload may include any of { name, position,
// secondaryRole, shift, marketId, employeeCode, username, password } —
// only the keys present are changed (see employeesController.updateEmployee).
export function updateEmployee(id, payload) {
  return apiRequest(`/employees/${id}`, { method: "PATCH", body: payload });
}

export function assignDepartment(employeeId, department) {
  return apiRequest(`/employees/${employeeId}/department`, { method: "POST", body: { department } });
}

export function getDepartmentHistory(employeeId) {
  return apiRequest(`/employees/${employeeId}/department-history`);
}
