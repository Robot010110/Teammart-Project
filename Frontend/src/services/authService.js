import { apiRequest, setToken, clearToken, getToken } from "./apiClient";

// authService.js — real authentication against the backend, replacing the
// hardcoded checks that used to live in data/auth.js. Employee (Worker/
// Cashier) and Supervisor login are both real now; Regional Manager still
// uses the old mock flow (data/auth.js) — RM has no real frontend login
// path yet, out of scope for Supervisor Mode.

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
// email+password, bcrypt-checked server-side. Used here only for
// Supervisor (Supervisor Mode) — Regional Manager keeps the existing
// prototype flow. Returns { id, name, role, zoneId, marketId }.
export async function staffLogin(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setToken(data.token);
  return data.user;
}

export function logout() {
  clearToken();
}

export function isAuthenticated() {
  return !!getToken();
}
