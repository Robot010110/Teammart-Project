// productionAudit.test.js — focused coverage added by the 2026-09
// production security audit for attack surfaces that had no explicit
// test before, even though the underlying code was already correct
// (see AION_SECURITY_AUDIT_REPORT.md §3/§9). Nothing in src/ changed to
// make these pass — they document/lock in behavior that was already
// there: role-escalation via registration/self-profile mass assignment,
// and cross-role/cross-market IDOR on a few endpoints not yet covered
// by roleAndScopeIsolation.test.js / adminActionsVerification.test.js.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  startServer, stopServer, apiFetch, makeZone, makeMarket, makeStaffUser, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, supervisor, regionalManager, worker;
let tokenSupervisor, tokenRm, tokenWorker;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(91001);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  regionalManager = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  worker = await makeEmployee({ marketId: market.id, role: "WORKER" });

  tokenSupervisor = tokenForStaff(supervisor, { managedMarket: market });
  tokenRm = tokenForStaff(regionalManager, { managedZones: [zone] });
  tokenWorker = tokenForEmployee(worker);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- Registration is not a public role-escalation door ----------------

test("A non-Admin (Supervisor) cannot self-register a new staff account", async () => {
  const { status } = await apiFetch(baseUrl, "/api/auth/register", {
    method: "POST",
    token: tokenSupervisor,
    body: { name: "Rogue Admin", email: `${Date.now()}@test.local`, password: "SuperSecret1", role: "ADMIN" },
  });
  assert.equal(status, 403);
});

test("An unauthenticated request cannot register any staff account", async () => {
  const { status } = await apiFetch(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Rogue Admin", email: `${Date.now()}@test.local`, password: "SuperSecret1", role: "ADMIN" },
  });
  assert.equal(status, 401);
});

test("An unrecognised role value is rejected by the registration schema, not coerced or accepted", async () => {
  const { status } = await apiFetch(baseUrl, "/api/auth/register", {
    method: "POST",
    token: tokenForStaff(await makeStaffUser({ role: "ADMIN" })),
    body: { name: "Bad Role", email: `${Date.now()}@test.local`, password: "SuperSecret1", role: "SUPER_ADMIN" },
  });
  assert.equal(status, 400);
});

// --- Self-service profile endpoints cannot be used for role/field escalation ---

test("A Supervisor cannot escalate their own role via PATCH /api/profile", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/profile", {
    method: "PATCH",
    token: tokenSupervisor,
    body: { role: "ADMIN" },
  });
  // The field is silently dropped (not a whitelisted key), not applied —
  // confirmed by the follow-up GET below still reporting SUPERVISOR.
  assert.ok(status === 200 || status === 400);
  const { body: profile } = await apiFetch(baseUrl, "/api/profile", { token: tokenSupervisor });
  assert.equal(profile.role, "SUPERVISOR");
});

test("A Worker cannot reassign themself to another market via PATCH /api/profile", async () => {
  const otherZone = await makeZone(91002);
  const otherMarket = await makeMarket({ zoneId: otherZone.id, name: "Other Market" });

  const { status } = await apiFetch(baseUrl, "/api/profile", {
    method: "PATCH",
    token: tokenWorker,
    body: { marketId: otherMarket.id },
  });
  assert.ok(status === 200 || status === 400);

  const { body: profile } = await apiFetch(baseUrl, "/api/profile", { token: tokenWorker });
  assert.equal(profile.marketId ?? profile.market?.id, market.id);
});

// --- Cross-role IDOR on account/password management -------------------

test("A Regional Manager (non-Admin) cannot reset another account's password", async () => {
  const { status } = await apiFetch(baseUrl, `/api/admin/employees/${worker.id}/reset-password`, {
    method: "POST",
    token: tokenRm,
    body: { newPassword: "NewPassword123" },
  });
  assert.equal(status, 403);
});

test("A Supervisor cannot reset another account's password", async () => {
  const { status } = await apiFetch(baseUrl, `/api/admin/employees/${worker.id}/reset-password`, {
    method: "POST",
    token: tokenSupervisor,
    body: { newPassword: "NewPassword123" },
  });
  assert.equal(status, 403);
});

test("An Employee token cannot reach any /api/admin/* route", async () => {
  const { status } = await apiFetch(baseUrl, "/api/admin/overview", { token: tokenWorker });
  assert.equal(status, 403);
});
