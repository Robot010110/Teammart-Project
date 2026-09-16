// shiftTiming.test.js — Attendance + Shift Timing: the official shift
// clock (Morning 08:00-16:00, Afternoon 16:00-00:00, Night 00:00-08:00),
// lateness/extra-time/penalty-recovery classification, self-service
// break auto-expiration + reminder notifications, and the security rules
// around all of it. Pure shift-math is unit-tested directly against
// shiftSchedule.js (fast, exact-minute assertions, no DB); everything
// else is tested the same way the rest of this suite already does —
// real HTTP calls / real sweep-function calls against fixture rows
// backdated via Prisma (never waiting real hours), matching
// attendanceRepairPass.test.js's and adjustmentRetentionSweep.test.js's
// own established conventions.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import { getShiftWindow, classifyAttendanceTiming, resolveEmployeeShift } from "../../src/utils/shiftSchedule.js";
import { runSelfServiceBreakReminderSweep } from "../../src/controllers/attendanceController.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, supervisor;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(95001);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

async function employeeWithShift(shift, extra = {}) {
  const employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  await prisma.employee.update({ where: { id: employee.id }, data: { shift, ...extra } });
  return prisma.employee.findUnique({ where: { id: employee.id } });
}

function dayOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// =========================================================================
// SHIFT — pure clock-math, unit-tested directly (no DB/HTTP needed).
// =========================================================================

test("SHIFT: Morning window is 08:00 -> 16:00 the same calendar day", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const { start, end } = getShiftWindow("MORNING", day);
  assert.equal(start.getHours(), 8);
  assert.equal(start.getDate(), day.getDate());
  assert.equal(end.getHours(), 16);
  assert.equal(end.getDate(), day.getDate());
});

test("SHIFT: Night window is 00:00 -> 08:00 the same calendar day", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const { start, end } = getShiftWindow("NIGHT", day);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getDate(), day.getDate());
  assert.equal(end.getHours(), 8);
  assert.equal(end.getDate(), day.getDate());
});

test("SHIFT: Afternoon window is 16:00 -> 00:00 the NEXT calendar day (midnight crossing)", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const { start, end } = getShiftWindow("AFTERNOON", day);
  assert.equal(start.getHours(), 16);
  assert.equal(start.getDate(), day.getDate());
  // The real fix under test: end must be the NEXT day at hour 0, never
  // "hour 0 of the same day" (which would put end before start).
  assert.equal(end.getHours(), 0);
  assert.equal(end.getDate(), day.getDate() + 1);
  assert.ok(end.getTime() > start.getTime());
});

test("SHIFT: checking in exactly at shift start is on time (zero late, zero early)", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const checkIn = new Date(day);
  checkIn.setHours(8, 0, 0, 0);
  const timing = classifyAttendanceTiming({ date: day, checkIn, checkOut: null, breakStart: null, breakEnd: null, punishmentHours: 0 }, "MORNING");
  assert.equal(timing.lateMinutes, 0);
  assert.equal(timing.earlyWorkHours, 0);
});

test("SHIFT: early check-in (07:00 for an 08:00 shift) is 1 hour of early work, not lateness", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const checkIn = new Date(day);
  checkIn.setHours(7, 0, 0, 0);
  const timing = classifyAttendanceTiming({ date: day, checkIn, checkOut: null, breakStart: null, breakEnd: null, punishmentHours: 0 }, "MORNING");
  assert.equal(timing.lateMinutes, 0);
  assert.equal(timing.earlyWorkHours, 1);
});

test("SHIFT: late by exactly 10 minutes", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const checkIn = new Date(day);
  checkIn.setHours(8, 10, 0, 0);
  const timing = classifyAttendanceTiming({ date: day, checkIn, checkOut: null, breakStart: null, breakEnd: null, punishmentHours: 0 }, "MORNING");
  assert.equal(timing.lateMinutes, 10);
  assert.equal(timing.earlyWorkHours, 0);
});

test("SHIFT: late by exactly 1 hour", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const checkIn = new Date(day);
  checkIn.setHours(9, 0, 0, 0);
  const timing = classifyAttendanceTiming({ date: day, checkIn, checkOut: null, breakStart: null, breakEnd: null, punishmentHours: 0 }, "MORNING");
  assert.equal(timing.lateMinutes, 60);
});

test("SHIFT: a Night-shift employee checking in exactly at 00:00 is on time", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const checkIn = new Date(day); // 00:00 of the same record date
  const timing = classifyAttendanceTiming({ date: day, checkIn, checkOut: null, breakStart: null, breakEnd: null, punishmentHours: 0 }, "NIGHT");
  assert.equal(timing.lateMinutes, 0);
  assert.equal(timing.earlyWorkHours, 0);
});

test("SHIFT: post-shift work across an Afternoon shift's midnight crossing is measured correctly", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const checkIn = new Date(day);
  checkIn.setHours(16, 0, 0, 0);
  const checkOut = new Date(day);
  checkOut.setDate(checkOut.getDate() + 1);
  checkOut.setHours(1, 0, 0, 0); // 1 hour past the 00:00 end
  const timing = classifyAttendanceTiming({ date: day, checkIn, checkOut, breakStart: null, breakEnd: null, punishmentHours: 0 }, "AFTERNOON");
  assert.equal(timing.postShiftHours, 1);
});

test("SHIFT: no assigned shift means timing fields stay null (unknown), never a fabricated 0", () => {
  const day = dayOnly(new Date(2026, 5, 15));
  const checkIn = new Date(day);
  checkIn.setHours(9, 0, 0, 0);
  const timing = classifyAttendanceTiming({ date: day, checkIn, checkOut: null, breakStart: null, breakEnd: null, punishmentHours: 0 }, null);
  assert.equal(timing.lateMinutes, null);
  assert.equal(timing.earlyWorkHours, null);
});

test("SHIFT: resolveEmployeeShift falls back from shift to cashierShift", () => {
  assert.equal(resolveEmployeeShift({ shift: "MORNING", cashierShift: "NIGHT" }), "MORNING");
  assert.equal(resolveEmployeeShift({ shift: null, cashierShift: "NIGHT" }), "NIGHT");
  assert.equal(resolveEmployeeShift({ shift: null, cashierShift: null }), null);
});

// =========================================================================
// EXTRA TIME / PENALTY RECOVERY — via the real GET /api/attendance/month
// endpoint, against fixture AttendanceRecord rows (real check-in/out
// times, real punishmentHours), same as attendanceRepairPass.test.js.
// =========================================================================

async function monthDayFor(token, date) {
  const res = await apiFetch(baseUrl, `/api/attendance/month?year=${date.getFullYear()}&month=${date.getMonth() + 1}`, { token });
  assert.equal(res.status, 200);
  return res.body.days.find((d) => new Date(d.date).getDate() === date.getDate());
}

test("EXTRA TIME: no penalty — working past requiredHours is Extra Hours (unchanged existing behavior)", async () => {
  const employee = await employeeWithShift("MORNING");
  const date = dayOnly(new Date());
  const checkIn = new Date(date); checkIn.setHours(8, 0, 0, 0);
  const checkOut = new Date(date); checkOut.setHours(18, 0, 0, 0); // 10h worked, 8h required, 0 penalty
  await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date, checkIn, checkOut, requiredHours: 8, punishmentHours: 0, status: "PRESENT" },
  });

  const day = await monthDayFor(tokenForEmployee(employee), date);
  assert.equal(day.extraHours, 2);
  assert.equal(day.timing.postShiftExtraHours, 2);
  assert.equal(day.timing.penaltyRecoveryHours, 0);
});

test("EXTRA TIME: penalty recovery consumes post-shift work and is NOT counted as Extra Hours (spec's own worked example)", async () => {
  const employee = await employeeWithShift("MORNING");
  const date = dayOnly(new Date());
  const checkIn = new Date(date); checkIn.setHours(8, 0, 0, 0);
  const checkOut = new Date(date); checkOut.setHours(18, 0, 0, 0); // 10h worked
  await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date, checkIn, checkOut, requiredHours: 8, punishmentHours: 2, status: "PRESENT" },
  });

  const day = await monthDayFor(tokenForEmployee(employee), date);
  assert.equal(day.extraHours, 0); // spec's exact expected result
  assert.equal(day.timing.penaltyRecoveryHours, 2);
  assert.equal(day.timing.postShiftExtraHours, 0);
});

test("EXTRA TIME: work beyond the penalty recovery boundary is genuinely additional Extra Hours", async () => {
  const employee = await employeeWithShift("MORNING");
  const date = dayOnly(new Date());
  const checkIn = new Date(date); checkIn.setHours(8, 0, 0, 0);
  const checkOut = new Date(date); checkOut.setHours(19, 0, 0, 0); // 11h worked, 2h penalty
  await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date, checkIn, checkOut, requiredHours: 8, punishmentHours: 2, status: "PRESENT" },
  });

  const day = await monthDayFor(tokenForEmployee(employee), date);
  // required(8) + penalty(2) = 10; worked 11 -> 1h genuinely extra.
  assert.equal(day.extraHours, 1);
  assert.equal(day.timing.penaltyRecoveryHours, 2);
  assert.equal(day.timing.postShiftExtraHours, 1);
});

test("EXTRA TIME: a real stored punishmentHours value (3h, not a hardcoded 2h) is used exactly", async () => {
  const employee = await employeeWithShift("MORNING");
  const date = dayOnly(new Date());
  const checkIn = new Date(date); checkIn.setHours(8, 0, 0, 0);
  const checkOut = new Date(date); checkOut.setHours(19, 0, 0, 0); // 11h worked, 3h penalty
  await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date, checkIn, checkOut, requiredHours: 8, punishmentHours: 3, status: "PRESENT" },
  });

  const day = await monthDayFor(tokenForEmployee(employee), date);
  assert.equal(day.extraHours, 0); // required(8)+penalty(3)=11, worked exactly 11
  assert.equal(day.timing.penaltyRecoveryHours, 3);
});

// =========================================================================
// CHECK-IN LATENESS — the live endpoint, real server clock, backdated
// checkIn via a direct Prisma write to simulate "checked in late" without
// waiting.
// =========================================================================

test("CHECK-IN: a live check-in with no assigned shift stays PRESENT (unchanged prior behavior)", async () => {
  const employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  const res = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token: tokenForEmployee(employee) });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, "PRESENT");
});

test("CHECK-IN: checking in late against the employee's own assigned shift sets status LATE", async () => {
  // Night shift starts at 00:00 — backdate "now" is always >= 00:00 of
  // today, so a Night-shift employee checking in right now is always
  // "late" relative to a 00:00 start, making this deterministic without
  // needing to wait for a specific wall-clock time.
  const employee = await employeeWithShift("NIGHT");
  const res = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token: tokenForEmployee(employee) });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, "LATE");
});

test("SECURITY: check-in ignores any client-supplied checkIn/status/lateness fields", async () => {
  const employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  const res = await apiFetch(baseUrl, "/api/attendance/check-in", {
    method: "POST",
    token: tokenForEmployee(employee),
    body: { checkIn: "2000-01-01T00:00:00Z", status: "PRESENT", lateMinutes: 0, punishmentHours: 999 },
  });
  assert.equal(res.status, 201);
  const returnedYear = new Date(res.body.checkIn).getFullYear();
  assert.notEqual(returnedYear, 2000);
  assert.equal(res.body.punishmentHours, 0);
});

// =========================================================================
// BREAK — self-service breakStart/breakEnd auto-expiration + reminders,
// tested by backdating breakStart and calling the sweep function
// directly (same convention as adjustmentRetentionSweep.test.js).
// =========================================================================

async function checkedInEmployeeOnBreak(minutesAgo, extra = {}) {
  const employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  const date = dayOnly(new Date());
  const breakStart = new Date(Date.now() - minutesAgo * 60000);
  const record = await prisma.attendanceRecord.create({
    data: {
      employeeId: employee.id, date, checkIn: new Date(Date.now() - (minutesAgo + 240) * 60000),
      breakStart, requiredHours: 8, ...extra,
    },
  });
  return { employee, record };
}

test("BREAK: halfway reminder fires once at 30 minutes elapsed", async () => {
  const { employee, record } = await checkedInEmployeeOnBreak(31);
  await runSelfServiceBreakReminderSweep();

  const notifications = await prisma.notification.findMany({ where: { employeeId: employee.id, type: "BREAK_HALFWAY_REMINDER" } });
  assert.equal(notifications.length, 1);

  const updated = await prisma.attendanceRecord.findUnique({ where: { id: record.id } });
  assert.ok(updated.breakHalfwayAlertedAt);

  // Running the sweep again must not send a second one.
  await runSelfServiceBreakReminderSweep();
  const again = await prisma.notification.findMany({ where: { employeeId: employee.id, type: "BREAK_HALFWAY_REMINDER" } });
  assert.equal(again.length, 1);
});

test("BREAK: ten-minute warning fires once at 50 minutes elapsed", async () => {
  const { employee } = await checkedInEmployeeOnBreak(51);
  await runSelfServiceBreakReminderSweep();
  const notifications = await prisma.notification.findMany({ where: { employeeId: employee.id, type: "BREAK_TEN_MINUTE_WARNING" } });
  assert.equal(notifications.length, 1);
});

test("BREAK: break-ended reminder fires once at 60 minutes elapsed, reusing BREAK_COMPLETED", async () => {
  const { employee } = await checkedInEmployeeOnBreak(61);
  await runSelfServiceBreakReminderSweep();
  const notifications = await prisma.notification.findMany({ where: { employeeId: employee.id, type: "BREAK_COMPLETED" } });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].body, "Your break is over. Please return to work.");
});

test("BREAK: one sweep pass at 61 minutes sends all three reminders exactly once each, never duplicated", async () => {
  const { employee } = await checkedInEmployeeOnBreak(61);
  await runSelfServiceBreakReminderSweep();
  await runSelfServiceBreakReminderSweep();
  await runSelfServiceBreakReminderSweep();

  const halfway = await prisma.notification.count({ where: { employeeId: employee.id, type: "BREAK_HALFWAY_REMINDER" } });
  const tenMin = await prisma.notification.count({ where: { employeeId: employee.id, type: "BREAK_TEN_MINUTE_WARNING" } });
  const ended = await prisma.notification.count({ where: { employeeId: employee.id, type: "BREAK_COMPLETED" } });
  assert.equal(halfway, 1);
  assert.equal(tenMin, 1);
  assert.equal(ended, 1);
});

test("BREAK: an early return (breakEnd already set) prevents any further reminder", async () => {
  const { employee, record } = await checkedInEmployeeOnBreak(61);
  await prisma.attendanceRecord.update({ where: { id: record.id }, data: { breakEnd: new Date() } });
  await runSelfServiceBreakReminderSweep();

  const total = await prisma.notification.count({
    where: { employeeId: employee.id, type: { in: ["BREAK_HALFWAY_REMINDER", "BREAK_TEN_MINUTE_WARNING", "BREAK_COMPLETED"] } },
  });
  assert.equal(total, 0);
});

test("BREAK: a break more than a day old is never re-alerted (stale-state guard)", async () => {
  const employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  const date = dayOnly(new Date());
  date.setDate(date.getDate() - 5);
  await prisma.attendanceRecord.create({
    data: {
      employeeId: employee.id, date,
      checkIn: new Date(Date.now() - 6 * 24 * 3600_000),
      breakStart: new Date(Date.now() - 5 * 24 * 3600_000),
      requiredHours: 8,
    },
  });
  await runSelfServiceBreakReminderSweep();
  const total = await prisma.notification.count({
    where: { employeeId: employee.id, type: { in: ["BREAK_HALFWAY_REMINDER", "BREAK_TEN_MINUTE_WARNING", "BREAK_COMPLETED"] } },
  });
  assert.equal(total, 0);
});

test("BREAK: overrun beyond the 60-minute cap is a distinguishable fact, separate from normal break time", async () => {
  const employee = await employeeWithShift("MORNING");
  const date = dayOnly(new Date());
  const checkIn = new Date(date); checkIn.setHours(8, 0, 0, 0);
  const breakStart = new Date(date); breakStart.setHours(12, 0, 0, 0);
  const breakEnd = new Date(date); breakEnd.setHours(13, 30, 0, 0); // 90-minute break, 30 over
  await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date, checkIn, breakStart, breakEnd, requiredHours: 8 },
  });

  const day = await monthDayFor(tokenForEmployee(employee), date);
  assert.equal(day.timing.breakOverrunMinutes, 30);
});

// =========================================================================
// NOTIFICATIONS — localization.
// =========================================================================

test("NOTIFICATIONS: an English-preference employee gets the English break-ended copy", async () => {
  const { employee } = await checkedInEmployeeOnBreak(61, {});
  await prisma.employee.update({ where: { id: employee.id }, data: { language: "ENGLISH" } });
  await runSelfServiceBreakReminderSweep();
  const n = await prisma.notification.findFirst({ where: { employeeId: employee.id, type: "BREAK_COMPLETED" } });
  assert.equal(n.title, "Break Ended");
  assert.equal(n.body, "Your break is over. Please return to work.");
});

test("NOTIFICATIONS: a Kurdish-preference employee gets natural Kurdish break-ended copy, not English", async () => {
  const employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  await prisma.employee.update({ where: { id: employee.id }, data: { language: "KURDISH" } });
  const date = dayOnly(new Date());
  await prisma.attendanceRecord.create({
    data: {
      employeeId: employee.id, date,
      checkIn: new Date(Date.now() - 300 * 60000),
      breakStart: new Date(Date.now() - 61 * 60000),
      requiredHours: 8,
    },
  });
  await runSelfServiceBreakReminderSweep();
  const n = await prisma.notification.findFirst({ where: { employeeId: employee.id, type: "BREAK_COMPLETED" } });
  assert.equal(n.body, "کاتی پشووەکەت تەواو بوو. تکایە بگەڕێوە سەر کار.");
  assert.notEqual(n.body, "Your break is over. Please return to work.");
});

// =========================================================================
// SECURITY — authorization / fabrication resistance.
// =========================================================================

test("SECURITY: an employee cannot set their own or another employee's punishment hours", async () => {
  const employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  const res = await apiFetch(baseUrl, "/api/attendance/punishment-hours", {
    method: "POST",
    token: tokenForEmployee(employee),
    body: { employeeId: employee.id, date: new Date().toISOString(), hours: 0, reason: "self-set" },
  });
  assert.equal(res.status, 403);
});

test("SECURITY: a Supervisor from a different market cannot view this market's employee attendance month", async () => {
  const employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  const otherZone = await makeZone(95002);
  const otherSupervisor = await makeStaffUser({ role: "SUPERVISOR" });
  const otherMarket = await makeMarket({ zoneId: otherZone.id, supervisorId: otherSupervisor.id });

  const res = await apiFetch(baseUrl, `/api/attendance/employee/${employee.id}/month`, {
    token: tokenForStaff(otherSupervisor, { managedMarket: otherMarket }),
  });
  assert.equal(res.status, 403);
});

test("REGRESSION: a Supervisor with real market access can still view an employee's attendance month (existing behavior intact)", async () => {
  const employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  const res = await apiFetch(baseUrl, `/api/attendance/employee/${employee.id}/month`, {
    token: tokenForStaff(supervisor, { managedMarket: market }),
  });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.days));
});
