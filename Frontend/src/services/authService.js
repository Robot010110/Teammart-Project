import { apiRequest, setToken, clearToken, getToken } from "./apiClient";

// authService.js — real authentication against the backend, replacing the
// hardcoded checks that used to live in data/auth.js. Only the Employee
// login is implemented here (Regional Manager / Supervisor login still use
// the old mock flow — that's Supervisor/Manager work, out of scope for
// this phase, see data/auth.js for that part which is untouched).

// POST /api/auth/employee-login — on success, stores the JWT so future
// apiRequest() calls are authenticated automatically.
export async function employeeLogin(employeeCode, password) {
  const data = await apiRequest("/auth/employee-login", {
    method: "POST",
    body: { employeeCode, password },
    auth: false, // logging in — there is no token yet to attach
  });
  setToken(data.token);
  return data.employee;
}

// POST /api/auth/cashier-login — same shape as employeeLogin, but for the
// Cashier role (username, not employee code). A separate function/
// endpoint rather than a merged lookup, so Worker login above stays
// completely untouched.
export async function cashierLogin(username, password) {
  const data = await apiRequest("/auth/cashier-login", {
    method: "POST",
    body: { username, password },
    auth: false,
  });
  setToken(data.token);
  return data.employee;
}

export function logout() {
  clearToken();
}

export function isAuthenticated() {
  return !!getToken();
}
