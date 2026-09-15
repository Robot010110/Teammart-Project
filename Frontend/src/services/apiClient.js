// apiClient.js — the ONE place in the whole frontend that knows how to
// talk to the backend: the base URL, attaching the login token, turning a
// failed response into a real JavaScript error, and reacting to an
// expired/invalid token. Every other service file (authService,
// profileService, activityService) calls `apiRequest` instead of using
// fetch() directly, so none of that logic has to be repeated per feature.

// Where the backend lives, resolved in priority order:
//
//   1. VITE_API_URL, when set — always wins. This is what a production
//      build sets, and it's still the way to point the app at a backend
//      on a different host than the one serving the frontend.
//   2. Otherwise: same hostname the frontend was loaded from, port 4000.
//
// Rule 2 exists for LAN phone testing. The frontend dev server already
// binds to the LAN (`server.host: true` in vite.config.js), so a phone
// opening http://<laptop-ip>:5173 resolves the API to
// http://<laptop-ip>:4000/api on its own — no hardcoded IP to update
// every time DHCP hands out a different address, which was the previous
// failure mode (a stale pinned IP surfaces only as the generic "Could
// not reach the server" error below). localhost keeps working
// unchanged: hostname "localhost" simply resolves to
// http://localhost:4000/api.
//
// PORT is set in backend/.env (defaults to 4000) and every route is
// mounted under /api — see backend/src/app.js.
const DEV_API_PORT = 4000;

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  // Trailing slash would produce a double slash once a path like
  // "/profile" is appended, which some proxies treat as a distinct route.
  if (configured) return configured.replace(/\/+$/, "");

  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}/api`;
  }

  return `http://localhost:${DEV_API_PORT}/api`;
}

const API_BASE_URL = resolveApiBaseUrl();
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

// --- 429 recovery ------------------------------------------------------
//
// Reliability incident (2026-09): a 429 from the backend's rate limiter
// (middleware/rateLimit.js) used to behave exactly like any other error —
// surfaced once, and then nothing about it recovered on its own. A poll
// loop (usePolling) would just keep silently failing every cycle until
// the 15-minute window happened to expire, and a one-shot screen
// (useAsync) would sit on the error until the user manually tapped Retry.
// Neither of those is a loop or a flood by itself, but neither recovers
// promptly either, which is what "the app is stuck" looks like to someone
// watching it.
//
// The fix lives HERE, in the one function every request in the app
// already funnels through, rather than in each of the ~30 individual
// callers: on a 429, wait once (bounded, jittered) and retry ONCE. This
// is safe to do unconditionally, including for POST/PATCH/DELETE — a 429
// is rejected by the rate-limit middleware BEFORE any route handler runs
// (see app.js: apiLimiter is mounted ahead of every router), so a 429
// response is a guarantee the request was never processed. There is
// nothing to double-submit.
//
// This deliberately does NOT loop: exactly one retry, ever, per call. If
// that retry also comes back 429, it is thrown normally like any other
// error — surfaced to the caller's existing error state, with its
// existing manual Retry button, rather than the app silently hammering a
// limiter that has made it clear it wants a longer break.
const MAX_AUTO_RETRY_DELAY_MS = 8000;
const MIN_AUTO_RETRY_DELAY_MS = 1000;

// The backend sends a standards-compliant `Retry-After` (seconds) on
// every 429 (confirmed live against the running rate limiter). Honored
// when short; capped well below the full 15-minute window so a single
// awaited call can't leave a screen spinning for that long — a legitimate
// user should recover in a handful of seconds under the per-account
// keying the limiter now uses, and if they don't, the single retry above
// will surface a real error for them to act on instead of the UI hanging.
function backoffDelayMs(response) {
  const header = response.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  const base = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : MIN_AUTO_RETRY_DELAY_MS;
  const capped = Math.min(base, MAX_AUTO_RETRY_DELAY_MS);
  // Jittered so multiple tabs/components that all got 429'd in the same
  // instant don't all retry in that same instant too — that would just
  // recreate the burst that caused the 429 in the first place.
  return capped + Math.random() * 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performFetch(path, method, headers, body) {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
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

  let response = await performFetch(path, method, headers, body);

  // Exactly one bounded, jittered retry — see the block comment above.
  // This `if` can only ever run once per apiRequest() call (it is not
  // inside a loop and does not re-check its own result), so no sequence
  // of 429s can turn this into more than "at most two attempts total".
  if (response.status === 429) {
    await sleep(backoffDelayMs(response));
    response = await performFetch(path, method, headers, body);
  }

  // DELETE endpoints return 204 No Content — nothing to parse.
  const hasBody = response.status !== 204;
  const data = hasBody ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    // 429 must never be treated as a session problem: it does not log the
    // user out, does not touch the token, and does not run
    // unauthorizedHandler — only a real 401 does. The caller's own error
    // state (useAsync's `error`, a polling loop's caught/ignored
    // rejection) is all that reflects it, and it clears itself the moment
    // any subsequent call succeeds — there is no separate "poisoned"
    // flag anywhere for a 429 to get stuck in.
    if (response.status === 401 && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(data?.error || "Something went wrong. Please try again.", response.status, data?.details);
  }

  return data;
}
