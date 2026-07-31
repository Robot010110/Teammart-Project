import rateLimit from "express-rate-limit";

// rateLimit.js — brute-force protection. Two tiers:
//   authLimiter — tight, applied only to the login endpoints (the actual
//   attack surface: an attacker guessing passwords/employee codes).
//   apiLimiter  — loose, applied to everything else as defense-in-depth
//   against a runaway client or scripted abuse, generous enough that it
//   should never be hit by normal usage of this app.

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 attempts per IP per window — generous for a mistyped password, tight against brute force
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600, // ~40 requests/minute sustained — far above real usage, just a backstop
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
