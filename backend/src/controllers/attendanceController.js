import { prisma } from "../lib/prisma.js";
import { staffCanAccessMarket } from "../middleware/auth.js";

// attendanceController.js — worked hours, not a Task or Activity. This
// pass has no clock-in/out UI: a staff member logs an employee's daily
// hours (createAttendanceRecord) and can add +/- adjustments
// (createAttendanceAdjustment, e.g. "+1 hour, inventory recount" or
// "-1 hour, reward"). The employee-facing summary only ever reflects real
// rows in the DB — zero/"not set" when there's nothing yet, never a
// hardcoded number. A future clock-in/out feature would just start
// writing more AttendanceRecord rows; nothing here would need to change.

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function sumHours(records) {
  return records.reduce((total, r) => total + r.hoursWorked, 0);
}

function sumAdjustmentHours(adjustments) {
  return adjustments.reduce((total, a) => total + a.hours, 0);
}

// GET /api/attendance/summary — the current employee's own worked hours.
// TODO(pagination): pulls every AttendanceRecord/AttendanceAdjustment the
// employee has ever had and aggregates in JS. Fine at prototype scale
// (mirrors the same tradeoff already accepted in activityService.js);
// once employees realistically accumulate months of daily records this
// should move the week/month sums into the DB query instead.
export async function getAttendanceSummary(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.user.employeeId } });
    if (!employee) return res.status(404).json({ error: "Account not found" });

    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const [records, adjustments] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { employeeId: req.user.employeeId, date: { gte: monthStart } },
        orderBy: { date: "desc" },
      }),
      prisma.attendanceAdjustment.findMany({
        where: { employeeId: req.user.employeeId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const todayHours = sumHours(records.filter((r) => startOfDay(r.date).getTime() === todayStart.getTime()));
    const weekHours = sumHours(records.filter((r) => r.date >= weekStart));
    const monthRecordedHours = sumHours(records.filter((r) => r.date >= monthStart));
    const monthAdjustmentHours = sumAdjustmentHours(
      adjustments.filter((a) => a.createdAt >= monthStart)
    );
    const monthHours = monthRecordedHours + monthAdjustmentHours;

    const requiredMonthlyHours = employee.monthlyRequiredHours ?? null;
    const remainingHours = requiredMonthlyHours == null ? null : Math.max(requiredMonthlyHours - monthHours, 0);
    const overtimeHours = requiredMonthlyHours == null ? null : Math.max(monthHours - requiredMonthlyHours, 0);

    res.json({
      today: { hours: todayHours },
      week: { hours: weekHours },
      month: { hours: monthHours },
      requiredMonthlyHours,
      remainingHours,
      overtimeHours,
      adjustments,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/adjustments — the current employee's own adjustment
// history, newest first. A dedicated endpoint for a future view that
// doesn't need the rest of the summary payload.
export async function listAttendanceAdjustments(req, res, next) {
  try {
    const adjustments = await prisma.attendanceAdjustment.findMany({
      where: { employeeId: req.user.employeeId },
      orderBy: { createdAt: "desc" },
    });
    res.json(adjustments);
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/records — staff logs an employee's worked hours
// for a given day.
export async function createAttendanceRecord(req, res, next) {
  try {
    const { employeeId, date, hoursWorked } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return res.status(400).json({ error: "employeeId does not refer to an existing employee" });
    }

    const allowed = await staffCanAccessMarket(req.user, employee.marketId);
    if (!allowed || allowed === "not-found") {
      return res.status(403).json({ error: "You do not have access to this employee" });
    }

    const record = await prisma.attendanceRecord.create({
      data: { employeeId, date, hoursWorked, recordedById: req.user.userId },
    });

    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/adjustments — staff adds a +/- correction with a
// reason. Append-only: adjustments are never edited or deleted, so the
// history an employee sees always matches what a supervisor actually did.
export async function createAttendanceAdjustment(req, res, next) {
  try {
    const { employeeId, hours, reason } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return res.status(400).json({ error: "employeeId does not refer to an existing employee" });
    }

    const allowed = await staffCanAccessMarket(req.user, employee.marketId);
    if (!allowed || allowed === "not-found") {
      return res.status(403).json({ error: "You do not have access to this employee" });
    }

    const adjustment = await prisma.attendanceAdjustment.create({
      data: { employeeId, hours, reason, createdById: req.user.userId },
    });

    res.status(201).json(adjustment);
  } catch (err) {
    next(err);
  }
}
