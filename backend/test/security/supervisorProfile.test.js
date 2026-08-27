// supervisorProfile.test.js — Repair Pass §3: a Supervisor (staff
// account) can self-service edit their own profilePictureUrl/
// phoneNumber/whatsappNumber through PATCH /api/profile, the same
// shared endpoint an Employee already used — ownership is always the
// caller's own row (never a client-supplied id), and format validation
// is enforced server-side.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeMarket, makeStaffUser, tokenForStaff, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, supervisor, supervisorB;
let tokenSupervisor, tokenSupervisorB;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94201);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  tokenSupervisor = tokenForStaff(supervisor, { managedMarket: market });
  tokenSupervisorB = tokenForStaff(supervisorB);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

test("PROFILE: a Supervisor can set their own phone number, WhatsApp number, and profile picture", async () => {
  const res = await apiFetch(baseUrl, "/api/profile", {
    method: "PATCH", token: tokenSupervisor,
    body: { phoneNumber: "+964 750 123 4567", whatsappNumber: "964-750-123-4567", profilePictureUrl: "https://example.com/photo.png" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.phoneNumber, "9647501234567");
  assert.equal(res.body.whatsappNumber, "9647501234567");
  assert.equal(res.body.profilePictureUrl, "https://example.com/photo.png");

  const profile = await apiFetch(baseUrl, "/api/profile", { token: tokenSupervisor });
  assert.equal(profile.body.phoneNumber, "9647501234567");
  assert.equal(profile.body.whatsappNumber, "9647501234567");
  assert.equal(profile.body.profilePictureUrl, "https://example.com/photo.png");
});

test("PROFILE: persists after a fresh GET (simulating refresh/re-login)", async () => {
  await apiFetch(baseUrl, "/api/profile", { method: "PATCH", token: tokenSupervisor, body: { phoneNumber: "9647509998888" } });
  const first = await apiFetch(baseUrl, "/api/profile", { token: tokenSupervisor });
  assert.equal(first.body.phoneNumber, "9647509998888");

  // A second, completely independent request (new token signed fresh,
  // same account) — simulates a real re-login.
  const freshToken = tokenForStaff(supervisor);
  const second = await apiFetch(baseUrl, "/api/profile", { token: freshToken });
  assert.equal(second.body.phoneNumber, "9647509998888");
});

test("PROFILE: rejects a malformed phone number", async () => {
  const res = await apiFetch(baseUrl, "/api/profile", { method: "PATCH", token: tokenSupervisor, body: { phoneNumber: "abc123" } });
  assert.equal(res.status, 400);
});

test("PROFILE: rejects a malformed WhatsApp number", async () => {
  const res = await apiFetch(baseUrl, "/api/profile", { method: "PATCH", token: tokenSupervisor, body: { whatsappNumber: "not-a-number" } });
  assert.equal(res.status, 400);
});

test("PROFILE: a Supervisor's profile update never touches another Supervisor's row (ownership is always the token's own id)", async () => {
  await apiFetch(baseUrl, "/api/profile", { method: "PATCH", token: tokenSupervisorB, body: { phoneNumber: "9647500000001" } });

  // Even though nothing in the request body names an id at all, confirm
  // supervisorA's own row (set in earlier tests) was never touched by
  // supervisorB's request.
  const a = await prisma.user.findUnique({ where: { id: supervisor.id } });
  const b = await prisma.user.findUnique({ where: { id: supervisorB.id } });
  assert.equal(a.phoneNumber, "9647509998888");
  assert.equal(b.phoneNumber, "9647500000001");
  assert.notEqual(a.phoneNumber, b.phoneNumber);
});

test("PROFILE: GET /api/profile returns the Supervisor's own market's zoneId (session-restore-on-refresh depends on this)", async () => {
  const res = await apiFetch(baseUrl, "/api/profile", { token: tokenSupervisor });
  assert.equal(res.status, 200);
  assert.equal(res.body.zoneId, zone.id);
});

test("PROFILE: clearing a field with null actually clears it", async () => {
  await apiFetch(baseUrl, "/api/profile", { method: "PATCH", token: tokenSupervisor, body: { phoneNumber: null } });
  const profile = await apiFetch(baseUrl, "/api/profile", { token: tokenSupervisor });
  assert.equal(profile.body.phoneNumber, null);
});
