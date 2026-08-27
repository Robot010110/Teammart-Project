// adminPhase1.test.js — Admin Phase 1: company-wide visibility
// (overview, attendance, activities, global search) built entirely on
// the existing Zone/Market/Employee/AttendanceRecord/Activity tables —
// no parallel Admin data model. See test/helpers.js for the shared
// fixture/cleanup strategy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee,
  trackAttendanceRecord, trackActivity, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB, marketA, marketB;
let admin, rmA, rmB, supervisorA, supervisorB;
let employeeA1, employeeA2, employeeB1;
let tokenAdmin, tokenRmA, tokenSupervisorA, tokenEmployeeA1;

function todayDayOnly() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90601);
  zoneB = await makeZone(90602);

  admin = await makeStaffUser({ role: "ADMIN" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });

  await prisma.zone.update({ where: { id: zoneA.id }, data: { managerId: rmA.id } });
  await prisma.zone.update({ where: { id: zoneB.id }, data: { managerId: rmB.id } });

  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id, name: `AdminP1 Market A` });
  marketB = await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorB.id, name: `AdminP1 Market B` });

  employeeA1 = await makeEmployee({ marketId: marketA.id, name: "AdminP1 Working Worker", role: "WORKER" });
  employeeA2 = await makeEmployee({ marketId: marketA.id, name: "AdminP1 CheckedOut Cashier", role: "CASHIER" });
  employeeB1 = await makeEmployee({ marketId: marketB.id, name: "AdminP1 Missing Worker", role: "WORKER" });

  const day = todayDayOnly();
  const working = await prisma.attendanceRecord.create({
    data: { employeeId: employeeA1.id, marketId: marketA.id, date: day, status: "PRESENT", checkIn: new Date(), requiredHours: 8, source: "MANUAL" },
  });
  trackAttendanceRecord(working.id);
  const checkedOut = await prisma.attendanceRecord.create({
    data: { employeeId: employeeA2.id, marketId: marketA.id, date: day, status: "PRESENT", checkIn: new Date(Date.now() - 3600_000), checkOut: new Date(), requiredHours: 8, source: "MANUAL" },
  });
  trackAttendanceRecord(checkedOut.id);
  // employeeB1 deliberately has no record for today — MISSING.

  const activity = await prisma.activity.create({
    data: { category: "SHELF_CLEANING", date: day, time: "9:00 AM", status: "PENDING", employeeId: employeeA1.id },
  });
  trackActivity(activity.id);

  tokenAdmin = tokenForStaff(admin);
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenEmployeeA1 = tokenForEmployee(employeeA1);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- AUTHORIZATION -------------------------------------------------

test("AUTH: Admin can access the company overview endpoint", async () => {
  const { status } = await apiFetch(baseUrl, "/api/admin/overview", { token: tokenAdmin });
  assert.equal(status, 200);
});

test("AUTH: Employee cannot access the company overview endpoint", async () => {
  const { status } = await apiFetch(baseUrl, "/api/admin/overview", { token: tokenEmployeeA1 });
  assert.equal(status, 403);
});

test("AUTH: Supervisor cannot access the company overview endpoint", async () => {
  const { status } = await apiFetch(baseUrl, "/api/admin/overview", { token: tokenSupervisorA });
  assert.equal(status, 403);
});

test("AUTH: Regional Manager cannot access the company overview endpoint", async () => {
  const { status } = await apiFetch(baseUrl, "/api/admin/overview", { token: tokenRmA });
  assert.equal(status, 403);
});

test("AUTH: unauthenticated request to an Admin endpoint is rejected", async () => {
  const { status } = await apiFetch(baseUrl, "/api/admin/overview");
  assert.equal(status, 401);
});

// --- COMPANY VISIBILITY ----------------------------------------------

test("VISIBILITY: Admin's overview reflects real company-wide counts", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/admin/overview", { token: tokenAdmin });
  assert.equal(status, 200);
  assert.ok(body.zonesCount >= 2);
  assert.ok(body.marketsCount >= 2);
  assert.ok(body.totalEmployees >= 3);
  assert.ok(body.employeesByRole.WORKER >= 2);
  assert.ok(body.staffByRole.REGIONAL_MANAGER >= 2);
});

test("VISIBILITY: Admin can retrieve zones across the company, including an unrelated zone", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/zones", { token: tokenAdmin });
  assert.equal(status, 200);
  // listZones shapes id as "zone-<numericId>" (see zonesController's
  // shapeZoneSummary) — compare on the real `number` field instead.
  const numbers = body.map((z) => z.number);
  assert.ok(numbers.includes(zoneA.number));
  assert.ok(numbers.includes(zoneB.number));
});

test("VISIBILITY: Admin can retrieve markets across the company, including an unrelated zone's market", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/markets", { token: tokenAdmin });
  assert.equal(status, 200);
  const ids = body.map((m) => m.id);
  assert.ok(ids.includes(marketA.id));
  assert.ok(ids.includes(marketB.id));
});

test("VISIBILITY: Admin can retrieve employees across the company, including an unrelated market's employee", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/employees", { token: tokenAdmin });
  assert.equal(status, 200);
  const ids = body.map((e) => e.id);
  assert.ok(ids.includes(employeeA1.id));
  assert.ok(ids.includes(employeeB1.id));
  assert.ok(!("passwordHash" in body[0]));
});

test("VISIBILITY: Admin's company-wide attendance shows working/checked-out/missing states correctly", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/attendance/company", { token: tokenAdmin });
  assert.equal(status, 200);
  const byId = new Map(body.rows.map((r) => [r.id, r]));
  assert.equal(byId.get(employeeA1.id).state, "WORKING");
  assert.equal(byId.get(employeeA2.id).state, "CHECKED_OUT");
  assert.equal(byId.get(employeeB1.id).state, "MISSING");
  assert.ok(body.summary.working >= 1);
  assert.ok(body.summary.checkedOut >= 1);
  assert.ok(body.summary.missing >= 1);
});

test("VISIBILITY: company-wide attendance can be filtered to one market", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/attendance/company?marketId=${marketA.id}`, { token: tokenAdmin });
  assert.equal(status, 200);
  const ids = body.rows.map((r) => r.id);
  assert.ok(ids.includes(employeeA1.id));
  assert.ok(!ids.includes(employeeB1.id));
});

test("VISIBILITY: Admin can retrieve company-wide activities without specifying a market", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/activities/company", { token: tokenAdmin });
  assert.equal(status, 200);
  assert.ok(body.some((a) => a.employeeId === employeeA1.id));
});

// --- REGIONAL MANAGER ISOLATION ----------------------------------------

test("RM ISOLATION: implementing Admin did not grant a Regional Manager company-wide access", async () => {
  const overview = await apiFetch(baseUrl, "/api/admin/overview", { token: tokenRmA });
  assert.equal(overview.status, 403);

  const companyAttendance = await apiFetch(baseUrl, "/api/attendance/company", { token: tokenRmA });
  assert.equal(companyAttendance.status, 403);

  const companyActivities = await apiFetch(baseUrl, "/api/activities/company", { token: tokenRmA });
  assert.equal(companyActivities.status, 403);

  const search = await apiFetch(baseUrl, `/api/admin/search?q=${encodeURIComponent(employeeA1.name)}`, { token: tokenRmA });
  assert.equal(search.status, 403);
});

test("RM ISOLATION: a Regional Manager's own zones/markets list is still zone-scoped, not company-wide", async () => {
  const zones = await apiFetch(baseUrl, "/api/zones", { token: tokenRmA });
  assert.equal(zones.status, 200);
  const zoneNumbers = zones.body.map((z) => z.number);
  assert.ok(zoneNumbers.includes(zoneA.number));
  assert.ok(!zoneNumbers.includes(zoneB.number));

  const markets = await apiFetch(baseUrl, "/api/markets", { token: tokenRmA });
  assert.equal(markets.status, 200);
  const marketIds = markets.body.map((m) => m.id);
  assert.ok(marketIds.includes(marketA.id));
  assert.ok(!marketIds.includes(marketB.id));
});

// --- GLOBAL SEARCH -----------------------------------------------------

test("SEARCH: Admin can search for an employee by name", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/admin/search?q=${encodeURIComponent("AdminP1 Working Worker")}`, { token: tokenAdmin });
  assert.equal(status, 200);
  assert.ok(body.employees.some((e) => e.id === employeeA1.id));
  assert.ok(!("passwordHash" in (body.employees[0] ?? {})));
});

test("SEARCH: Admin can search for a market by name", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/admin/search?q=${encodeURIComponent("AdminP1 Market A")}`, { token: tokenAdmin });
  assert.equal(status, 200);
  assert.ok(body.markets.some((m) => m.id === marketA.id));
});

test("SEARCH: Admin can search for a zone by number", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/admin/search?q=Zone ${zoneA.number}`, { token: tokenAdmin });
  assert.equal(status, 200);
  assert.ok(body.zones.some((z) => z.id === zoneA.id));
});

test("SEARCH: unauthorized roles cannot use the Admin global-search endpoint", async () => {
  const asEmployee = await apiFetch(baseUrl, "/api/admin/search?q=test", { token: tokenEmployeeA1 });
  assert.equal(asEmployee.status, 403);
  const asSupervisor = await apiFetch(baseUrl, "/api/admin/search?q=test", { token: tokenSupervisorA });
  assert.equal(asSupervisor.status, 403);
});

// --- CHAT (unchanged by Admin Phase 1) ---------------------------------

test("CHAT: existing Admin Chat inbox endpoint remains intact", async () => {
  const { status } = await apiFetch(baseUrl, "/api/conversations/admin", { token: tokenAdmin });
  assert.equal(status, 200);
});

// --- PRIVACY -------------------------------------------------------

test("PRIVACY: no endpoint in this suite ever returns a passwordHash or password field", async () => {
  const [overview, employees, attendance, activities, search] = await Promise.all([
    apiFetch(baseUrl, "/api/admin/overview", { token: tokenAdmin }),
    apiFetch(baseUrl, "/api/employees", { token: tokenAdmin }),
    apiFetch(baseUrl, "/api/attendance/company", { token: tokenAdmin }),
    apiFetch(baseUrl, "/api/activities/company", { token: tokenAdmin }),
    apiFetch(baseUrl, `/api/admin/search?q=${encodeURIComponent(employeeA1.name)}`, { token: tokenAdmin }),
  ]);
  const blobs = [overview.body, employees.body, attendance.body, activities.body, search.body];
  for (const blob of blobs) {
    const text = JSON.stringify(blob);
    assert.ok(!/passwordHash/i.test(text), "response must never contain a passwordHash field");
    assert.ok(!/"password"\s*:/i.test(text), "response must never contain a plaintext password field");
  }
});
