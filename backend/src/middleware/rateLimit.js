import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { verifyToken } from "../utils/jwt.js";

// rateLimit.js — brute-force protection. Two tiers:
//   authLimiter — tight, applied only to the login endpoints (the actual
//   attack surface: an attacker guessing passwords/employee codes).
//   apiLimiter  — loose, applied to everything else as defense-in-depth
//   against a runaway client or scripted abuse, generous enough that it
//   should never be hit by normal usage of this app.

// Reliability incident (2026-09): apiLimiter used express-rate-limit's
// DEFAULT keyGenerator, which buckets purely by req.ip. Every authenticated
// request already carries a real, stable identity (the JWT), but the
// limiter ignored it and lumped every user behind the same IP into one
// shared 600-per-15-min budget. That is the normal case for this app —
// a market's whole staff on one office/store Wi-Fi, a phone on a shared
// hotspot, anyone behind a NAT or reverse proxy/tunnel — so one busy
// employee (or just enough people polling for notifications/chat at once)
// could exhaust the WHOLE building's budget and lock everyone else out
// with "Too many requests", including people who individually made a
// handful of requests. Confirmed live: a burst of a few hundred requests
// from one IP produced a 429 with `ratelimit-remaining: 0` that then
// applied to every other request from that same IP regardless of which
// user or token made it.
//
// Fix: key by the AUTHENTICATED ACCOUNT when the request carries a valid
// token, so each person gets their own 600-per-15-min budget regardless
// of how many other people share their network. Falls back to the
// existing IP-based keying for anonymous requests (nothing to identify
// them by) and for a garbage/expired token (can't be trusted as an
// identity — and deliberately isn't: forging tokens to mint unlimited
// buckets is exactly what a real attacker would try, which is why this
// verifies the signature via the same verifyToken() requireAuth uses,
// not just base64-decoding the payload).
//
// This is intentionally NOT a full auth check — no DB lookup, no
// tokenVersion/account-status check, no rejection of anything here. Those
// remain requireAuth's job, and run later in the same request. A rate
// limiter that also enforced full auth would duplicate that work on
// every single request and couldn't run this early in the middleware
// chain, where it needs to be to protect every route uniformly.
function identityOrIpKey(req, res) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(header.slice("Bearer ".length));
      // Mirrors requireAuth's own payload shape (middleware/auth.js) —
      // staff carry userId, employees carry employeeId.
      const id = payload.kind === "staff" ? `staff:${payload.userId}` : `employee:${payload.employeeId}`;
      if (id !== "staff:undefined" && id !== "employee:undefined") return id;
    } catch {
      // Invalid/expired signature — fall through to IP keying below,
      // same as an anonymous request.
    }
  }
  return ipKeyGenerator(req.ip);
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 attempts per IP per window — generous for a mistyped password, tight against brute force
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
  // Deliberately NOT identityOrIpKey: login attempts have no token yet by
  // definition (that's the whole point of this endpoint), and brute-force
  // protection specifically needs to stay IP-keyed — an attacker trying
  // many employee codes/passwords has no valid token to key off of, and
  // must not be able to escape this limiter just by omitting one.
});

export const identityOrIpKeyGenerator = identityOrIpKey;

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600, // ~40 requests/minute sustained per ACCOUNT — far above real usage, just a backstop
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  keyGenerator: identityOrIpKey,
});
