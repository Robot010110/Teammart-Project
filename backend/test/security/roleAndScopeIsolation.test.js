// roleAndScopeIsolation.test.js — the core authorization boundaries that
// must never regress: an Employee can't reach another Employee's data, a
// Supervisor can't reach another market, a Regional Manager can't reach
// a zone outside their own (including by editing the id in the URL), and
// Admin-only endpoints stay Admin-only. See test/helpers.js for the
// fixture/cleanup strategy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB, marketA, marketB, supervisorA, supervisorB, rmA, rmB, admin, employeeA, employeeB;
let tokenSupervisorA, tokenSupervisorB, tokenRmA, tokenRmB, tokenAdmin, tokenEmployeeA, tokenEmployeeB;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90001);
  zoneB = await makeZone(90002);

  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  admin = await makeStaffUser({ role: "ADMIN" });

  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id });
  marketB = await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorB.id });

  employeeA = await makeEmployee({ marketId: marketA.id });
  employeeB = await makeEmployee({ marketId: marketB.id });

  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenSupervisorB = tokenForStaff(supervisorB, { managedMarket: marketB });
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenRmB = tokenForStaff(rmB, { managedZones: [zoneB] });
  tokenAdmin = tokenForStaff(admin);
  tokenEmployeeA = tokenForEmployee(employeeA);
  tokenEmployeeB = tokenForEmployee(employeeB);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- A. Employee isolation -------------------------------------------
test("A: employee can access their own report summary", async () => {
  const { status } = await apiFetch(baseUrl, `/api/reports/employees/${employeeA.id}/summary`, { token: tokenEmployeeA });
  assert.equal(status, 200);
});

test("A: employee cannot access another employee's report summary (IDOR)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/reports/employees/${employeeB.id}/summary`, { token: tokenEmployeeA });
  assert.equal(status, 403);
});

// --- B. Supervisor market isolation ------------------------------------
test("B: Supervisor A can access their own market", async () => {
  const { status } = await apiFetch(baseUrl, `/api/markets/${marketA.id}`, { token: tokenSupervisorA });
  assert.equal(status, 200);
});

test("B: Supervisor A cannot access Market B (IDOR via URL param)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/markets/${marketB.id}`, { token: tokenSupervisorA });
  assert.equal(status, 403);
});

// --- C. Regional Manager zone isolation --------------------------------
test("C: RM A can access their own zone", async () => {
  const { status } = await apiFetch(baseUrl, `/api/zones/${zoneA.id}`, { token: tokenRmA });
  assert.equal(status, 200);
});

test("C: RM A cannot access Zone B (IDOR via URL param)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/zones/${zoneB.id}`, { token: tokenRmA });
  assert.equal(status, 403);
});

test("C: RM A cannot access a market inside Zone B (cross-zone IDOR)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/markets/${marketB.id}`, { token: tokenRmA });
  assert.equal(status, 403);
});

test("C: manipulating zoneId in a request body cannot create a market outside RM A's zones", async () => {
  const { status } = await apiFetch(baseUrl, "/api/markets", {
    method: "POST",
    token: tokenRmA,
    body: { name: "Sneaky Market", zoneId: zoneB.id },
  });
  assert.equal(status, 403);
});

// --- D. Admin authorization + H. Role separation ------------------------
test("D: Admin can create a zone", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/zones", { method: "POST", token: tokenAdmin, body: { number: 90099 } });
  assert.equal(status, 201);
  // Clean up the one non-fixture row this test itself creates.
  await apiFetch(baseUrl, `/api/zones/${body.id}`, { method: "DELETE", token: tokenAdmin });
});

test("D/H: Regional Manager cannot create a zone (Admin-only)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/zones", { method: "POST", token: tokenRmA, body: { number: 90098 } });
  assert.equal(status, 403);
});

test("D/H: Supervisor cannot create a zone (Admin-only)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/zones", { method: "POST", token: tokenSupervisorA, body: { number: 90097 } });
  assert.equal(status, 403);
});

test("D/H: Employee cannot create a zone (Admin-only)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/zones", { method: "POST", token: tokenEmployeeA, body: { number: 90096 } });
  assert.equal(status, 403);
});

test("H: Employee cannot use a staff-only endpoint (list employees)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/employees", { token: tokenEmployeeA });
  assert.equal(status, 403);
});

test("H: unauthenticated request is rejected before any authorization check", async () => {
  const { status } = await apiFetch(baseUrl, `/api/markets/${marketA.id}`);
  assert.equal(status, 401);
});
