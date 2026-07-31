import { prisma } from "../lib/prisma.js";
import { staffCanAccessMarket, requireAccessibleEmployee } from "../middleware/auth.js";

// attendanceController.js — check-in/out, breaks, shift, day-off, and
// reward/extra/penalty-hour tracking. No fingerprint device or Excel
// pipeline is reachable from this app, so records are populated by
// importAttendanceRecords (a staff-side bulk import — see
// importAttendanceRecordsSchema in validate.js) instead of a live device
// feed. The employee-facing summary only ever reflects real imported
// rows — zero/empty when nothing has been imported yet, never a
// hardcoded number.

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month is 1-12
}

// Working hours for one day, computed from checkIn/checkOut/break —
// never stored, so there's no redundant derived value to drift out of
// sync with the underlying times.
function computeWorkingHours(record) {
  if (!record.checkIn || !record.checkOut) return null;
  let ms = record.checkOut.getTime() - record.checkIn.getTime();
  if (record.breakStart && record.breakEnd) {
    ms -= record.breakEnd.getTime() - record.breakStart.getTime();
  }
  return Math.max(ms / (1000 * 60 * 60), 0);
}

// POST /api/attendance/import — staff bulk-imports attendance rows (the
// realistic substitute for a live fingerprint-device/Excel feed). Each
// row is resolved and applied independently so one bad row (unknown
// employeeCode, wrong market) doesn't fail the whole batch — real
// attendance exports routinely have a handful of bad rows.
//
// Performance: this used to do 2-3 sequential DB round trips PER ROW
// (employee lookup, market-access check, upsert) — up to ~6000 round
// trips for a full 2000-row import. Now: one findMany fetches every
// employee the batch could reference, market-access checks are cached
// per marketId (a real import file is almost always one market), and the
// remaining per-row upserts run concurrently via Promise.allSettled
// instead of one-at-a-time, so one row's Prisma error can't sink the
// batch either.
export async function importAttendanceRecords(req, res, next) {
  try {
    const { records } = req.body;

    const employeeCodes = [...new Set(records.map((r) => r.employeeCode))];
    const employees = await prisma.employee.findMany({ where: { employeeCode: { in: employeeCodes } } });
    const employeeByCode = new Map(employees.map((e) => [e.employeeCode, e]));

    const accessCache = new Map();
    async function canAccess(marketId) {
      if (!accessCache.has(marketId)) {
        accessCache.set(marketId, await staffCanAccessMarket(req.user, marketId));
      }
      return accessCache.get(marketId);
    }

    const settled = await Promise.allSettled(
      records.map(async (row) => {
        const { employeeCode, date, status, shift, checkIn, checkOut, breakStart, breakEnd, dayOffType } = row;

        const employee = employeeByCode.get(employeeCode);
        if (!employee) {
          return { employeeCode, date, ok: false, error: "No employee with this employeeCode" };
        }

        const allowed = await canAccess(employee.marketId);
        if (!allowed || allowed === "not-found") {
          return { employeeCode, date, ok: false, error: "You do not have access to this employee" };
        }

        const record = await prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: employee.id, date } },
          update: { status, shift, checkIn, checkOut, breakStart, breakEnd, dayOffType, importedById: req.user.userId },
          create: {
            employeeId: employee.id,
            date,
            status,
            shift,
            checkIn,
            checkOut,
            breakStart,
            breakEnd,
            dayOffType,
            importedById: req.user.userId,
          },
        });
        return { employeeCode, date, ok: true, id: record.id };
      })
    );

    const results = settled.map((r) =>
      r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message || "Could not import this row" }
    );

    res.status(201).json({ results });
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/adjustments — staff adds a reward/extra/penalty
// hour correction tied to a specific date, with a reason. Append-only:
// never edited or deleted, so the history an employee sees always
// matches what a supervisor actually did.
export async function createAttendanceAdjustment(req, res, next) {
  try {
    const { employeeId, type, hours, reason, date } = req.body;

    await requireAccessibleEmployee(req.user, employeeId);

    const adjustment = await prisma.attendanceAdjustment.create({
      data: { employeeId, type, hours, reason, date, createdById: req.user.userId },
    });

    res.status(201).json(adjustment);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/month?year=&month= — the current employee's own
// attendance for one calendar month (defaults to the current month):
// each day's record merged with that day's adjustments, plus a computed
// monthly summary including the Attendance Rate.
export async function getAttendanceMonth(req, res, next) {
  try {
    const now = new Date();
    const year = req.query.year ?? now.getFullYear();
    const month = req.query.month ?? now.getMonth() + 1; // 1-12

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1); // exclusive upper bound

    const [records, adjustments] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { employeeId: req.user.employeeId, date: { gte: monthStart, lt: monthEnd } },
        orderBy: { date: "asc" },
      }),
      prisma.attendanceAdjustment.findMany({
        where: { employeeId: req.user.employeeId, date: { gte: monthStart, lt: monthEnd } },
        orderBy: { date: "asc" },
      }),
    ]);

    const days = records.map((record) => ({
      ...record,
      workingHours: computeWorkingHours(record),
      adjustments: adjustments.filter((a) => sameDay(a.date, record.date)),
    }));

    // Only count days elapsed so far when looking at the current month in
    // progress — otherwise the rest of this month would count as expected
    // working days with no data yet, unfairly tanking the rate.
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth(year, month);

    const daysOff = records.filter((r) => r.status === "DAY_OFF").length;
    const totalWorkingDays = Math.max(daysElapsed - daysOff, 0);
    const presentDays = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
    const totalHoursWorked = days.reduce((total, d) => total + (d.workingHours ?? 0), 0);
    const rewardHours = adjustments.filter((a) => a.type === "REWARD").reduce((t, a) => t + a.hours, 0);
    const extraHours = adjustments
      .filter((a) => a.type === "EXTRA" || a.type === "PENALTY")
      .reduce((t, a) => t + a.hours, 0);
    const attendanceRate = totalWorkingDays > 0 ? Math.min((presentDays / totalWorkingDays) * 100, 100) : null;

    res.json({
      year,
      month,
      days,
      adjustments,
      summary: {
        totalWorkingDays,
        daysOff,
        totalHoursWorked,
        rewardHours,
        extraHours,
        attendanceRate,
      },
    });
  } catch (err) {
    next(err);
  }
}
