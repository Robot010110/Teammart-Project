// adjustmentRetentionSweep.test.js — Repair Pass follow-up: 30 days
// after their date, RequiredHoursAdjustment audit rows are deleted and
// AttendanceRecord.punishmentHours/punishmentReason are cleared, via the
// same background-interval sweep mechanism already running the break-
// completion and photo-expiry sweeps (maintenanceScheduler.js). Tested
// by calling the sweep function directly with fixture rows backdated via
// Prisma (never actually waiting 30 days), same convention already used
// for the 4h/8h attendance timing tests.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import { runAdjustmentRetentionSweep } from "../../src/jobs/maintenanceScheduler.js";
import { makeZone, makeStaffUser, makeMarket, makeEmployee, cleanup } from "../helpers.js";

let zone, market, supervisor, employee;

before(async () => {
  zone = await makeZone(94601);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
});

after(async () => {
  await cleanup();
});

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

test("ADJUSTMENT RETENTION: a RequiredHoursAdjustment older than 30 days is deleted", async () => {
  const adjustment = await prisma.requiredHoursAdjustment.create({
    data: {
      employeeId: employee.id, date: daysAgo(40), previousRequiredHours: 8, newRequiredHours: 6,
      reason: "Old reason", adjustedById: supervisor.id,
    },
  });

  await runAdjustmentRetentionSweep();

  const stillThere = await prisma.requiredHoursAdjustment.findUnique({ where: { id: adjustment.id } });
  assert.equal(stillThere, null);
});

test("ADJUSTMENT RETENTION: a RequiredHoursAdjustment within 30 days is kept", async () => {
  const adjustment = await prisma.requiredHoursAdjustment.create({
    data: {
      employeeId: employee.id, date: daysAgo(10), previousRequiredHours: 8, newRequiredHours: 6,
      reason: "Recent reason", adjustedById: supervisor.id,
    },
  });

  await runAdjustmentRetentionSweep();

  const stillThere = await prisma.requiredHoursAdjustment.findUnique({ where: { id: adjustment.id } });
  assert.ok(stillThere, "an adjustment within the retention window must not be deleted");

  await prisma.requiredHoursAdjustment.delete({ where: { id: adjustment.id } });
});

test("ADJUSTMENT RETENTION: deleting an old adjustment's audit row never reverts the AttendanceRecord's already-applied requiredHours", async () => {
  const date = daysAgo(40);
  const record = await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date, requiredHours: 6, source: "MANUAL" },
  });
  const adjustment = await prisma.requiredHoursAdjustment.create({
    data: { employeeId: employee.id, date, previousRequiredHours: 8, newRequiredHours: 6, reason: "Applied", adjustedById: supervisor.id },
  });

  await runAdjustmentRetentionSweep();

  const adjustmentGone = await prisma.requiredHoursAdjustment.findUnique({ where: { id: adjustment.id } });
  assert.equal(adjustmentGone, null);

  const recordStill = await prisma.attendanceRecord.findUnique({ where: { id: record.id } });
  assert.equal(recordStill.requiredHours, 6, "the already-applied requiredHours value must survive deleting the audit row");

  await prisma.attendanceRecord.delete({ where: { id: record.id } });
});

test("ADJUSTMENT RETENTION: a penalty (punishmentHours/Reason) older than 30 days is cleared on the AttendanceRecord", async () => {
  const record = await prisma.attendanceRecord.create({
    data: {
      employeeId: employee.id, date: daysAgo(45), source: "MANUAL",
      punishmentHours: 2.5, punishmentReason: "Late arrival",
    },
  });

  await runAdjustmentRetentionSweep();

  const updated = await prisma.attendanceRecord.findUnique({ where: { id: record.id } });
  assert.equal(updated.punishmentHours, 0);
  assert.equal(updated.punishmentReason, null);

  await prisma.attendanceRecord.delete({ where: { id: record.id } });
});

test("ADJUSTMENT RETENTION: a penalty within 30 days is left untouched", async () => {
  const record = await prisma.attendanceRecord.create({
    data: {
      employeeId: employee.id, date: daysAgo(5), source: "MANUAL",
      punishmentHours: 1, punishmentReason: "Recent",
    },
  });

  await runAdjustmentRetentionSweep();

  const stillThere = await prisma.attendanceRecord.findUnique({ where: { id: record.id } });
  assert.equal(stillThere.punishmentHours, 1);
  assert.equal(stillThere.punishmentReason, "Recent");

  await prisma.attendanceRecord.delete({ where: { id: record.id } });
});

test("ADJUSTMENT RETENTION: is idempotent — calling it twice in a row is safe", async () => {
  const first = await runAdjustmentRetentionSweep();
  const second = await runAdjustmentRetentionSweep();
  assert.equal(typeof first.adjustmentsDeleted, "number");
  assert.equal(typeof second.adjustmentsDeleted, "number");
});
