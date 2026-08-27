// attendanceManualDismiss.test.js — Repair Pass follow-up: an employee
// can dismiss their OWN already-old Required Hours Adjustment / Penalty
// from their own Attendance screen (not staff-set-but-fresh ones — that
// would let someone erase a just-applied penalty), and cancel their own
// still-PENDING Extra Hours request. Time is tested by backdating
// fixture rows via Prisma directly, same convention as the 4h/8h
// attendance timing tests.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, supervisor, employee, employeeB;
let tokenEmployee, tokenEmployeeB;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94801);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  employeeB = await makeEmployee({ marketId: market.id, role: "WORKER" });

  tokenEmployee = tokenForEmployee(employee);
  tokenEmployeeB = tokenForEmployee(employeeB);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// --- REQUIRED HOURS ADJUSTMENT ------------------------------------------

test("REQUIRED HOURS: an employee cannot dismiss a fresh (< 14 day old) adjustment", async () => {
  const adjustment = await prisma.requiredHoursAdjustment.create({
    data: { employeeId: employee.id, date: daysAgo(3), previousRequiredHours: 8, newRequiredHours: 10, reason: "late", adjustedById: supervisor.id },
  });
  const res = await apiFetch(baseUrl, `/api/attendance/required-hours-adjustments/${adjustment.id}`, { method: "DELETE", token: tokenEmployee });
  assert.equal(res.status, 400);

  const stillThere = await prisma.requiredHoursAdjustment.findUnique({ where: { id: adjustment.id } });
  assert.ok(stillThere);
});

test("REQUIRED HOURS: an employee CAN dismiss their own adjustment once it's 14+ days old, but never affects the applied requiredHours", async () => {
  const date = daysAgo(20);
  const record = await prisma.attendanceRecord.create({ data: { employeeId: employee.id, date, requiredHours: 10, source: "MANUAL" } });
  const adjustment = await prisma.requiredHoursAdjustment.create({
    data: { employeeId: employee.id, date, previousRequiredHours: 8, newRequiredHours: 10, reason: "late", adjustedById: supervisor.id },
  });

  const res = await apiFetch(baseUrl, `/api/attendance/required-hours-adjustments/${adjustment.id}`, { method: "DELETE", token: tokenEmployee });
  assert.equal(res.status, 204);

  const gone = await prisma.requiredHoursAdjustment.findUnique({ where: { id: adjustment.id } });
  assert.equal(gone, null);
  const recordStill = await prisma.attendanceRecord.findUnique({ where: { id: record.id } });
  assert.equal(recordStill.requiredHours, 10, "the already-applied requiredHours must survive dismissing the explanation");

  await prisma.attendanceRecord.delete({ where: { id: record.id } });
});

test("REQUIRED HOURS: an employee cannot dismiss another employee's adjustment", async () => {
  const adjustment = await prisma.requiredHoursAdjustment.create({
    data: { employeeId: employee.id, date: daysAgo(20), previousRequiredHours: 8, newRequiredHours: 10, reason: "late", adjustedById: supervisor.id },
  });
  const res = await apiFetch(baseUrl, `/api/attendance/required-hours-adjustments/${adjustment.id}`, { method: "DELETE", token: tokenEmployeeB });
  assert.equal(res.status, 404);

  await prisma.requiredHoursAdjustment.delete({ where: { id: adjustment.id } });
});

// --- PENALTY ---------------------------------------------------------

test("PENALTY: an employee cannot clear a fresh (< 14 day old) penalty", async () => {
  const record = await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date: daysAgo(2), source: "MANUAL", punishmentHours: 3, punishmentReason: "late" },
  });
  const res = await apiFetch(baseUrl, `/api/attendance/${record.id}/punishment`, { method: "DELETE", token: tokenEmployee });
  assert.equal(res.status, 400);

  const stillThere = await prisma.attendanceRecord.findUnique({ where: { id: record.id } });
  assert.equal(stillThere.punishmentHours, 3);

  await prisma.attendanceRecord.delete({ where: { id: record.id } });
});

test("PENALTY: an employee CAN clear their own penalty once it's 14+ days old", async () => {
  const record = await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date: daysAgo(20), source: "MANUAL", punishmentHours: 3, punishmentReason: "late" },
  });
  const res = await apiFetch(baseUrl, `/api/attendance/${record.id}/punishment`, { method: "DELETE", token: tokenEmployee });
  assert.equal(res.status, 204);

  const updated = await prisma.attendanceRecord.findUnique({ where: { id: record.id } });
  assert.equal(updated.punishmentHours, 0);
  assert.equal(updated.punishmentReason, null);

  await prisma.attendanceRecord.delete({ where: { id: record.id } });
});

test("PENALTY: an employee cannot clear another employee's penalty", async () => {
  const record = await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date: daysAgo(20), source: "MANUAL", punishmentHours: 3, punishmentReason: "late" },
  });
  const res = await apiFetch(baseUrl, `/api/attendance/${record.id}/punishment`, { method: "DELETE", token: tokenEmployeeB });
  assert.equal(res.status, 404);

  await prisma.attendanceRecord.delete({ where: { id: record.id } });
});

// --- EXTRA HOURS -------------------------------------------------------

test("EXTRA HOURS: an employee can cancel their own still-PENDING request", async () => {
  const req1 = await apiFetch(baseUrl, "/api/attendance/extra-hours", {
    method: "POST", token: tokenEmployee, body: { date: new Date().toISOString().slice(0, 10), hours: 2, reason: "Covered a shift" },
  });
  assert.equal(req1.status, 201);

  const del = await apiFetch(baseUrl, `/api/attendance/extra-hours/${req1.body.id}`, { method: "DELETE", token: tokenEmployee });
  assert.equal(del.status, 204);

  const list = await apiFetch(baseUrl, "/api/attendance/extra-hours", { token: tokenEmployee });
  assert.ok(!list.body.some((r) => r.id === req1.body.id));
});

test("EXTRA HOURS: an employee cannot cancel another employee's request", async () => {
  const req1 = await apiFetch(baseUrl, "/api/attendance/extra-hours", {
    method: "POST", token: tokenEmployee, body: { date: new Date().toISOString().slice(0, 10), hours: 1, reason: "x" },
  });
  const res = await apiFetch(baseUrl, `/api/attendance/extra-hours/${req1.body.id}`, { method: "DELETE", token: tokenEmployeeB });
  assert.equal(res.status, 404);

  await prisma.attendanceAdjustmentRequest.delete({ where: { id: req1.body.id } });
});

test("EXTRA HOURS: an already-decided request can no longer be cancelled", async () => {
  const req1 = await apiFetch(baseUrl, "/api/attendance/extra-hours", {
    method: "POST", token: tokenEmployee, body: { date: new Date().toISOString().slice(0, 10), hours: 1, reason: "x" },
  });
  await prisma.attendanceAdjustmentRequest.update({ where: { id: req1.body.id }, data: { status: "APPROVED", reviewedById: supervisor.id, reviewedAt: new Date() } });

  const res = await apiFetch(baseUrl, `/api/attendance/extra-hours/${req1.body.id}`, { method: "DELETE", token: tokenEmployee });
  assert.equal(res.status, 400);

  await prisma.attendanceAdjustmentRequest.delete({ where: { id: req1.body.id } });
});
