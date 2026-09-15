// rateLimit.test.js — regression coverage for the 2026-09 "Too many
// requests" reliability incident.
//
// Two things are under test here, matching the two root causes found:
//
//   1. identityOrIpKeyGenerator — the rate limiter's key function must
//      bucket by AUTHENTICATED ACCOUNT when a valid token is present, and
//      only fall back to IP for anonymous/invalid-token requests. This is
//      what stops one busy account (or a shared office IP with many
//      accounts on it) from exhausting everyone else's budget.
//
//   2. End-to-end recovery — built from the SAME rateLimit() factory and
//      the SAME key generator as production (just a tiny window/limit so
//      the test runs in milliseconds instead of 15 minutes), proving the
//      real contract the frontend's single-retry logic depends on:
//      requests from different accounts don't interfere, a request over
//      the limit gets a clean 429 with Retry-After, and — the part that
//      matters most — the app genuinely recovers once the window elapses.
//
// The frontend's own single-retry-and-recover behavior (apiClient.js) is
// covered separately via a live browser run against this exact backend
// contract (see the reliability report) — this project has no frontend
// test runner (checked before writing this, same as test/helpers.js's
// own note), so that side is proven by direct reproduction rather than
// an automated unit test.
// dotenv must load before anything reads process.env.JWT_SECRET — same
// requirement test/helpers.js documents for the rest of the suite.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { identityOrIpKeyGenerator } from "../../src/middleware/rateLimit.js";
import { signStaffToken, signEmployeeToken } from "../../src/utils/jwt.js";

function mockReq(headers = {}, ip = "127.0.0.1") {
  return {
    headers,
    ip,
    // ipKeyGenerator (express-rate-limit) reads req.ip directly; no other
    // request shape is touched by identityOrIpKey.
  };
}

// --- identityOrIpKeyGenerator (unit) ------------------------------------

test("KEY: a valid staff token buckets by staff:<userId>, not by IP", () => {
  const token = signStaffToken({ id: 4242, role: "ADMIN", managedZones: [], managedMarket: null, managedOverlookingMarket: null });
  const key = identityOrIpKeyGenerator(mockReq({ authorization: `Bearer ${token}` }, "10.0.0.1"));
  assert.equal(key, "staff:4242");
});

test("KEY: a valid employee token buckets by employee:<employeeId>, not by IP", () => {
  const token = signEmployeeToken({ id: "emp_abc123", marketId: "mkt_1", role: "WORKER", cashierShift: null, tokenVersion: 0 });
  const key = identityOrIpKeyGenerator(mockReq({ authorization: `Bearer ${token}` }, "10.0.0.1"));
  assert.equal(key, "employee:emp_abc123");
});

test("KEY: two different accounts on the SAME IP get two DIFFERENT keys", () => {
  const staffToken = signStaffToken({ id: 1, role: "ADMIN", managedZones: [], managedMarket: null, managedOverlookingMarket: null });
  const empToken = signEmployeeToken({ id: "emp_1", marketId: "mkt_1", role: "WORKER", cashierShift: null, tokenVersion: 0 });
  const sharedIp = "203.0.113.5"; // same office/NAT IP for both

  const keyA = identityOrIpKeyGenerator(mockReq({ authorization: `Bearer ${staffToken}` }, sharedIp));
  const keyB = identityOrIpKeyGenerator(mockReq({ authorization: `Bearer ${empToken}` }, sharedIp));

  assert.notEqual(keyA, keyB, "two different accounts must never share a rate-limit bucket just for sharing a network");
});

test("KEY: no Authorization header falls back to IP keying", () => {
  const key = identityOrIpKeyGenerator(mockReq({}, "203.0.113.9"));
  assert.match(key, /203\.0\.113\.9/, "anonymous requests have nothing to key by except IP");
});

test("KEY: a malformed/garbage token falls back to IP keying (cannot be used to dodge the limiter)", () => {
  const key = identityOrIpKeyGenerator(mockReq({ authorization: "Bearer not-a-real-jwt" }, "203.0.113.9"));
  assert.match(key, /203\.0\.113\.9/, "a forged token must not mint a fresh, unlimited bucket");
});

test("KEY: an expired token falls back to IP keying", () => {
  // Signed directly (rather than via signStaffToken, which has no
  // negative-expiry option) to exercise the same verifyToken() failure
  // path a stale real session hits in production.
  const token = jwt.sign({ kind: "staff", userId: 99, role: "ADMIN", tv: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
  const key = identityOrIpKeyGenerator(mockReq({ authorization: `Bearer ${token}` }, "203.0.113.9"));
  assert.match(key, /203\.0\.113\.9/);
});

// --- End-to-end: same factory, tiny window, real HTTP ------------------
//
// Built from the exact production pieces (rateLimit() + our key
// generator), just with a small enough window/limit to run in
// milliseconds — this tests the REAL mechanism, not a re-implementation
// of it.

function startScratchLimitedServer({ windowMs, limit }) {
  const app = express();
  app.use(
    rateLimit({
      windowMs,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: identityOrIpKeyGenerator,
      message: { error: "Too many requests. Please slow down." },
    })
  );
  app.get("/ping", (req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function authHeaderFor(kind, id) {
  const token =
    kind === "staff"
      ? signStaffToken({ id, role: "ADMIN", managedZones: [], managedMarket: null, managedOverlookingMarket: null })
      : signEmployeeToken({ id, marketId: "mkt_1", role: "WORKER", cashierShift: null, tokenVersion: 0 });
  return { Authorization: `Bearer ${token}` };
}

test("E2E: exceeding the limit returns a clean 429 with a Retry-After header", async () => {
  const { server, baseUrl } = await startScratchLimitedServer({ windowMs: 1000, limit: 2 });
  try {
    const headers = authHeaderFor("employee", "e2e-1");
    const r1 = await fetch(`${baseUrl}/ping`, { headers });
    const r2 = await fetch(`${baseUrl}/ping`, { headers });
    const r3 = await fetch(`${baseUrl}/ping`, { headers });

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r3.status, 429);
    assert.ok(r3.headers.get("retry-after"), "the frontend's backoff depends on this header existing");
    const body = await r3.json();
    assert.equal(body.error, "Too many requests. Please slow down.");
  } finally {
    server.close();
  }
});

test("E2E: a DIFFERENT account on the same connection is completely unaffected", async () => {
  const { server, baseUrl } = await startScratchLimitedServer({ windowMs: 2000, limit: 2 });
  try {
    const busyAccount = authHeaderFor("employee", "e2e-busy");
    const otherAccount = authHeaderFor("staff", 777);

    // Exhaust the busy account's tiny budget.
    await fetch(`${baseUrl}/ping`, { headers: busyAccount });
    await fetch(`${baseUrl}/ping`, { headers: busyAccount });
    const busyBlocked = await fetch(`${baseUrl}/ping`, { headers: busyAccount });
    assert.equal(busyBlocked.status, 429, "the busy account should now be limited");

    // A different account, same process/IP, must still get through — this
    // is the exact production scenario (a market's whole staff on one
    // office Wi-Fi) the fix targets.
    const otherOk = await fetch(`${baseUrl}/ping`, { headers: otherAccount });
    assert.equal(otherOk.status, 200, "a different account must not inherit someone else's exhausted budget");
  } finally {
    server.close();
  }
});

test("E2E: the app genuinely recovers once the window elapses — no permanent 'stuck' state", async () => {
  const { server, baseUrl } = await startScratchLimitedServer({ windowMs: 400, limit: 1 });
  try {
    const headers = authHeaderFor("employee", "e2e-recover");

    const first = await fetch(`${baseUrl}/ping`, { headers });
    assert.equal(first.status, 200);

    const blocked = await fetch(`${baseUrl}/ping`, { headers });
    assert.equal(blocked.status, 429);

    // Wait out the window — this is exactly what the frontend's bounded
    // backoff-then-retry is betting on.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const recovered = await fetch(`${baseUrl}/ping`, { headers });
    assert.equal(recovered.status, 200, "a fresh request after the window expires must succeed, not stay stuck");
  } finally {
    server.close();
  }
});
