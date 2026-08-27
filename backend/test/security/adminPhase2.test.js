// adminPhase2.test.js — Admin Phase 2: role changes, promotion/demotion
// between Employee and staff (User) identity spaces, market/zone
// reassignment, password reset, account status (suspend/ban/reactivate),
// session invalidation via tokenVersion, and two-Admin safety. See
// test/helpers.js for the shared fixture/cleanup strategy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, trackEmployee, trackUser, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB, marketA, marketB;
let admin, tokenAdmin;
let supervisorA, tokenSupervisorA;
let rmA, tokenRmA;
let workerA, tokenWorkerA, workerEmployeeCode;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90701);
  zoneB = await makeZone(90702);

  admin = await makeStaffUser({ role: "ADMIN" });
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });

  await prisma.zone.update({ where: { id: zoneA.id }, data: { managerId: rmA.id } });

  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id, name: "AdminP2 Market A" });
  marketB = await makeMarket({ zoneId: zoneB.id, name: "AdminP2 Market B" });

  workerA = await makeEmployee({ marketId: marketA.id, name: "AdminP2 Worker", role: "WORKER" });
  workerEmployeeCode = workerA.employeeCode;

  tokenAdmin = tokenForStaff(admin);
  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenWorkerA = tokenForEmployee(workerA);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- AUTHORIZATION ------------------------------------------------------

test("AUTH: non-Admin roles cannot call any Admin Phase 2 endpoint", async () => {
  const attempts = [
    apiFetch(baseUrl, `/api/admin/staff/${supervisorA.id}/role`, { method: "POST", token: tokenSupervisorA, body: { role: "ADMIN" } }),
    apiFetch(baseUrl, `/api/admin/staff/${supervisorA.id}/status`, { method: "POST", token: tokenRmA, body: { status: "SUSPENDED", reason: "x" } }),
    apiFetch(baseUrl, `/api/admin/employees/${workerA.id}/promote`, { method: "POST", token: tokenWorkerA, body: { role: "SUPERVISOR", email: "x@x.com", password: "password123" } }),
  ];
  const results = await Promise.all(attempts);
  for (const r of results) assert.equal(r.status, 403);
});

// --- PROMOTE (Employee -> Staff) ----------------------------------------

test("PROMOTE: Worker -> Supervisor requires marketId", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/admin/employees/${workerA.id}/promote`, {
    method: "POST", token: tokenAdmin, body: { role: "SUPERVISOR", email: `promo-${Date.now()}@test.local`, password: "password123" },
  });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test("PROMOTE: Worker -> Supervisor succeeds, links identities, disables the old Employee login, and grants Market ownership", async () => {
  const email = `promo-${Date.now()}@test.local`;
  const { status, body } = await apiFetch(baseUrl, `/api/admin/employees/${workerA.id}/promote`, {
    method: "POST", token: tokenAdmin, body: { role: "SUPERVISOR", email, password: "password123", marketId: marketB.id },
  });
  assert.equal(status, 201);
  assert.equal(body.role, "SUPERVISOR");
  trackUser(body.id);

  const market = await prisma.market.findUnique({ where: { id: marketB.id } });
  assert.equal(market.supervisorId, body.id);

  const oldEmployee = await prisma.employee.findUnique({ where: { id: workerA.id } });
  assert.equal(oldEmployee.accountStatus, "SUSPENDED");

  // The employee's pre-promotion token must be rejected immediately
  // (tokenVersion bump), even though the JWT itself hasn't expired.
  const staleTokenAttempt = await apiFetch(baseUrl, "/api/profile", { token: tokenWorkerA });
  assert.equal(staleTokenAttempt.status, 401);

  // The new staff account can log in with the password just set.
  const login = await apiFetch(baseUrl, "/api/auth/login", { method: "POST", body: { email, password: "password123" } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "SUPERVISOR");
});

// --- DEMOTE (Staff -> Employee) ------------------------------------------

test("DEMOTE: an Admin account cannot be demoted", async () => {
  const { status } = await apiFetch(baseUrl, `/api/admin/staff/${admin.id}/demote`, {
    method: "POST", token: tokenAdmin, body: { role: "WORKER", marketId: marketA.id, password: "password123" },
  });
  assert.equal(status, 400);
});

test("DEMOTE: Supervisor -> Worker clears market ownership, links identities, and disables the old staff login", async () => {
  const demotable = await makeStaffUser({ role: "SUPERVISOR" });
  const market = await makeMarket({ zoneId: zoneA.id, supervisorId: demotable.id, name: "AdminP2 Demote Market" });
  const tokenDemotable = tokenForStaff(demotable, { managedMarket: market });

  const { status, body } = await apiFetch(baseUrl, `/api/admin/staff/${demotable.id}/demote`, {
    method: "POST", token: tokenAdmin, body: { role: "WORKER", marketId: market.id, password: "password123", shift: "MORNING" },
  });
  assert.equal(status, 201);
  assert.equal(body.role, "WORKER");
  trackEmployee(body.id);

  const marketAfter = await prisma.market.findUnique({ where: { id: market.id } });
  assert.equal(marketAfter.supervisorId, null);

  const oldUser = await prisma.user.findUnique({ where: { id: demotable.id } });
  assert.equal(oldUser.accountStatus, "SUSPENDED");

  const staleTokenAttempt = await apiFetch(baseUrl, "/api/profile", { token: tokenDemotable });
  assert.equal(staleTokenAttempt.status, 401);
});

// --- ROLE CHANGE (staff-to-staff) ----------------------------------------

test("ROLE CHANGE: promoting to Regional Manager requires at least one zone", async () => {
  const target = await makeStaffUser({ role: "SUPERVISOR" });
  const { status } = await apiFetch(baseUrl, `/api/admin/staff/${target.id}/role`, {
    method: "POST", token: tokenAdmin, body: { role: "REGIONAL_MANAGER" },
  });
  assert.equal(status, 400);
});

test("ROLE CHANGE: Supervisor -> Regional Manager clears market ownership and assigns zones; old token is invalidated", async () => {
  const target = await makeStaffUser({ role: "SUPERVISOR" });
  const market = await makeMarket({ zoneId: zoneA.id, supervisorId: target.id, name: "AdminP2 RoleChange Market" });
  const tokenTarget = tokenForStaff(target, { managedMarket: market });

  const { status, body } = await apiFetch(baseUrl, `/api/admin/staff/${target.id}/role`, {
    method: "POST", token: tokenAdmin, body: { role: "REGIONAL_MANAGER", zoneIds: [zoneA.id, zoneB.id] },
  });
  assert.equal(status, 200);
  assert.equal(body.role, "REGIONAL_MANAGER");

  const marketAfter = await prisma.market.findUnique({ where: { id: market.id } });
  assert.equal(marketAfter.supervisorId, null);

  const zonesAfter = await prisma.zone.findMany({ where: { managerId: target.id } });
  assert.equal(zonesAfter.length, 2);

  const staleTokenAttempt = await apiFetch(baseUrl, "/api/profile", { token: tokenTarget });
  assert.equal(staleTokenAttempt.status, 401);
});

test("ROLE CHANGE: Regional Manager -> Supervisor requires marketId and releases zone ownership", async () => {
  const target = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  await prisma.zone.update({ where: { id: zoneB.id }, data: { managerId: target.id } });

  const missingMarket = await apiFetch(baseUrl, `/api/admin/staff/${target.id}/role`, {
    method: "POST", token: tokenAdmin, body: { role: "SUPERVISOR" },
  });
  assert.equal(missingMarket.status, 400);

  const newMarket = await makeMarket({ zoneId: zoneA.id, name: "AdminP2 RM->Sup Market" });
  const { status } = await apiFetch(baseUrl, `/api/admin/staff/${target.id}/role`, {
    method: "POST", token: tokenAdmin, body: { role: "SUPERVISOR", marketId: newMarket.id },
  });
  assert.equal(status, 200);

  const zoneAfter = await prisma.zone.findUnique({ where: { id: zoneB.id } });
  assert.equal(zoneAfter.managerId, null);
  const marketAfter = await prisma.market.findUnique({ where: { id: newMarket.id } });
  assert.equal(marketAfter.supervisorId, target.id);
});

// --- MARKET / ZONE REASSIGNMENT -------------------------------------------

test("ASSIGNMENT: reassigning a Supervisor to a different market clears the stale prior assignment", async () => {
  const supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  const oldMarket = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisor.id, name: "AdminP2 Old Market" });
  const newMarket = await makeMarket({ zoneId: zoneA.id, name: "AdminP2 New Market" });

  const { status } = await apiFetch(baseUrl, `/api/markets/${newMarket.id}/supervisor`, {
    method: "PATCH", token: tokenAdmin, body: { supervisorId: supervisor.id },
  });
  assert.equal(status, 200);

  const oldAfter = await prisma.market.findUnique({ where: { id: oldMarket.id } });
  assert.equal(oldAfter.supervisorId, null);
  const newAfter = await prisma.market.findUnique({ where: { id: newMarket.id } });
  assert.equal(newAfter.supervisorId, supervisor.id);
});

test("ASSIGNMENT: a Regional Manager's zone list can be fully replaced while preserving multi-zone support", async () => {
  const rm = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  const zoneC = await makeZone(90703);
  const zoneD = await makeZone(90704);
  await prisma.zone.update({ where: { id: zoneC.id }, data: { managerId: rm.id } });

  const { status, body } = await apiFetch(baseUrl, `/api/admin/staff/${rm.id}/zones`, {
    method: "POST", token: tokenAdmin, body: { zoneIds: [zoneD.id] },
  });
  assert.equal(status, 200);
  assert.deepEqual(body.zones.map((z) => z.id).sort(), [zoneD.id]);

  const zoneCAfter = await prisma.zone.findUnique({ where: { id: zoneC.id } });
  assert.equal(zoneCAfter.managerId, null);
});

// --- PASSWORD RESET --------------------------------------------------------

test("PASSWORD RESET: employee password changes, old token is rejected, new password authenticates, plaintext is never returned", async () => {
  const employee = await makeEmployee({ marketId: marketA.id, name: "AdminP2 Reset Target" });
  await prisma.employee.update({ where: { id: employee.id }, data: { employeeCode: `RESETME-${Date.now()}` } });
  const freshEmployee = await prisma.employee.findUnique({ where: { id: employee.id } });
  const tokenBefore = tokenForEmployee(freshEmployee);

  const { status, body } = await apiFetch(baseUrl, `/api/admin/employees/${employee.id}/reset-password`, {
    method: "POST", token: tokenAdmin, body: { newPassword: "brandNewPassword1" },
  });
  assert.equal(status, 200);
  assert.ok(!JSON.stringify(body).includes("brandNewPassword1"));

  const staleAttempt = await apiFetch(baseUrl, "/api/profile", { token: tokenBefore });
  assert.equal(staleAttempt.status, 401);

  const login = await apiFetch(baseUrl, "/api/auth/employee-login", {
    method: "POST", body: { employeeCode: freshEmployee.employeeCode, password: "brandNewPassword1" },
  });
  assert.equal(login.status, 200);
});

// --- ACCOUNT STATUS: SUSPEND / BAN / REACTIVATE ---------------------------

test("STATUS: suspending an account requires a reason", async () => {
  const target = await makeStaffUser({ role: "SUPERVISOR" });
  const { status } = await apiFetch(baseUrl, `/api/admin/staff/${target.id}/status`, {
    method: "POST", token: tokenAdmin, body: { status: "SUSPENDED" },
  });
  assert.equal(status, 400);
});

test("STATUS: a suspended employee cannot log in, and reactivation restores login", async () => {
  const employee = await makeEmployee({ marketId: marketA.id, name: "AdminP2 Suspend Target" });
  await prisma.employee.update({ where: { id: employee.id }, data: { employeeCode: `SUSPEND-${Date.now()}`, passwordHash: await hashFor("testPass1") } });
  const freshEmployee = await prisma.employee.findUnique({ where: { id: employee.id } });

  const suspend = await apiFetch(baseUrl, `/api/admin/employees/${employee.id}/status`, {
    method: "POST", token: tokenAdmin, body: { status: "SUSPENDED", reason: "Under review" },
  });
  assert.equal(suspend.status, 200);

  const loginBlocked = await apiFetch(baseUrl, "/api/auth/employee-login", {
    method: "POST", body: { employeeCode: freshEmployee.employeeCode, password: "testPass1" },
  });
  assert.equal(loginBlocked.status, 403);

  const reactivate = await apiFetch(baseUrl, `/api/admin/employees/${employee.id}/status`, {
    method: "POST", token: tokenAdmin, body: { status: "ACTIVE" },
  });
  assert.equal(reactivate.status, 200);

  const loginAllowed = await apiFetch(baseUrl, "/api/auth/employee-login", {
    method: "POST", body: { employeeCode: freshEmployee.employeeCode, password: "testPass1" },
  });
  assert.equal(loginAllowed.status, 200);
});

test("STATUS: a banned staff account cannot log in", async () => {
  const target = await makeStaffUser({ role: "SUPERVISOR" });
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await hashFor("testPass2") } });

  const ban = await apiFetch(baseUrl, `/api/admin/staff/${target.id}/status`, {
    method: "POST", token: tokenAdmin, body: { status: "BANNED", reason: "Policy violation" },
  });
  assert.equal(ban.status, 200);

  const loginBlocked = await apiFetch(baseUrl, "/api/auth/login", { method: "POST", body: { email: target.email, password: "testPass2" } });
  assert.equal(loginBlocked.status, 403);
});

// --- TWO-ADMIN SAFETY -------------------------------------------------------

test("TWO-ADMIN SAFETY: cannot suspend/ban/change the role of the last remaining Admin account", async () => {
  // This runs against a shared dev database that may already have other
  // ACTIVE Admin accounts (e.g. prisma/seed.js's own). The safety rule
  // only bites when the TARGET account is the last active Admin, so this
  // test builds that exact scenario deterministically: quarantine every
  // other active Admin for the duration of the test, restoring them
  // afterward, rather than asserting anything about incidental DB state.
  const otherActiveAdmins = await prisma.user.findMany({
    where: { role: "ADMIN", accountStatus: "ACTIVE", id: { not: admin.id } },
    select: { id: true },
  });
  await prisma.user.updateMany({
    where: { id: { in: otherActiveAdmins.map((u) => u.id) } },
    data: { accountStatus: "SUSPENDED" },
  });

  try {
    const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", accountStatus: "ACTIVE" } });
    assert.equal(activeAdminCount, 1, "quarantine setup must leave exactly this test's own Admin active");

    const suspend = await apiFetch(baseUrl, `/api/admin/staff/${admin.id}/status`, {
      method: "POST", token: tokenAdmin, body: { status: "SUSPENDED", reason: "test" },
    });
    assert.equal(suspend.status, 400);

    const roleChange = await apiFetch(baseUrl, `/api/admin/staff/${admin.id}/role`, {
      method: "POST", token: tokenAdmin, body: { role: "SUPERVISOR", marketId: marketA.id },
    });
    assert.equal(roleChange.status, 400);

    const stillActive = await prisma.user.count({ where: { role: "ADMIN", accountStatus: "ACTIVE" } });
    assert.equal(stillActive, 1, "the mutation must not have partially applied");
  } finally {
    await prisma.user.updateMany({
      where: { id: { in: otherActiveAdmins.map((u) => u.id) } },
      data: { accountStatus: "ACTIVE" },
    });
  }
});

test("TWO-ADMIN SAFETY: a second Admin CAN be suspended once two active Admins exist, and the first Admin remains untouched", async () => {
  const secondAdmin = await makeStaffUser({ role: "ADMIN" });

  const suspend = await apiFetch(baseUrl, `/api/admin/staff/${secondAdmin.id}/status`, {
    method: "POST", token: tokenAdmin, body: { status: "SUSPENDED", reason: "test cleanup" },
  });
  assert.equal(suspend.status, 200);

  const firstAdminAfter = await prisma.user.findUnique({ where: { id: admin.id } });
  assert.equal(firstAdminAfter.accountStatus, "ACTIVE");

  // Reactivate for cleanliness (not required for correctness, just tidy).
  await prisma.user.update({ where: { id: secondAdmin.id }, data: { accountStatus: "ACTIVE" } });
});

// --- PRIVACY -----------------------------------------------------------

test("PRIVACY: no Admin Phase 2 endpoint ever returns a passwordHash or plaintext password", async () => {
  const target = await makeStaffUser({ role: "SUPERVISOR" });
  const results = await Promise.all([
    apiFetch(baseUrl, `/api/admin/staff/${target.id}`, { method: "PATCH", token: tokenAdmin, body: { name: "Renamed" } }),
    apiFetch(baseUrl, `/api/admin/staff/${target.id}/status`, { method: "POST", token: tokenAdmin, body: { status: "ACTIVE" } }),
  ]);
  for (const r of results) {
    const text = JSON.stringify(r.body);
    assert.ok(!/passwordHash/i.test(text));
    assert.ok(!/"password"\s*:/i.test(text));
  }
});

async function hashFor(plain) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(plain, 10);
}
