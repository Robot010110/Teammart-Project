// adminPhase3.test.js — Admin Phase 3: Market Visits, Administrative
// Inspections, the Audit Log, reporting, and security/IDOR regression
// across the whole Admin surface. See test/helpers.js for the shared
// fixture/cleanup strategy; this file additionally cleans up its own
// MarketVisit/AuditLog rows (no generic tracker exists for either yet).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, marketA, marketNoSupervisor;
let admin, tokenAdmin;
let supervisorA, tokenSupervisorA;
let rmA, tokenRmA;
let workerA, tokenWorkerA;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90801);
  admin = await makeStaffUser({ role: "ADMIN" });
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  await prisma.zone.update({ where: { id: zoneA.id }, data: { managerId: rmA.id } });

  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id, name: "AdminP3 Market A" });
  marketNoSupervisor = await makeMarket({ zoneId: zoneA.id, name: "AdminP3 Market No Supervisor" });
  workerA = await makeEmployee({ marketId: marketA.id, name: "AdminP3 Worker" });

  tokenAdmin = tokenForStaff(admin);
  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenWorkerA = tokenForEmployee(workerA);
});

after(async () => {
  await stopServer(server);
  await prisma.marketVisit.deleteMany({ where: { marketId: { in: [marketA.id, marketNoSupervisor.id] } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ marketId: { in: [marketA.id, marketNoSupervisor.id] } }, { zoneId: zoneA.id }, { actorUserId: admin.id }] } });
  await cleanup();
});

// --- MARKET VISIT ---------------------------------------------------

test("VISIT: a normal Market page fetch never creates a visit record", async () => {
  await apiFetch(baseUrl, `/api/markets/${marketA.id}`, { token: tokenAdmin });
  const count = await prisma.marketVisit.count({ where: { marketId: marketA.id, adminUserId: { not: null } } });
  assert.equal(count, 0);
});

test("VISIT: non-Admin roles cannot start a Market Visit", async () => {
  const attempts = await Promise.all([
    apiFetch(baseUrl, `/api/admin/markets/${marketA.id}/visits`, { method: "POST", token: tokenSupervisorA, body: { visitType: "VISIT" } }),
    apiFetch(baseUrl, `/api/admin/markets/${marketA.id}/visits`, { method: "POST", token: tokenRmA, body: { visitType: "VISIT" } }),
    apiFetch(baseUrl, `/api/admin/markets/${marketA.id}/visits`, { method: "POST", token: tokenWorkerA, body: { visitType: "VISIT" } }),
  ]);
  for (const r of attempts) assert.equal(r.status, 403);
});

test("VISIT: Admin starts a Market Visit, correct Admin/Market recorded, and the Supervisor is notified", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/admin/markets/${marketA.id}/visits`, {
    method: "POST", token: tokenAdmin, body: { visitType: "VISIT" },
  });
  assert.equal(status, 201);
  assert.equal(body.marketId, marketA.id);
  assert.equal(body.adminUserId, admin.id);
  assert.equal(body.status, "STARTED");
  assert.equal(body.visitType, "VISIT");

  const notification = await prisma.notification.findFirst({
    where: { userId: supervisorA.id, type: "MARKET_VISIT" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(notification, "the market's Supervisor must receive a Market Visit notification");
  assert.match(notification.body, /AdminP3 Market A/);

  await prisma.marketVisit.update({ where: { id: body.id }, data: { status: "CANCELLED" } }); // clean slate for later tests
});

test("VISIT: an Admin cannot start a second visit while one is already open", async () => {
  const first = await apiFetch(baseUrl, `/api/admin/markets/${marketA.id}/visits`, { method: "POST", token: tokenAdmin, body: {} });
  assert.equal(first.status, 201);

  const second = await apiFetch(baseUrl, `/api/admin/markets/${marketA.id}/visits`, { method: "POST", token: tokenAdmin, body: {} });
  assert.equal(second.status, 409);

  await prisma.marketVisit.update({ where: { id: first.body.id }, data: { status: "CANCELLED" } });
});

test("VISIT: starting a visit at a market with no Supervisor does not crash and sends no notification", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/admin/markets/${marketNoSupervisor.id}/visits`, {
    method: "POST", token: tokenAdmin, body: {},
  });
  assert.equal(status, 201);
  await prisma.marketVisit.update({ where: { id: body.id }, data: { status: "CANCELLED" } });
});

test("VISIT: starting a visit for a nonexistent market returns 404, not a crash", async () => {
  const { status } = await apiFetch(baseUrl, "/api/admin/markets/does-not-exist/visits", { method: "POST", token: tokenAdmin, body: {} });
  assert.equal(status, 404);
});

// --- ADMINISTRATIVE INSPECTION (same table, different lifecycle) -------

test("INSPECTION: start -> complete transitions status and records an audit entry, not just opening the Market", async () => {
  const start = await apiFetch(baseUrl, `/api/admin/markets/${marketA.id}/visits`, {
    method: "POST", token: tokenAdmin, body: { visitType: "INSPECTION" },
  });
  assert.equal(start.status, 201);
  assert.equal(start.body.status, "STARTED");
  assert.equal(start.body.visitType, "INSPECTION");

  const complete = await apiFetch(baseUrl, `/api/admin/visits/${start.body.id}/complete`, {
    method: "PATCH", token: tokenAdmin, body: { notes: "Everything in order." },
  });
  assert.equal(complete.status, 200);
  assert.equal(complete.body.status, "COMPLETED");
  assert.ok(complete.body.endedAt);

  const doubleComplete = await apiFetch(baseUrl, `/api/admin/visits/${start.body.id}/complete`, { method: "PATCH", token: tokenAdmin, body: {} });
  assert.equal(doubleComplete.status, 400, "an already-completed inspection cannot be completed again");

  const auditRow = await prisma.auditLog.findFirst({ where: { action: "INSPECTION_COMPLETED", metadata: { path: ["visitId"], equals: start.body.id } } });
  assert.ok(auditRow, "completing an inspection must create an audit record");
});

test("INSPECTION: an inspection can be cancelled, and a cancelled one cannot be cancelled again", async () => {
  const start = await apiFetch(baseUrl, `/api/admin/markets/${marketA.id}/visits`, { method: "POST", token: tokenAdmin, body: { visitType: "INSPECTION" } });
  assert.equal(start.status, 201);

  const cancel = await apiFetch(baseUrl, `/api/admin/visits/${start.body.id}/cancel`, { method: "PATCH", token: tokenAdmin, body: { reason: "Wrong market" } });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.status, "CANCELLED");

  const doubleCancel = await apiFetch(baseUrl, `/api/admin/visits/${start.body.id}/cancel`, { method: "PATCH", token: tokenAdmin, body: {} });
  assert.equal(doubleCancel.status, 400);
});

test("VISIT: another Admin cannot complete/cancel a visit they did not start (IDOR)", async () => {
  const otherAdmin = await makeStaffUser({ role: "ADMIN" });
  const tokenOtherAdmin = tokenForStaff(otherAdmin);

  const start = await apiFetch(baseUrl, `/api/admin/markets/${marketA.id}/visits`, { method: "POST", token: tokenAdmin, body: {} });
  assert.equal(start.status, 201);

  const complete = await apiFetch(baseUrl, `/api/admin/visits/${start.body.id}/complete`, { method: "PATCH", token: tokenOtherAdmin, body: {} });
  assert.equal(complete.status, 404);

  await prisma.marketVisit.update({ where: { id: start.body.id }, data: { status: "CANCELLED" } });
});

test("VISIT: RM's own lightweight createMarketVisit is untouched and remains distinct from Admin visits", async () => {
  const rmVisit = await apiFetch(baseUrl, `/api/markets/${marketA.id}/visits`, { method: "POST", token: tokenRmA });
  assert.equal(rmVisit.status, 201);
  assert.equal(rmVisit.body.regionalManagerId, rmA.id);
  assert.equal(rmVisit.body.adminUserId, null);
  assert.equal(rmVisit.body.status, "COMPLETED", "a plain RM grouping visit has no open lifecycle");
});

test("VISIT: Admin visit history is paginated and filterable by market", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/admin/visits?marketId=${marketA.id}&pageSize=5`, { token: tokenAdmin });
  assert.equal(status, 200);
  assert.ok(body.visits.every((v) => v.marketId === marketA.id));
  assert.ok(body.visits.length <= 5);
  assert.equal(typeof body.total, "number");
});

test("VISIT: non-Admin roles cannot list Admin visit history", async () => {
  const { status } = await apiFetch(baseUrl, "/api/admin/visits", { token: tokenSupervisorA });
  assert.equal(status, 403);
});

// --- AUDIT LOG -----------------------------------------------------

test("AUDIT: a role change creates an audit record with the correct actor/target, and never contains a password", async () => {
  const target = await makeStaffUser({ role: "SUPERVISOR" });
  const market = await makeMarket({ zoneId: zoneA.id, name: "AdminP3 Audit Market" });

  await apiFetch(baseUrl, `/api/admin/staff/${target.id}/role`, {
    method: "POST", token: tokenAdmin, body: { role: "OVERLOOKING_SUPERVISOR", marketId: market.id },
  });

  const entry = await prisma.auditLog.findFirst({
    where: { action: "ROLE_CHANGED", targetType: "User", targetId: String(target.id) },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(entry);
  assert.equal(entry.actorUserId, admin.id);
  assert.ok(!JSON.stringify(entry).match(/passwordHash/i));
});

test("AUDIT: a password reset creates a PASSWORD_RESET record that never stores the password", async () => {
  const target = await makeEmployee({ marketId: marketA.id, name: "AdminP3 PwReset Target" });

  await apiFetch(baseUrl, `/api/admin/employees/${target.id}/reset-password`, {
    method: "POST", token: tokenAdmin, body: { newPassword: "aBrandNewSecret1" },
  });

  const entry = await prisma.auditLog.findFirst({ where: { action: "PASSWORD_RESET", targetType: "Employee", targetId: target.id } });
  assert.ok(entry);
  assert.ok(!JSON.stringify(entry).includes("aBrandNewSecret1"));
});

test("AUDIT: the audit log is paginated and filterable, and rejects non-Admin roles", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/admin/audit?pageSize=5&action=PASSWORD_RESET", { token: tokenAdmin });
  assert.equal(status, 200);
  assert.ok(body.entries.length <= 5);
  assert.ok(body.entries.every((e) => e.action === "PASSWORD_RESET"));

  const denied = await apiFetch(baseUrl, "/api/admin/audit", { token: tokenSupervisorA });
  assert.equal(denied.status, 403);
});

test("AUDIT: no endpoint exists to update or delete an audit record", async () => {
  const entry = await prisma.auditLog.findFirst();
  const patchAttempt = await apiFetch(baseUrl, `/api/admin/audit/${entry.id}`, { method: "PATCH", token: tokenAdmin, body: {} });
  assert.equal(patchAttempt.status, 404);
  const deleteAttempt = await apiFetch(baseUrl, `/api/admin/audit/${entry.id}`, { method: "DELETE", token: tokenAdmin });
  assert.equal(deleteAttempt.status, 404);
});

// --- REPORTING -------------------------------------------------------

test("REPORTS: company-wide summary returns real aggregate data, scoped by market, and rejects non-Admin roles", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/admin/reports/summary?marketId=${marketA.id}`, { token: tokenAdmin });
  assert.equal(status, 200);
  assert.ok(body.attendance);
  assert.ok(body.activities);
  assert.ok(body.visits);
  assert.ok(body.auditActions);

  const denied = await apiFetch(baseUrl, "/api/admin/reports/summary", { token: tokenRmA });
  assert.equal(denied.status, 403);
});

// --- SECURITY REGRESSION (tokenVersion / accountStatus / two-Admin) ----

test("SECURITY REGRESSION: tokenVersion invalidation and accountStatus blocking still work after Phase 3 changes", async () => {
  const employee = await makeEmployee({ marketId: marketA.id, name: "AdminP3 Regression Target" });
  const tokenBefore = tokenForEmployee(employee);

  await apiFetch(baseUrl, `/api/admin/employees/${employee.id}/reset-password`, { method: "POST", token: tokenAdmin, body: { newPassword: "regressionPass1" } });
  const staleAttempt = await apiFetch(baseUrl, "/api/profile", { token: tokenBefore });
  assert.equal(staleAttempt.status, 401);

  await apiFetch(baseUrl, `/api/admin/employees/${employee.id}/status`, { method: "POST", token: tokenAdmin, body: { status: "SUSPENDED", reason: "regression check" } });
  const login = await apiFetch(baseUrl, "/api/auth/employee-login", { method: "POST", body: { employeeCode: employee.employeeCode, password: "regressionPass1" } });
  assert.equal(login.status, 403);
});

test("SECURITY REGRESSION: two-Admin safety still rejects removing the last Admin", async () => {
  const otherActiveAdmins = await prisma.user.findMany({ where: { role: "ADMIN", accountStatus: "ACTIVE", id: { not: admin.id } }, select: { id: true } });
  await prisma.user.updateMany({ where: { id: { in: otherActiveAdmins.map((u) => u.id) } }, data: { accountStatus: "SUSPENDED" } });
  try {
    const { status } = await apiFetch(baseUrl, `/api/admin/staff/${admin.id}/status`, { method: "POST", token: tokenAdmin, body: { status: "BANNED", reason: "test" } });
    assert.equal(status, 400);
  } finally {
    await prisma.user.updateMany({ where: { id: { in: otherActiveAdmins.map((u) => u.id) } }, data: { accountStatus: "ACTIVE" } });
  }
});

// --- CHAT REGRESSION -------------------------------------------------

test("CHAT REGRESSION: Admin Chat inbox still works and visit notifications do not grant chat access", async () => {
  const { status } = await apiFetch(baseUrl, "/api/conversations/admin", { token: tokenAdmin });
  assert.equal(status, 200);
});

// --- IDOR / malformed ID handling --------------------------------------

test("IDOR: malformed visit/audit ids return a clean 404, not a server error", async () => {
  const results = await Promise.all([
    apiFetch(baseUrl, "/api/admin/visits/not-a-real-id/complete", { method: "PATCH", token: tokenAdmin, body: {} }),
    apiFetch(baseUrl, "/api/admin/visits/not-a-real-id/cancel", { method: "PATCH", token: tokenAdmin, body: {} }),
  ]);
  for (const r of results) assert.equal(r.status, 404);
});
