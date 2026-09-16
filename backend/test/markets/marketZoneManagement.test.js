// marketZoneManagement.test.js — Admin Market <-> Zone Management: moving
// a market between zones (PATCH /api/markets/:id/zone) and closing a
// market (PATCH /api/markets/:id/close). Both reuse the existing
// Market.zoneId / Market.status columns — no new models, no employee
// rewrites. See marketsController.moveMarketZone/closeMarket for the
// reasoning this test verifies.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  prisma, TAG, startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, trackEmployee, trackMarket, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB, zoneC;
let admin, tokenAdmin;
let rmA, tokenRmA; // manages zoneA only
let rmB, tokenRmB; // manages zoneB only
let supervisorX, tokenSupervisorX;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(94920);
  zoneB = await makeZone(94921);
  zoneC = await makeZone(94922);

  admin = await makeStaffUser({ role: "ADMIN" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  supervisorX = await makeStaffUser({ role: "SUPERVISOR" });

  tokenAdmin = tokenForStaff(admin);
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenRmB = tokenForStaff(rmB, { managedZones: [zoneB] });
});

after(async () => {
  await cleanup();
  await stopServer(server);
  await prisma.$disconnect();
});

// --- MOVE ------------------------------------------------------------

test("MOVE: Admin can move a market from Zone A to Zone B, and the database zoneId is actually changed", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} move-market-1` });

  const { status, body } = await apiFetch(baseUrl, `/api/markets/${market.id}/zone`, {
    method: "PATCH", token: tokenAdmin, body: { zoneId: zoneB.id },
  });
  assert.equal(status, 200);
  assert.equal(body.zoneId, zoneB.id);

  const row = await prisma.market.findUnique({ where: { id: market.id } });
  assert.equal(row.zoneId, zoneB.id);
});

test("MOVE: the market disappears from the old zone's market list and appears under the new zone", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} move-market-2` });

  let zA = await apiFetch(baseUrl, `/api/zones/${zoneA.id}`, { token: tokenAdmin });
  let zB = await apiFetch(baseUrl, `/api/zones/${zoneB.id}`, { token: tokenAdmin });
  assert.ok(zA.body.markets.some((m) => m.id === market.id), "market starts under Zone A");
  assert.ok(!zB.body.markets.some((m) => m.id === market.id), "market not yet under Zone B");

  const move = await apiFetch(baseUrl, `/api/markets/${market.id}/zone`, {
    method: "PATCH", token: tokenAdmin, body: { zoneId: zoneB.id },
  });
  assert.equal(move.status, 200);

  zA = await apiFetch(baseUrl, `/api/zones/${zoneA.id}`, { token: tokenAdmin });
  zB = await apiFetch(baseUrl, `/api/zones/${zoneB.id}`, { token: tokenAdmin });
  assert.ok(!zA.body.markets.some((m) => m.id === market.id), "market disappears from Zone A's list");
  assert.ok(zB.body.markets.some((m) => m.id === market.id), "market now appears under Zone B's list");
});

test("MOVE: Worker, Cashier, Supervisor, and Regional Manager cannot move a market — ADMIN only", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} move-unauthorized` });
  const worker = await makeEmployee({ marketId: market.id, role: "WORKER" });
  trackEmployee(worker.id);
  const cashier = await makeEmployee({ marketId: market.id, role: "CASHIER" });
  trackEmployee(cashier.id);
  const tokenWorker = tokenForEmployee(worker);
  const tokenCashier = tokenForEmployee(cashier);
  const tokenSupervisorA = tokenForStaff(supervisorX, { managedMarket: market });

  for (const [label, token] of [
    ["worker", tokenWorker], ["cashier", tokenCashier],
    ["supervisor", tokenSupervisorA], ["regional manager", tokenRmA],
  ]) {
    const { status } = await apiFetch(baseUrl, `/api/markets/${market.id}/zone`, {
      method: "PATCH", token, body: { zoneId: zoneB.id },
    });
    assert.equal(status, 403, `${label} must not be able to move a market`);
  }

  const row = await prisma.market.findUnique({ where: { id: market.id } });
  assert.equal(row.zoneId, zoneA.id, "market must not have moved after rejected attempts");
});

test("MOVE: an unauthenticated request is rejected", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} move-noauth` });
  const { status } = await apiFetch(baseUrl, `/api/markets/${market.id}/zone`, {
    method: "PATCH", body: { zoneId: zoneB.id },
  });
  assert.equal(status, 401);
});

test("MOVE: an invalid destination zone is rejected", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} move-badzone` });
  const { status } = await apiFetch(baseUrl, `/api/markets/${market.id}/zone`, {
    method: "PATCH", token: tokenAdmin, body: { zoneId: 999999 },
  });
  assert.equal(status, 400);
});

test("MOVE: an invalid/nonexistent market is rejected", async () => {
  const { status } = await apiFetch(baseUrl, "/api/markets/not-a-real-market-id/zone", {
    method: "PATCH", token: tokenAdmin, body: { zoneId: zoneB.id },
  });
  assert.equal(status, 404);
});

test("MOVE: moving a market to the zone it is already in is rejected (no-op/conflicting move)", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} move-samezone` });
  const { status } = await apiFetch(baseUrl, `/api/markets/${market.id}/zone`, {
    method: "PATCH", token: tokenAdmin, body: { zoneId: zoneA.id },
  });
  assert.equal(status, 400);
});

test("MOVE: existing employee assignments remain intact — employees stay attached to the same market", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} move-keeps-employees` });
  const worker = await makeEmployee({ marketId: market.id, name: `${TAG} kept-worker` });
  trackEmployee(worker.id);

  await apiFetch(baseUrl, `/api/markets/${market.id}/zone`, {
    method: "PATCH", token: tokenAdmin, body: { zoneId: zoneB.id },
  });

  const row = await prisma.employee.findUnique({ where: { id: worker.id } });
  assert.equal(row.marketId, market.id, "employee.marketId must be completely unchanged by a market-level zone move");
});

test("MOVE: zone-derived permissions resolve to the NEW zone immediately — old zone's RM loses access, new zone's RM gains it", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} move-rm-access` });
  const worker = await makeEmployee({ marketId: market.id, name: `${TAG} rm-access-worker` });
  trackEmployee(worker.id);

  // Before the move: RM A (zoneA) can see it, RM B (zoneB) cannot.
  let listA = await apiFetch(baseUrl, `/api/employees?marketId=${market.id}`, { token: tokenRmA });
  let listB = await apiFetch(baseUrl, `/api/employees?marketId=${market.id}`, { token: tokenRmB });
  assert.equal(listA.status, 200);
  assert.equal(listB.status, 403);

  await apiFetch(baseUrl, `/api/markets/${market.id}/zone`, {
    method: "PATCH", token: tokenAdmin, body: { zoneId: zoneB.id },
  });

  // After the move: the reverse must be true, immediately, no token refresh needed.
  listA = await apiFetch(baseUrl, `/api/employees?marketId=${market.id}`, { token: tokenRmA });
  listB = await apiFetch(baseUrl, `/api/employees?marketId=${market.id}`, { token: tokenRmB });
  assert.equal(listA.status, 403, "Zone A's RM must lose access after the market left their zone");
  assert.equal(listB.status, 200, "Zone B's RM must gain access now the market is in their zone");
  assert.ok(listB.body.some((e) => e.id === worker.id));
});

test("MOVE: writes an audit record with actor, previous zone, and new zone", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} move-audit` });

  await apiFetch(baseUrl, `/api/markets/${market.id}/zone`, {
    method: "PATCH", token: tokenAdmin, body: { zoneId: zoneC.id },
  });

  const auditRow = await prisma.auditLog.findFirst({
    where: { targetType: "Market", targetId: market.id, action: "MARKET_ZONE_CHANGED" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(auditRow, "expected a MARKET_ZONE_CHANGED audit row");
  assert.equal(auditRow.actorUserId, admin.id);
  assert.equal(auditRow.marketId, market.id);
  assert.equal(auditRow.zoneId, zoneC.id);
  assert.deepEqual(auditRow.previousValue, { zoneId: zoneA.id });
  assert.deepEqual(auditRow.newValue, { zoneId: zoneC.id });
});

// --- CLOSE -------------------------------------------------------------

test("CLOSE: Admin can close a market", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} close-1` });
  const { status, body } = await apiFetch(baseUrl, `/api/markets/${market.id}/close`, {
    method: "PATCH", token: tokenAdmin,
  });
  assert.equal(status, 200);
  assert.equal(body.status, "CLOSED");
});

test("CLOSE: a closed market no longer appears in the active (excludeClosed) market list, but is still returned unfiltered", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} close-listing` });
  await apiFetch(baseUrl, `/api/markets/${market.id}/close`, { method: "PATCH", token: tokenAdmin });

  const activeOnly = await apiFetch(baseUrl, "/api/markets?excludeClosed=true", { token: tokenAdmin });
  assert.ok(!activeOnly.body.some((m) => m.id === market.id), "closed market must not appear in the active-only list");

  const everything = await apiFetch(baseUrl, "/api/markets", { token: tokenAdmin });
  assert.ok(everything.body.some((m) => m.id === market.id), "closed market must still appear in the unfiltered list");
});

test("CLOSE: a closed market remains in the database and its GET endpoint still resolves it (historical access)", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} close-persists` });
  await apiFetch(baseUrl, `/api/markets/${market.id}/close`, { method: "PATCH", token: tokenAdmin });

  const row = await prisma.market.findUnique({ where: { id: market.id } });
  assert.ok(row, "the Market row must not be deleted");
  assert.equal(row.status, "CLOSED");

  const { status, body } = await apiFetch(baseUrl, `/api/markets/${market.id}`, { token: tokenAdmin });
  assert.equal(status, 200);
  assert.equal(body.status, "CLOSED");
});

test("CLOSE: historical employee/attendance records under a closed market remain accessible", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} close-history` });
  const worker = await makeEmployee({ marketId: market.id, name: `${TAG} closed-market-worker` });
  trackEmployee(worker.id);

  await apiFetch(baseUrl, `/api/markets/${market.id}/close`, { method: "PATCH", token: tokenAdmin });

  const row = await prisma.employee.findUnique({ where: { id: worker.id } });
  assert.equal(row.marketId, market.id, "the employee stays attached to the closed market historically");

  const fetched = await apiFetch(baseUrl, `/api/employees/${worker.id}`, { token: tokenAdmin });
  assert.equal(fetched.status, 200, "the employee record must still be reachable after their market closes");
});

test("CLOSE: Worker, Cashier, and an unrelated Supervisor cannot close a market", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} close-unauthorized` });
  const worker = await makeEmployee({ marketId: market.id, role: "WORKER" });
  trackEmployee(worker.id);
  const cashier = await makeEmployee({ marketId: market.id, role: "CASHIER" });
  trackEmployee(cashier.id);
  const otherMarket = await makeMarket({ zoneId: zoneA.id, name: `${TAG} close-other-market` });
  const unrelatedSupervisor = await makeStaffUser({ role: "SUPERVISOR" });
  const tokenUnrelatedSupervisor = tokenForStaff(unrelatedSupervisor, { managedMarket: otherMarket });

  for (const [label, token] of [
    ["worker", tokenForEmployee(worker)], ["cashier", tokenForEmployee(cashier)],
    ["unrelated supervisor", tokenUnrelatedSupervisor],
  ]) {
    const { status } = await apiFetch(baseUrl, `/api/markets/${market.id}/close`, { method: "PATCH", token });
    assert.equal(status, 403, `${label} must not be able to close this market`);
  }

  const row = await prisma.market.findUnique({ where: { id: market.id } });
  assert.equal(row.status, "ACTIVE", "market must remain ACTIVE after rejected attempts");
});

test("CLOSE: closing an already-closed market is rejected — it can never be silently double-closed or treated as active again by accident", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} close-twice` });
  const first = await apiFetch(baseUrl, `/api/markets/${market.id}/close`, { method: "PATCH", token: tokenAdmin });
  assert.equal(first.status, 200);

  const second = await apiFetch(baseUrl, `/api/markets/${market.id}/close`, { method: "PATCH", token: tokenAdmin });
  assert.equal(second.status, 400);
});

test("CLOSE: writes an audit record", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} close-audit` });
  await apiFetch(baseUrl, `/api/markets/${market.id}/close`, { method: "PATCH", token: tokenAdmin });

  const auditRow = await prisma.auditLog.findFirst({
    where: { targetType: "Market", targetId: market.id, action: "MARKET_STATUS_CHANGED" },
  });
  assert.ok(auditRow, "expected a MARKET_STATUS_CHANGED audit row");
  assert.equal(auditRow.actorUserId, admin.id);
  assert.deepEqual(auditRow.previousValue, { status: "ACTIVE" });
  assert.deepEqual(auditRow.newValue, { status: "CLOSED" });
});

// --- REGRESSION ----------------------------------------------------------

test("REGRESSION: the existing add-market-to-zone workflow (createMarket) still works", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/markets", {
    method: "POST", token: tokenAdmin, body: { name: `${TAG} regression-create`, zoneId: zoneA.id },
  });
  assert.equal(status, 201);
  trackMarket(body.id);
  assert.equal(body.zoneId, zoneA.id);
  assert.equal(body.status, "ACTIVE");
});

test("REGRESSION: existing Regional Manager (Supervisor) assignment still works", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} regression-assign` });
  const newSupervisor = await makeStaffUser({ role: "SUPERVISOR" });
  const { status, body } = await apiFetch(baseUrl, `/api/markets/${market.id}/supervisor`, {
    method: "PATCH", token: tokenAdmin, body: { supervisorId: newSupervisor.id },
  });
  assert.equal(status, 200);
  assert.equal(body.supervisorId, newSupervisor.id);
});

test("REGRESSION: existing employee/market permissions (Supervisor scoped to own market) still work", async () => {
  const market = await makeMarket({ zoneId: zoneA.id, name: `${TAG} regression-scope` });
  const worker = await makeEmployee({ marketId: market.id, name: `${TAG} regression-scope-worker` });
  trackEmployee(worker.id);
  const supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  const tokenSup = tokenForStaff(supervisor, { managedMarket: market });

  const own = await apiFetch(baseUrl, `/api/employees?marketId=${market.id}`, { token: tokenSup });
  assert.equal(own.status, 200);
  assert.ok(own.body.some((e) => e.id === worker.id));

  const otherMarket = await makeMarket({ zoneId: zoneA.id, name: `${TAG} regression-scope-other` });
  const other = await apiFetch(baseUrl, `/api/employees?marketId=${otherMarket.id}`, { token: tokenSup });
  assert.equal(other.status, 403, "a Supervisor must still never reach another market's employees");
});
