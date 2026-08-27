import { apiRequest, setToken, clearToken, getToken } from "./apiClient";

// authService.js — real authentication against the backend, replacing the
// hardcoded checks that used to live in data/auth.js. Every role
// (Employee/Worker/Cashier, Supervisor, Regional Manager, Admin) logs in
// against the real backend now — data/auth.js is just the login-page role
// picker's static labels, nothing more.

// POST /api/auth/employee-login — on success, stores the JWT so future
// apiRequest() calls are authenticated automatically. `rememberMe`
// requests a 30-day token instead of the default 8h (see
// backend/src/utils/jwt.js) — not a second auth system, just a longer
// TTL; session restoration (GET /api/profile on app mount) is unchanged.
export async function employeeLogin(employeeCode, password, rememberMe = false) {
  const data = await apiRequest("/auth/employee-login", {
    method: "POST",
    body: { employeeCode, password, rememberMe },
    auth: false, // logging in — there is no token yet to attach
  });
  setToken(data.token);
  return data.employee;
}

// POST /api/auth/cashier-login — same shape as employeeLogin, but for the
// Cashier role (username, not employee code). A separate function/
// endpoint rather than a merged lookup, so Worker login above stays
// completely untouched.
export async function cashierLogin(username, password, rememberMe = false) {
  const data = await apiRequest("/auth/cashier-login", {
    method: "POST",
    body: { username, password, rememberMe },
    auth: false,
  });
  setToken(data.token);
  return data.employee;
}

// POST /api/auth/login — staff login (Admin/Regional Manager/Supervisor),
// email+password, bcrypt-checked server-side. Returns
// { id, name, role, zoneIds, marketId }.
export async function staffLogin(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setToken(data.token);
  return data.user;
}

// POST /api/auth/staff-id-login — Supervisor/Overlooking login with a
// case-insensitive "User ID" (loginId) instead of email (see
// backend/src/controllers/authController.js's staffIdLogin). Admin/
// Regional Manager keep using staffLogin (email) above — they have no
// User ID in this app.
export async function staffIdLogin(loginId, password) {
  const data = await apiRequest("/auth/staff-id-login", {
    method: "POST",
    body: { loginId, password },
    auth: false,
  });
  setToken(data.token);
  return data.user;
}

// POST /api/auth/register — ADMIN-only. Creates a new staff account
// (Admin/Regional Manager/Supervisor/Overlooking Supervisor). Used by
// AdminStaffPage.jsx; doesn't touch the caller's own token.
export function registerStaff({ name, email, password, role, loginId }) {
  return apiRequest("/auth/register", { method: "POST", body: { name, email, password, role, loginId } });
}

// GET /api/auth/staff — ADMIN-only staff directory, optionally filtered
// by role (e.g. "REGIONAL_MANAGER" for the zone-manager picker in
// AdminZonesPage.jsx).
export function listStaffAccounts(role) {
  return apiRequest(`/auth/staff${role ? `?role=${role}` : ""}`);
}

export function logout() {
  clearToken();
}

export function isAuthenticated() {
  return !!getToken();
}
