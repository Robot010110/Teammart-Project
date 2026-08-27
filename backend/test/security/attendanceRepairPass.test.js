// attendanceRepairPass.test.js — Repair Pass §1: check-in/check-out
// reliability + self-service break, gated at 4h (break) and 8h
// (check-out) from a real check-in, enforced server-side. Timing is
// tested by backdating AttendanceRecord.checkIn via Prisma directly
// rather than waiting real hours (per the task's own "use testable time
// logic" instruction).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, supervisor, overlooking, rm, employee, cashier;
let tokenSupervisor, tokenOverlooking, tokenRm, tokenEmployee, tokenCashier;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zone = await makeZone(94001);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  overlooking = await makeStaffUser({ role: "OVERLOOKING_SUPERVISOR" });
  rm = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id, overlookingSupervisorId: overlooking.id });
  employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  cashier = await makeEmployee({ marketId: market.id, role: "CASHIER" });

  tokenSupervisor = tokenForStaff(supervisor, { managedMarket: market });
  tokenOverlooking = tokenForStaff(overlooking, { managedOverlookingMarket: market });
  tokenRm = tokenForStaff(rm, { managedZones: [zone] });
  tokenEmployee = tokenForEmployee(employee);
  tokenCashier = tokenForEmployee(cashier);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

async function freshCheckIn(token) {
  const res = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token });
  assert.equal(res.status, 201);
  return res.body;
}

async function backdateCheckIn(recordId, hoursAgo) {
  await prisma.attendanceRecord.update({ where: { id: recordId }, data: { checkIn: new Date(Date.now() - hoursAgo * 3600_000) } });
}

async function wipe(where) {
  await prisma.attendanceRecord.deleteMany({ where });
}

test("CHECK-IN: persists a real check-in time and is reflected by GET /today (survives a refresh)", async () => {
  const record = await freshCheckIn(tokenEmployee);
  assert.ok(record.checkIn);

  const today = await apiFetch(baseUrl, "/api/attendance/today", { token: tokenEmployee });
  assert.equal(today.status, 200);
  assert.equal(today.body.id, record.id);
  assert.ok(today.body.checkIn);

  await wipe({ id: record.id });
});

test("CHECK-IN: GET /today returns null before any check-in today", async () => {
  const freshEmployee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  const token = tokenForEmployee(freshEmployee);
  const today = await apiFetch(baseUrl, "/api/attendance/today", { token });
  assert.equal(today.status, 200);
  assert.equal(today.body, null);
});

test("CHECK-IN: duplicate check-in the same day returns the existing record, not an error", async () => {
  const first = await freshCheckIn(tokenEmployee);
  const second = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token: tokenEmployee });
  assert.equal(second.status, 200);
  assert.equal(second.body.id, first.id);
  assert.equal(second.body.checkIn, first.checkIn);

  await wipe({ id: first.id });
});

test("CHECK-OUT: rejected before 8 hours have elapsed since check-in", async () => {
  const record = await freshCheckIn(tokenEmployee);
  const checkOut = await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token: tokenEmployee });
  assert.equal(checkOut.status, 400);
  assert.match(checkOut.body.error, /8 hours/i);

  await wipe({ id: record.id });
});

test("CHECK-OUT: succeeds once 8 hours have elapsed, and is idempotent on a second call", async () => {
  const record = await freshCheckIn(tokenEmployee);
  await backdateCheckIn(record.id, 8.5);

  const checkOut = await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token: tokenEmployee });
  assert.equal(checkOut.status, 200);
  assert.ok(checkOut.body.checkOut);

  const second = await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token: tokenEmployee });
  assert.equal(second.status, 200);
  assert.equal(second.body.checkOut, checkOut.body.checkOut);

  await wipe({ id: record.id });
});

test("CHECK-OUT: rejected entirely without a check-in first", async () => {
  const freshEmployee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  const token = tokenForEmployee(freshEmployee);
  const res = await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token });
  assert.equal(res.status, 400);
});

test("BREAK: rejected before 4 hours have elapsed since check-in", async () => {
  const record = await freshCheckIn(tokenEmployee);
  const brk = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenEmployee });
  assert.equal(brk.status, 400);
  assert.match(brk.body.error, /4 hours/i);

  await wipe({ id: record.id });
});

test("BREAK: available and startable once 4 hours have elapsed; end-break records a real breakEnd", async () => {
  const record = await freshCheckIn(tokenEmployee);
  await backdateCheckIn(record.id, 4.5);

  const start = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenEmployee });
  assert.equal(start.status, 200);
  assert.ok(start.body.breakStart);
  assert.equal(start.body.breakEnd, null);

  const end = await apiFetch(baseUrl, "/api/attendance/break-end", { method: "POST", token: tokenEmployee });
  assert.equal(end.status, 200);
  assert.ok(end.body.breakEnd);

  await wipe({ id: record.id });
});

test("BREAK: starting twice is idempotent (returns the same in-progress break, not an error)", async () => {
  const record = await freshCheckIn(tokenEmployee);
  await backdateCheckIn(record.id, 5);

  const first = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenEmployee });
  assert.equal(first.status, 200);
  const second = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenEmployee });
  assert.equal(second.status, 200);
  assert.equal(second.body.breakStart, first.body.breakStart);

  await wipe({ id: record.id });
});

test("BREAK: a second break the same day is rejected once the first is completed", async () => {
  const record = await freshCheckIn(tokenEmployee);
  await backdateCheckIn(record.id, 5);
  await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenEmployee });
  await apiFetch(baseUrl, "/api/attendance/break-end", { method: "POST", token: tokenEmployee });

  const again = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenEmployee });
  assert.equal(again.status, 400);

  await wipe({ id: record.id });
});

test("BREAK: cannot end a break that was never started", async () => {
  const record = await freshCheckIn(tokenEmployee);
  await backdateCheckIn(record.id, 5);
  const end = await apiFetch(baseUrl, "/api/attendance/break-end", { method: "POST", token: tokenEmployee });
  assert.equal(end.status, 400);

  await wipe({ id: record.id });
});

test("ROLE RULES: Supervisor gets the same check-in -> break(4h) -> check-out(8h) flow as an Employee", async () => {
  const record = await freshCheckIn(tokenSupervisor);
  assert.equal(record.staffUserId, supervisor.id);
  await backdateCheckIn(record.id, 4.5);

  const brk = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenSupervisor });
  assert.equal(brk.status, 200);

  await backdateCheckIn(record.id, 8.5);
  const checkOut = await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token: tokenSupervisor });
  assert.equal(checkOut.status, 200);

  await wipe({ id: record.id });
});

test("ROLE RULES: Overlooking Supervisor gets the same check-in -> break(4h) -> check-out(8h) flow", async () => {
  const record = await freshCheckIn(tokenOverlooking);
  assert.equal(record.staffUserId, overlooking.id);
  await backdateCheckIn(record.id, 4.5);

  const brk = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenOverlooking });
  assert.equal(brk.status, 200);

  await wipe({ id: record.id });
});

test("ROLE RULES: Cashier (an Employee role) gets the same check-in -> break(4h) -> check-out(8h) flow", async () => {
  const record = await freshCheckIn(tokenCashier);
  await backdateCheckIn(record.id, 4.5);
  const brk = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenCashier });
  assert.equal(brk.status, 200);

  await wipe({ id: record.id });
});

test("ROLE RULES: Regional Manager has no break requirement — break-start is rejected outright, even 4h+ after check-in", async () => {
  const record = await freshCheckIn(tokenRm);
  assert.equal(record.staffUserId, rm.id);
  assert.equal(record.marketId, null);
  await backdateCheckIn(record.id, 5);

  const brk = await apiFetch(baseUrl, "/api/attendance/break-start", { method: "POST", token: tokenRm });
  assert.equal(brk.status, 403);

  await backdateCheckIn(record.id, 8.5);
  const checkOut = await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token: tokenRm });
  assert.equal(checkOut.status, 200);

  await wipe({ id: record.id });
});
