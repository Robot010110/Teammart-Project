// apiClient.js — the ONE place in the whole frontend that knows how to
// talk to the backend: the base URL, attaching the login token, turning a
// failed response into a real JavaScript error, and reacting to an
// expired/invalid token. Every other service file (authService,
// profileService, activityService) calls `apiRequest` instead of using
// fetch() directly, so none of that logic has to be repeated per feature.

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "teammart_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// A real Error subclass (not just a rejected plain object) so callers can
// do `catch (err) { if (err instanceof ApiError) ... }` and read a proper
// status code / validation details instead of parsing a string.
export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// Called whenever a request comes back 401 (invalid/expired token). Any
// screen that needs to react to "the user got logged out" (e.g. App.jsx
// bouncing back to the login page) can register itself here instead of
// every single service call needing to know about routing.
let unauthorizedHandler = null;
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

// options:
//   method       — "GET" (default), "POST", "PATCH", "DELETE"
//   body         — plain JS object, gets JSON.stringify'd
//   auth         — true (default) attaches "Authorization: Bearer <token>"
export async function apiRequest(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // fetch() itself throws for network failures (backend not running,
    // no internet, CORS block) — this is the one case with no HTTP
    // response to read a status/message from.
    throw new ApiError("Could not reach the server. Please check your connection and try again.", 0);
  }

  // DELETE endpoints return 204 No Content — nothing to parse.
  const hasBody = response.status !== 204;
  const data = hasBody ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (response.status === 401 && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(data?.error || "Something went wrong. Please try again.", response.status, data?.details);
  }

  return data;
}
