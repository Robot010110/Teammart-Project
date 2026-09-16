// employeeStatus.test.js — the "Active" status fix: an employee's
// presence status (ACTIVE/BREAK/NOT_ACTIVE) must come from their real
// AttendanceRecord for TODAY, never from employmentStatus, a session,
// or any other proxy for "logged in" — see utils/employeeStatus.js's
// attachAttendanceState and its callers (employeesController.listEmployees
// /.getEmployee, profileController.getProfile).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  prisma, TAG, startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";
import { attachAttendanceState } from "../../src/utils/employeeStatus.js";

let server, baseUrl;
let zone, market, admin, adminToken;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94901);
  admin = await makeStaffUser({ role: "ADMIN" });
  adminToken = tokenForStaff(admin);
  market = await makeMarket({ zoneId: zone.id });
});

after(async () => {
  await cleanup();
  await stopServer(server);
  await prisma.$disconnect();
});

async function setRecord(employeeId, data) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const record = await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId, date: today } },
    update: data,
    create: { employeeId, marketId: market.id, date: today, ...data },
  });
  return record;
}

// --- Direct helper coverage (no HTTP) -----------------------------------

test("STATE: no check-in today -> NOT_ACTIVE", async () => {
  const e = await makeEmployee({ marketId: market.id, name: `${TAG} no-checkin` });
  const [result] = await attachAttendanceState([e]);
  assert.equal(result.attendanceState, "NOT_ACTIVE");
});

test("STATE: checked in, not checked out -> ACTIVE", async () => {
  const e = await makeEmployee({ marketId: market.id, name: `${TAG} checked-in` });
  await setRecord(e.id, { checkIn: new Date(), status: "PRESENT" });
  const [result] = await attachAttendanceState([e]);
  assert.equal(result.attendanceState, "ACTIVE");
});

test("STATE: checked in and on an active break -> BREAK", async () => {
  const e = await makeEmployee({ marketId: market.id, name: `${TAG} on-break` });
  await setRecord(e.id, { checkIn: new Date(), breakStart: new Date(), status: "PRESENT" });
  const [result] = await attachAttendanceState([e]);
  assert.equal(result.attendanceState, "BREAK");
});

test("STATE: break ended -> back to ACTIVE", async () => {
  const e = await makeEmployee({ marketId: market.id, name: `${TAG} break-ended` });
  await setRecord(e.id, { checkIn: new Date(), breakStart: new Date(), breakEnd: new Date(), status: "PRESENT" });
  const [result] = await attachAttendanceState([e]);
  assert.equal(result.attendanceState, "ACTIVE");
});

test("STATE: checked out -> NOT_ACTIVE", async () => {
  const e = await makeEmployee({ marketId: market.id, name: `${TAG} checked-out` });
  await setRecord(e.id, { checkIn: new Date(), checkOut: new Date(), status: "PRESENT" });
  const [result] = await attachAttendanceState([e]);
  assert.equal(result.attendanceState, "NOT_ACTIVE");
});

test("STATE: only a previous-day check-in exists -> NOT_ACTIVE for today", async () => {
  const e = await makeEmployee({ marketId: market.id, name: `${TAG} yesterday` });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const record = await prisma.attendanceRecord.create({
    data: { employeeId: e.id, marketId: market.id, date: yesterday, checkIn: yesterday, status: "PRESENT" },
  });
  const [result] = await attachAttendanceState([e]);
  assert.equal(result.attendanceState, "NOT_ACTIVE");
  void record;
});

test("STATE: DAY_OFF/APPROVED_LEAVE never reads as ACTIVE even with a stray checkIn value", async () => {
  const dayOff = await makeEmployee({ marketId: market.id, name: `${TAG} day-off` });
  await setRecord(dayOff.id, { checkIn: new Date(), status: "DAY_OFF" });
  const [r1] = await attachAttendanceState([dayOff]);
  assert.equal(r1.attendanceState, "NOT_ACTIVE");

  const onLeave = await makeEmployee({ marketId: market.id, name: `${TAG} on-leave` });
  await setRecord(onLeave.id, { checkIn: new Date(), status: "APPROVED_LEAVE" });
  const [r2] = await attachAttendanceState([onLeave]);
  assert.equal(r2.attendanceState, "NOT_ACTIVE");
});

test("STATE: two employees can have different statuses at the same instant", async () => {
  const a = await makeEmployee({ marketId: market.id, name: `${TAG} A-active` });
  const b = await makeEmployee({ marketId: market.id, name: `${TAG} B-notactive` });
  const c = await makeEmployee({ marketId: market.id, name: `${TAG} C-break` });
  await setRecord(a.id, { checkIn: new Date(), status: "PRESENT" });
  await setRecord(c.id, { checkIn: new Date(), breakStart: new Date(), status: "PRESENT" });

  const results = await attachAttendanceState([a, b, c]);
  const byName = Object.fromEntries(results.map((r) => [r.id, r.attendanceState]));
  assert.equal(byName[a.id], "ACTIVE");
  assert.equal(byName[b.id], "NOT_ACTIVE");
  assert.equal(byName[c.id], "BREAK");
});

// --- Real endpoints, full state machine, and no-false-Active guarantee --

test("E2E: a freshly created employee shows NOT_ACTIVE everywhere, never ACTIVE by default", async () => {
  const fresh1 = await makeEmployee({ marketId: market.id, name: `${TAG} fresh1` });
  const fresh2 = await makeEmployee({ marketId: market.id, name: `${TAG} fresh2` });
  const fresh3 = await makeEmployee({ marketId: market.id, name: `${TAG} fresh3` });

  const { status, body } = await apiFetch(baseUrl, `/api/employees?marketId=${market.id}`, { token: adminToken });
  assert.equal(status, 200);
  for (const id of [fresh1.id, fresh2.id, fresh3.id]) {
    const row = body.find((r) => r.id === id);
    assert.ok(row, "freshly created employee must be present in the list");
    assert.equal(row.attendanceState, "NOT_ACTIVE", `employee ${row.name} must not default to ACTIVE`);
  }
});

test("E2E: full check-in -> break -> break-end -> check-out state machine, verified via GET /api/employees and GET /api/profile", async () => {
  const employee = await makeEmployee({ marketId: market.id, name: `${TAG} e2e-worker` });
  const empToken = tokenForEmployee(employee);

  async function liveStateViaList() {
    const { body } = await apiFetch(baseUrl, `/api/employees?marketId=${market.id}`, { token: adminToken });
    return body.find((r) => r.id === employee.id)?.attendanceState;
  }
  async function liveStateViaProfile() {
    const { body } = await apiFetch(baseUrl, "/api/profile", { token: empToken });
    return body.attendanceState;
  }

  // 1. No check-in yet -> NOT_ACTIVE
  assert.equal(await liveStateViaList(), "NOT_ACTIVE");
  assert.equal(await liveStateViaProfile(), "NOT_ACTIVE");

  // 2. Check in -> ACTIVE
  const checkInRes = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token: empToken });
  assert.equal(checkInRes.status, 201);
  assert.equal(await liveStateViaList(), "ACTIVE");
  assert.equal(await liveStateViaProfile(), "ACTIVE");

  // Back-date checkIn past the 4h break gate (real business rule,
  // unrelated to this fix — see attendanceController.BREAK_AVAILABLE_AFTER_MS).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
  await prisma.attendanceRecord.update({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
    data: { checkIn: fiveHoursAgo },
  });

  // 3. Start break -> BREAK
  const breakStartRes = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: empToken });
  assert.equal(breakStartRes.status, 200);
  assert.equal(await liveStateViaList(), "BREAK");
  assert.equal(await liveStateViaProfile(), "BREAK");

  // 4. End break -> back to ACTIVE
  const breakEndRes = await apiFetch(baseUrl, "/api/attendance/break-end", { method: "POST", token: empToken });
  assert.equal(breakEndRes.status, 200);
  assert.equal(await liveStateViaList(), "ACTIVE");
  assert.equal(await liveStateViaProfile(), "ACTIVE");

  // Back-date checkIn past the 8h checkout gate.
  const nineHoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000);
  await prisma.attendanceRecord.update({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
    data: { checkIn: nineHoursAgo },
  });

  // 5. Check out -> NOT_ACTIVE
  const checkOutRes = await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token: empToken });
  assert.equal(checkOutRes.status, 200);
  assert.equal(await liveStateViaList(), "NOT_ACTIVE");
  assert.equal(await liveStateViaProfile(), "NOT_ACTIVE");
});

test("E2E: cross-market authorization is unaffected — a Supervisor scoped to Market A never sees Market B's roster or status", async () => {
  const zoneB = await makeZone(94902);
  const marketB = await makeMarket({ zoneId: zoneB.id, name: `${TAG} Market B` });
  const employeeB = await makeEmployee({ marketId: marketB.id, name: `${TAG} market-b-employee` });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.attendanceRecord.create({
    data: { employeeId: employeeB.id, marketId: marketB.id, date: today, checkIn: new Date(), status: "PRESENT" },
  });

  const supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  const supervisorAToken = tokenForStaff(supervisorA, { managedMarket: market });

  const { status, body } = await apiFetch(baseUrl, "/api/employees", { token: supervisorAToken });
  assert.equal(status, 200);
  assert.ok(!body.some((r) => r.id === employeeB.id), "Market A supervisor must never see Market B's employee");
});
