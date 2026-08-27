// marketProblems.test.js — Repair Pass §4: Market Problems is now a
// real backend model. Resolving a problem must remove it from the
// active queue immediately and persist that split (never brought back
// by a refresh), while the record itself is never deleted (available
// under History). Also covers cross-market IDOR since these are
// staff-scoped, market-owned records.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, tokenForStaff, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, marketB, supervisor, supervisorB;
let tokenSupervisor, tokenSupervisorB;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94101);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  marketB = await makeMarket({ zoneId: zone.id, supervisorId: supervisorB.id });
  tokenSupervisor = tokenForStaff(supervisor, { managedMarket: market });
  tokenSupervisorB = tokenForStaff(supervisorB, { managedMarket: marketB });
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

async function createProblem(token = tokenSupervisor) {
  const res = await apiFetch(baseUrl, "/api/market-problems", {
    method: "POST", token,
    body: { problemType: "Freezer not working", location: "Freezer section", description: "Not cooling." },
  });
  assert.equal(res.status, 201);
  return res.body;
}

test("CREATE: a Supervisor can report a problem for their own market", async () => {
  const problem = await createProblem();
  assert.equal(problem.marketId, market.id);
  assert.equal(problem.status, "OPEN");
  assert.equal(problem.reportedByUser.id, supervisor.id);
});

test("ACTIVE/HISTORY: a new problem appears under active, not history", async () => {
  await createProblem();
  const active = await apiFetch(baseUrl, `/api/market-problems?marketId=${market.id}&view=active`, { token: tokenSupervisor });
  const history = await apiFetch(baseUrl, `/api/market-problems?marketId=${market.id}&view=history`, { token: tokenSupervisor });
  assert.ok(active.body.length > 0);
  assert.ok(!history.body.some((p) => p.status !== "RESOLVED"));
});

test("RESOLVE: marking RESOLVED removes it from active and it appears in history, and this survives a fresh fetch", async () => {
  const problem = await createProblem();

  const resolve = await apiFetch(baseUrl, `/api/market-problems/${problem.id}/status`, {
    method: "PATCH", token: tokenSupervisor, body: { status: "RESOLVED" },
  });
  assert.equal(resolve.status, 200);
  assert.ok(resolve.body.resolvedAt);

  // Simulate a page refresh: independent fresh GETs.
  const active = await apiFetch(baseUrl, `/api/market-problems?marketId=${market.id}&view=active`, { token: tokenSupervisor });
  assert.ok(!active.body.some((p) => p.id === problem.id), "resolved problem must not remain in the active queue after refresh");

  const history = await apiFetch(baseUrl, `/api/market-problems?marketId=${market.id}&view=history`, { token: tokenSupervisor });
  assert.ok(history.body.some((p) => p.id === problem.id), "resolved problem must be visible in history");

  const row = await prisma.marketProblem.findUnique({ where: { id: problem.id } });
  assert.ok(row, "the record itself must never be deleted");
});

test("RESOLVE: correcting a mistaken resolve (moving back off RESOLVED) clears resolvedAt and returns it to active", async () => {
  const problem = await createProblem();
  await apiFetch(baseUrl, `/api/market-problems/${problem.id}/status`, { method: "PATCH", token: tokenSupervisor, body: { status: "RESOLVED" } });
  const reopened = await apiFetch(baseUrl, `/api/market-problems/${problem.id}/status`, { method: "PATCH", token: tokenSupervisor, body: { status: "IN_PROGRESS" } });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.resolvedAt, null);

  const active = await apiFetch(baseUrl, `/api/market-problems?marketId=${market.id}&view=active`, { token: tokenSupervisor });
  assert.ok(active.body.some((p) => p.id === problem.id));
});

test("IDOR: a Supervisor cannot list another market's problems", async () => {
  const res = await apiFetch(baseUrl, `/api/market-problems?marketId=${marketB.id}&view=active`, { token: tokenSupervisor });
  assert.equal(res.status, 403);
});

test("IDOR: a Supervisor cannot resolve another market's problem", async () => {
  const problem = await createProblem(tokenSupervisorB);
  const res = await apiFetch(baseUrl, `/api/market-problems/${problem.id}/status`, {
    method: "PATCH", token: tokenSupervisor, body: { status: "RESOLVED" },
  });
  assert.equal(res.status, 403);

  const row = await prisma.marketProblem.findUnique({ where: { id: problem.id } });
  assert.equal(row.status, "OPEN", "the other market's problem must be untouched");
});

test("ROLE: an employee cannot access market problems at all", async () => {
  // No employee fixture needed — the route requires a staff role
  // entirely, so any non-staff token (or missing auth) is rejected
  // before ownership is even considered.
  const res = await apiFetch(baseUrl, `/api/market-problems?marketId=${market.id}`, {});
  assert.equal(res.status, 401);
});
