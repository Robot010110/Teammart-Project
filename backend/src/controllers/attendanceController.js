import { prisma } from "../lib/prisma.js";
import { staffCanAccessMarket, requireAccessibleEmployee, assertMarketAccess } from "../middleware/auth.js";
import { parseAttendanceWorkbook, buildAttendanceReportWorkbook } from "../utils/attendanceExcel.js";
import { attendanceImportRowSchema } from "../utils/validate.js";
import { createNotification, createNotificationForUser } from "../utils/notifications.js";
import { buildBreakAttendanceExportRows } from "../services/excelExportAdapter.js";

// attendanceController.js — check-in/out, breaks, shift, day-off, and
// required-hours tracking. Populated by importAttendanceRecords (a real
// .xlsx upload parsed server-side — see utils/attendanceExcel.js) rather
// than a live fingerprint-device feed, which isn't reachable from this
// app. The employee-facing month view only ever reflects real imported/
// adjusted rows — zero/empty when nothing exists yet, never a hardcoded
// number.

function dayOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Which kind of caller is allowed to use the cross-role check-in/check-
// out endpoints below, and what "owns" the resulting AttendanceRecord —
// Employee/Cashier (any Employee role) or Supervisor/Overlooking
// (staff). Regional Manager/Admin/Zone Manager are deliberately
// excluded (spec: "Zone Manager is NOT included in this attendance
// requirement" — neither has a market to check in at).
function attendanceOwnerFromUser(user) {
  if (user.kind === "employee") return { employeeId: user.employeeId, marketId: user.marketId };
  if (user.kind === "staff" && (user.role === "SUPERVISOR" || user.role === "OVERLOOKING_SUPERVISOR")) {
    return { staffUserId: user.userId, marketId: user.marketId };
  }
  // Cleanup Phase §5 — Regional/Zone Manager gets Check-in -> Check-out
  // (no Break; that's enforced by the frontend simply never offering one
  // for this role — see AttendanceCheckInCard's showBreak prop). A
  // Regional Manager isn't assigned to one single market the way a
  // Supervisor is (they manage a whole zone, possibly several markets),
  // so marketId genuinely has no single correct value here — the schema
  // already supports that (AttendanceRecord.marketId is nullable
  // specifically for staff-owned rows; see its own comment).
  if (user.kind === "staff" && user.role === "REGIONAL_MANAGER") {
    return { staffUserId: user.userId, marketId: null };
  }
  return null;
}

function attendanceOwnerWhere(owner, date) {
  return owner.employeeId
    ? { employeeId_date: { employeeId: owner.employeeId, date } }
    : { staffUserId_date: { staffUserId: owner.staffUserId, date } };
}

// Repair Pass §1 — the 4-hour break / 8-hour checkout gates, enforced
// here (server clock only) so a client can never bypass them by simply
// not disabling its own button. Kept as plain constants (not env-
// configurable) since the spec gives exact numbers, same as every other
// hardcoded business rule already in this file (e.g. requiredHours'
// default of 8).
const BREAK_AVAILABLE_AFTER_MS = 4 * 60 * 60 * 1000;
const CHECKOUT_AVAILABLE_AFTER_MS = 8 * 60 * 60 * 1000;

function minutesUntil(elapsedMs, thresholdMs) {
  return Math.ceil((thresholdMs - elapsedMs) / 60000);
}

// POST /api/attendance/check-in — Phase 1 cross-role live attendance:
// Employee/Cashier AND Supervisor/Overlooking, through the exact same
// AttendanceRecord table and per-day unique constraint every other
// attendance row already uses — not a parallel system (see
// attendanceOwnerFromUser above and AttendanceRecord.staffUserId's own
// schema comment). Tapping check-in again the same day before checking
// out just returns the existing open record rather than erroring — a
// duplicate tap from a flaky connection shouldn't be a hard failure.
export async function checkIn(req, res, next) {
  try {
    const owner = attendanceOwnerFromUser(req.user);
    if (!owner) return res.status(403).json({ error: "This account cannot check in/out" });
    // A Regional Manager legitimately has no marketId (see
    // attendanceOwnerFromUser's own comment) — only Employee/Supervisor/
    // Overlooking are required to have one.
    if (!owner.marketId && req.user.role !== "REGIONAL_MANAGER") {
      return res.status(400).json({ error: "Your account is not assigned to a market" });
    }

    const today = dayOnly(new Date());
    const where = attendanceOwnerWhere(owner, today);

    const existing = await prisma.attendanceRecord.findUnique({ where });
    if (existing?.checkIn && existing.checkOut) {
      return res.status(400).json({ error: "You have already checked out for today" });
    }
    if (existing?.checkIn) {
      return res.json(existing);
    }

    const record = await prisma.attendanceRecord.upsert({
      where,
      update: { checkIn: new Date(), status: "PRESENT" },
      create: {
        date: today,
        checkIn: new Date(),
        status: "PRESENT",
        source: "MANUAL",
        marketId: owner.marketId,
        employeeId: owner.employeeId ?? null,
        staffUserId: owner.staffUserId ?? null,
      },
    });

    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/check-out — counterpart to checkIn above.
// Idempotent the same way: calling it again after already checking out
// just returns the existing record.
export async function checkOut(req, res, next) {
  try {
    const owner = attendanceOwnerFromUser(req.user);
    if (!owner) return res.status(403).json({ error: "This account cannot check in/out" });

    const today = dayOnly(new Date());
    const where = attendanceOwnerWhere(owner, today);

    const existing = await prisma.attendanceRecord.findUnique({ where });
    if (!existing?.checkIn) {
      return res.status(400).json({ error: "You haven't checked in yet today" });
    }
    if (existing.checkOut) {
      return res.json(existing);
    }

    const elapsedMs = Date.now() - existing.checkIn.getTime();
    if (elapsedMs < CHECKOUT_AVAILABLE_AFTER_MS) {
      return res.status(400).json({
        error: `Check-out is available 8 hours after check-in (${minutesUntil(elapsedMs, CHECKOUT_AVAILABLE_AFTER_MS)} minute(s) left)`,
      });
    }

    const record = await prisma.attendanceRecord.update({ where, data: { checkOut: new Date() } });
    res.json(record);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/today — this account's own AttendanceRecord for
// today (or null if none yet). Repair Pass §1: previously there was no
// way for AttendanceCheckInCard to learn the real check-in state on
// mount, so a refresh/re-login always rendered "Not checked in yet"
// until the user tapped a button again, even though the real record was
// sitting in the database the whole time — this endpoint is the fix.
export async function getTodayAttendance(req, res, next) {
  try {
    const owner = attendanceOwnerFromUser(req.user);
    if (!owner) return res.status(403).json({ error: "This account cannot check in/out" });

    const today = dayOnly(new Date());
    const where = attendanceOwnerWhere(owner, today);
    const record = await prisma.attendanceRecord.findUnique({ where });
    res.json(record ?? null);
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/break-start — self-service break, available only
// 4 hours after a real check-in (Repair Pass §1). Deliberately separate
// from breaksController.js's fingerprint-triggered Break model: that
// system is created by an Admin/hardware event and runs a fixed 60-
// minute confirm/auto-complete cycle, which doesn't fit "the employee
// taps Break themselves, whenever they choose, after the 4-hour mark" —
// this instead writes directly to the same AttendanceRecord row check-
// in/out already use, via the same breakStart/breakEnd columns Excel
// import has always populated (see AttendanceRecord's schema comment),
// so working-hours computation (computeWorkingHours) already accounts
// for it with no further changes.
export async function startBreak(req, res, next) {
  try {
    const owner = attendanceOwnerFromUser(req.user);
    if (!owner) return res.status(403).json({ error: "This account cannot check in/out" });
    if (req.user.role === "REGIONAL_MANAGER") {
      return res.status(403).json({ error: "A Regional Manager account has no break requirement" });
    }

    const today = dayOnly(new Date());
    const where = attendanceOwnerWhere(owner, today);
    const existing = await prisma.attendanceRecord.findUnique({ where });

    if (!existing?.checkIn) return res.status(400).json({ error: "You haven't checked in yet today" });
    if (existing.checkOut) return res.status(400).json({ error: "You have already checked out for today" });
    if (existing.breakStart && !existing.breakEnd) return res.json(existing); // already on break — idempotent
    if (existing.breakStart && existing.breakEnd) {
      return res.status(400).json({ error: "You have already taken your break today" });
    }

    const elapsedMs = Date.now() - existing.checkIn.getTime();
    if (elapsedMs < BREAK_AVAILABLE_AFTER_MS) {
      return res.status(400).json({
        error: `Break is available 4 hours after check-in (${minutesUntil(elapsedMs, BREAK_AVAILABLE_AFTER_MS)} minute(s) left)`,
      });
    }

    const record = await prisma.attendanceRecord.update({ where, data: { breakStart: new Date() } });
    res.json(record);
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/break-end — ends the break started above.
export async function endBreak(req, res, next) {
  try {
    const owner = attendanceOwnerFromUser(req.user);
    if (!owner) return res.status(403).json({ error: "This account cannot check in/out" });

    const today = dayOnly(new Date());
    const where = attendanceOwnerWhere(owner, today);
    const existing = await prisma.attendanceRecord.findUnique({ where });

    if (!existing?.breakStart) return res.status(400).json({ error: "You haven't started a break today" });
    if (existing.breakEnd) return res.json(existing); // already ended — idempotent

    const record = await prisma.attendanceRecord.update({ where, data: { breakEnd: new Date() } });
    res.json(record);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/me/month?year=&month= — the caller's OWN
// attendance rows only (never accepts a target id, so a Supervisor can
// never reach another market's attendance just by editing a query
// param — see the Phase 1 spec's own warning about this). Employee/
// Cashier already has a richer version of this (getAttendanceMonth,
// with extra/required/punishment hours) — this one is for Supervisor/
// Overlooking, who this app's business rules never apply those
// Worker/Cashier-specific computations to, so it deliberately stays
// simpler rather than dragging staff into logic that doesn't apply to
// them.
export async function getMyStaffAttendanceMonth(req, res, next) {
  try {
    if (req.user.kind !== "staff" || !["SUPERVISOR", "OVERLOOKING_SUPERVISOR"].includes(req.user.role)) {
      return res.status(403).json({ error: "This account has no personal attendance to view" });
    }
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    const records = await prisma.attendanceRecord.findMany({
      where: { staffUserId: req.user.userId, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "asc" },
    });
    res.json({ records });
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/break-export-preview?marketId=&from=&to= —
// ADMIN-only. Lets the excelExportAdapter boundary (see that file's own
// comment) be verified end-to-end today, even with no real destination
// connected yet: returns the exact rows a future real export would send,
// as JSON, so the shaping logic can be tested/inspected now rather than
// only once a real destination exists.
export async function previewBreakExport(req, res, next) {
  try {
    const { marketId, from, to } = req.query;
    if (!marketId || !from || !to) {
      return res.status(400).json({ error: "marketId, from, and to are required" });
    }
    const rows = await buildBreakAttendanceExportRows({ marketId, from: new Date(from), to: new Date(to) });
    res.json({ rows });
  } catch (err) {
    next(err);
  }
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month is 1-12
}

// "August 20" — for human-readable notification text (spec §12's own
// example uses a month name, not an ISO date).
function formatDateLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
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

// POST /api/attendance/import — staff uploads the fingerprint system's
// Excel export (multer puts the file on req.file; see
// routes/attendance.routes.js). Each row is resolved and applied
// independently so one bad row (unknown employeeCode, malformed date)
// doesn't fail the whole batch — real attendance exports routinely have
// a handful of bad rows. Re-importing the same file is safe: rows upsert
// on [employeeId, date], and a date already covered by an APPROVED leave
// is skipped rather than silently overwritten (spec §11).
export async function importAttendanceRecords(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (expected field name 'file')" });
    }

    const { rows, errors: parseErrors } = await parseAttendanceWorkbook(req.file.buffer);
    if (parseErrors.length > 0) {
      return res.status(400).json({ error: parseErrors[0] });
    }
    if (rows.length === 0) {
      return res.status(400).json({ error: "No attendance rows found in the uploaded file" });
    }

    const employeeCodes = [...new Set(rows.map((r) => r.employeeCode))];
    const employees = await prisma.employee.findMany({ where: { employeeCode: { in: employeeCodes } } });
    const employeeByCode = new Map(employees.map((e) => [e.employeeCode, e]));

    const accessCache = new Map();
    async function canAccess(marketId) {
      if (!accessCache.has(marketId)) {
        accessCache.set(marketId, await staffCanAccessMarket(req.user, marketId));
      }
      return accessCache.get(marketId);
    }

    // Pre-fetch every APPROVED leave date per employee referenced in this
    // batch, so the per-row loop below can check in memory instead of a
    // query per row.
    const approvedLeaveByEmployee = new Map();
    if (employees.length > 0) {
      const approvedLeaves = await prisma.leaveRequest.findMany({
        where: { employeeId: { in: employees.map((e) => e.id) }, status: "APPROVED" },
        select: { employeeId: true, date: true },
      });
      for (const leave of approvedLeaves) {
        const list = approvedLeaveByEmployee.get(leave.employeeId) ?? [];
        list.push(leave.date);
        approvedLeaveByEmployee.set(leave.employeeId, list);
      }
    }

    const errors = [];
    let createdCount = 0;
    let updatedCount = 0;
    let unmatchedCount = 0;
    let rejectedCount = 0;
    let periodStart = null;
    let periodEnd = null;

    const settled = await Promise.allSettled(
      rows.map(async (rawRow) => {
        const parsed = attendanceImportRowSchema.safeParse(rawRow);
        if (!parsed.success) {
          return { ok: false, kind: "rejected", row: rawRow._sourceRow, employeeCode: rawRow.employeeCode, message: parsed.error.issues[0]?.message || "Invalid row" };
        }
        const { employeeCode, date, status, shift, checkIn, checkOut, breakStart, breakEnd, dayOffType } = parsed.data;

        const employee = employeeByCode.get(employeeCode);
        if (!employee) {
          return { ok: false, kind: "unmatched", row: rawRow._sourceRow, employeeCode, message: "No employee with this employeeCode" };
        }

        const allowed = await canAccess(employee.marketId);
        if (!allowed || allowed === "not-found") {
          return { ok: false, kind: "rejected", row: rawRow._sourceRow, employeeCode, message: "You do not have access to this employee" };
        }

        const protectedDates = approvedLeaveByEmployee.get(employee.id) ?? [];
        if (protectedDates.some((d) => sameDay(d, date))) {
          return { ok: false, kind: "skipped", row: rawRow._sourceRow, employeeCode, message: "Date has an approved leave — not overwritten" };
        }

        const existing = await prisma.attendanceRecord.findUnique({
          where: { employeeId_date: { employeeId: employee.id, date } },
        });

        const record = await prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: employee.id, date } },
          update: { status, shift, checkIn, checkOut, breakStart, breakEnd, dayOffType, source: "IMPORT", rawImportData: rawRow, importedById: req.user.userId },
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
            source: "IMPORT",
            rawImportData: rawRow,
            importedById: req.user.userId,
          },
        });

        return { ok: true, kind: existing ? "updated" : "created", id: record.id, employeeId: employee.id, date };
      })
    );

    const perRow = [];
    for (const result of settled) {
      const value = result.status === "fulfilled" ? result.value : { ok: false, kind: "rejected", message: result.reason?.message || "Could not import this row" };
      perRow.push(value);
      if (value.kind === "created") createdCount += 1;
      else if (value.kind === "updated") updatedCount += 1;
      else if (value.kind === "unmatched") unmatchedCount += 1;
      else if (value.kind === "skipped" || value.kind === "rejected") rejectedCount += 1;
      if (!value.ok) errors.push({ row: value.row, employeeCode: value.employeeCode, message: value.message });
      if (value.ok && value.date) {
        if (!periodStart || value.date < periodStart) periodStart = value.date;
        if (!periodEnd || value.date > periodEnd) periodEnd = value.date;
      }
    }

    // A batch record needs a market — use the single market every
    // successfully-matched row belongs to. If the file spans multiple
    // markets (a Regional Manager importing a whole zone at once), fall
    // back to the first row's employee's market for the batch metadata;
    // the individual AttendanceRecord rows are still correctly scoped
    // per-employee regardless.
    const firstMatchedEmployee = rows
      .map((r) => employeeByCode.get(r.employeeCode))
      .find((e) => e);

    const batch = await prisma.attendanceImportBatch.create({
      data: {
        fileName: req.file.originalname,
        periodStart: periodStart ?? new Date(),
        periodEnd: periodEnd ?? new Date(),
        totalRecords: rows.length,
        createdCount,
        updatedCount,
        unmatchedCount,
        rejectedCount,
        errors,
        marketId: firstMatchedEmployee?.marketId ?? req.user.marketId,
        uploadedById: req.user.userId,
      },
    });

    // Link every successfully-touched record to this batch (best-effort;
    // doesn't block the response if it fails).
    const touchedIds = perRow.filter((r) => r.ok && r.id).map((r) => r.id);
    if (touchedIds.length > 0) {
      await prisma.attendanceRecord.updateMany({
        where: { id: { in: touchedIds } },
        data: { importBatchId: batch.id },
      });
    }

    await prisma.attendanceAuditLog.create({
      data: {
        action: "ATTENDANCE_IMPORTED",
        performedById: req.user.userId,
        newValue: { batchId: batch.id, totalRecords: rows.length, createdCount, updatedCount, unmatchedCount, rejectedCount },
      },
    });

    // Extra Hours spec §9: check every employee this batch actually
    // touched for an unusually large accumulation of extra time. Never
    // blocks/fails the import response — a notification miss here
    // shouldn't undo an otherwise-successful import.
    const touchedEmployeeIds = [...new Set(perRow.filter((r) => r.ok && r.employeeId).map((r) => r.employeeId))];
    await Promise.allSettled(touchedEmployeeIds.map((id) => checkExcessiveExtraHours(id)));

    res.status(201).json({ batch, errors });
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/required-hours-adjustments — staff overrides an
// employee's required hours for one specific date (spec §8: default 8,
// max 16, reason required, previous+new both preserved). Always upserts
// the target AttendanceRecord's requiredHours in the same transaction so
// the record shows the CURRENT value; the adjustment table is the
// append-only history.
export async function createRequiredHoursAdjustment(req, res, next) {
  try {
    const { employeeId, date, newRequiredHours, reason } = req.body;

    await requireAccessibleEmployee(req.user, employeeId);

    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    const previousRequiredHours = existing?.requiredHours ?? 8;

    const [adjustment, record] = await prisma.$transaction([
      prisma.requiredHoursAdjustment.create({
        data: { employeeId, date, previousRequiredHours, newRequiredHours, reason, adjustedById: req.user.userId },
      }),
      prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: { requiredHours: newRequiredHours },
        create: { employeeId, date, requiredHours: newRequiredHours, source: "MANUAL" },
      }),
    ]);

    await prisma.attendanceAuditLog.create({
      data: {
        action: "REQUIRED_HOURS_ADJUSTED",
        employeeId,
        performedById: req.user.userId,
        previousValue: { requiredHours: previousRequiredHours },
        newValue: { requiredHours: newRequiredHours },
        reason,
      },
    });

    res.status(201).json({ adjustment, record });
  } catch (err) {
    next(err);
  }
}

// Extra hours worked on one day, beyond that day's requiredHours — never
// stored (same "derive, don't duplicate" convention as workingHours
// itself), so it can never drift out of sync with the underlying
// checkIn/checkOut/requiredHours values.
// A grace period, not a subtraction (Extra Hours spec §6): working more
// than 15 minutes past requiredHours credits the FULL overage as extra
// time; 15 minutes or less counts as zero. "Actual 9:00h vs required
// 8:00h -> Extra Hours: 1:00" (not 0:45) is the spec's own example.
const EXTRA_HOURS_GRACE = 0.25; // 15 minutes, in hours

function computeExtraHours(record) {
  const worked = computeWorkingHours(record);
  if (worked == null) return 0;
  const overage = worked - record.requiredHours;
  return overage > EXTRA_HOURS_GRACE ? overage : 0;
}

// Extra Hours spec §9 — "more than 5 hours of extra work within a short
// monitoring period" triggers a management-review alert, never an
// automatic penalty. The spec doesn't pin down an exact window, so a
// rolling 7-day lookback is used here as a reasonable interpretation of
// "short monitoring period" — long enough to catch a real pattern (not
// one unusually late night), short enough to still be "recent". Re-
// alerting is throttled the same way (skip if a EXCESSIVE_EXTRA_HOURS
// notification already went out for this employee in the last 7 days) so
// an ongoing pattern doesn't spam a new alert on every single import.
const EXCESSIVE_EXTRA_HOURS_THRESHOLD = 5;
const EXCESSIVE_EXTRA_HOURS_WINDOW_DAYS = 7;

async function checkExcessiveExtraHours(employeeId) {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - EXCESSIVE_EXTRA_HOURS_WINDOW_DAYS);

  const records = await prisma.attendanceRecord.findMany({ where: { employeeId, date: { gte: windowStart } } });
  const totalExtra = records.reduce((sum, r) => sum + computeExtraHours(r), 0);
  if (totalExtra <= EXCESSIVE_EXTRA_HOURS_THRESHOLD) return;

  const recentAlert = await prisma.notification.findFirst({
    where: { employeeId, type: "EXCESSIVE_EXTRA_HOURS", createdAt: { gte: windowStart } },
  });
  if (recentAlert) return;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { name: true, employeeCode: true, department: true, marketId: true },
  });
  if (!employee) return;
  const market = await prisma.market.findUnique({
    where: { id: employee.marketId },
    select: { name: true, zone: { select: { managerId: true } } },
  });
  if (!market?.zone?.managerId) return;

  const hours = Math.floor(totalExtra);
  const minutes = Math.round((totalExtra - hours) * 60);
  await createNotificationForUser({
    userId: market.zone.managerId,
    type: "EXCESSIVE_EXTRA_HOURS",
    title: "Extra Hours Alert",
    body:
      `Employee: ${employee.name}${employee.employeeCode ? ` (${employee.employeeCode})` : ""}\n` +
      `Market: ${market.name}\n` +
      `Department: ${employee.department ?? "Not assigned"}\n` +
      `Extra Hours Recorded: ${hours}h ${minutes}m\n\n` +
      "This employee has accumulated an unusually high amount of additional working time. Please review the attendance records and determine the reason.",
    linkType: "EMPLOYEE_ATTENDANCE",
    linkId: employeeId,
  });
}

// Shared by getAttendanceMonth (the month currently being viewed) and
// getPerformanceHistory (every completed month) so the Attendance Rate
// formula lives in exactly one place.
function computeMonthSummary(records, daysElapsed) {
  const daysOff = records.filter((r) => r.status === "DAY_OFF" || r.status === "APPROVED_LEAVE").length;
  const totalWorkingDays = Math.max(daysElapsed - daysOff, 0);
  const presentDays = records.filter((r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "EARLY_LEAVE").length;
  const totalHoursWorked = records.reduce((total, r) => total + (computeWorkingHours(r) ?? 0), 0);
  const totalRequiredHours = records.reduce((total, r) => total + r.requiredHours, 0);
  const extraHours = records.reduce((total, r) => total + computeExtraHours(r), 0);
  const punishmentHours = records.reduce((total, r) => total + (r.punishmentHours ?? 0), 0);
  const attendanceRate = totalWorkingDays > 0 ? Math.min((presentDays / totalWorkingDays) * 100, 100) : null;

  return { totalWorkingDays, daysOff, totalHoursWorked, totalRequiredHours, extraHours, punishmentHours, attendanceRate };
}

// The number of banked extra-work hours that fund one full day off (spec:
// "8 extra work hours = 1 full 8-hour day off").
export const EXTRA_HOURS_PER_DAY_OFF = 8;

// The employee's current extra-hours balance: every extra hour they've
// ever earned, minus every hour already spent on an APPROVED
// EARNED_DAY_OFF request. Computed fresh from AttendanceRecord +
// LeaveRequest every time rather than cached anywhere — there is no
// ledger table, same "never store what can be recomputed" convention as
// workingHours/attendanceRate. Called both by the read-only balance
// endpoint and, authoritatively, inside the day-off approval transaction.
export async function computeExtraHoursBalance(tx, employeeId) {
  const [records, spentRequests] = await Promise.all([
    tx.attendanceRecord.findMany({ where: { employeeId } }),
    tx.leaveRequest.findMany({
      where: { employeeId, type: "EARNED_DAY_OFF", status: "APPROVED" },
      select: { hoursSpent: true },
    }),
  ]);
  const earned = records.reduce((total, r) => total + computeExtraHours(r), 0);
  const spent = spentRequests.reduce((total, r) => total + (r.hoursSpent ?? 0), 0);
  return Math.max(earned - spent, 0);
}

// GET /api/attendance/extra-hours-balance — employee-only. Backs the
// "Request Day Off" screen's available-balance display.
export async function getExtraHoursBalance(req, res, next) {
  try {
    const balanceHours = await computeExtraHoursBalance(prisma, req.user.employeeId);
    res.json({ balanceHours, hoursRequiredPerDayOff: EXTRA_HOURS_PER_DAY_OFF });
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/punishment-hours — staff-only, sets (does not
// add to) a specific day's punishment hours. Mirrors
// createRequiredHoursAdjustment's shape (append-only audit trail +
// upserted current value) so punishment hours follow the exact same
// pattern this codebase already established for required-hours overrides.
// `reason` is stored directly on the AttendanceRecord (punishmentReason),
// not just in the audit log, so the employee-facing endpoint can return
// it — same as RequiredHoursAdjustment.reason for extra/reward hours.
export async function setPunishmentHours(req, res, next) {
  try {
    const { employeeId, date, hours, reason } = req.body;

    await requireAccessibleEmployee(req.user, employeeId);

    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    const previousPunishmentHours = existing?.punishmentHours ?? 0;

    const record = await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: { punishmentHours: hours, punishmentReason: reason },
      create: { employeeId, date, punishmentHours: hours, punishmentReason: reason, source: "MANUAL" },
    });

    await prisma.attendanceAuditLog.create({
      data: {
        action: "PUNISHMENT_HOURS_SET",
        employeeId,
        performedById: req.user.userId,
        previousValue: { punishmentHours: previousPunishmentHours },
        newValue: { punishmentHours: hours },
        reason,
      },
    });

    res.status(201).json({ record });
  } catch (err) {
    next(err);
  }
}

// An employee may dismiss their OWN Required Hours Adjustment / Penalty
// once it's old enough to no longer be "current" business — a fresh one
// (still within this window) stays staff-only to remove, so an employee
// can never erase a just-applied penalty/adjustment the moment it lands.
// This is a manual, earlier counterpart to
// maintenanceScheduler.runAdjustmentRetentionSweep's fully automatic
// 30-day cleanup — that sweep is the guarantee these never linger
// forever even if nobody dismisses them by hand; this just lets the
// employee clear an already-stale one sooner, from their own Attendance
// screen.
const MANUAL_CLEAR_AFTER_DAYS = 14;

function daysSince(date) {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}

// DELETE /api/attendance/required-hours-adjustments/:id — employee-only,
// their own adjustment, only once MANUAL_CLEAR_AFTER_DAYS has passed
// since the day it applies to. Deleting the audit row here never changes
// the AttendanceRecord.requiredHours value it already set (see
// createRequiredHoursAdjustment's own comment) — only removes the
// explanation from view, same as the automatic sweep.
export async function deleteMyRequiredHoursAdjustment(req, res, next) {
  try {
    const adjustment = await prisma.requiredHoursAdjustment.findUnique({ where: { id: req.params.id } });
    if (!adjustment || adjustment.employeeId !== req.user.employeeId) {
      return res.status(404).json({ error: "Adjustment not found" });
    }
    if (daysSince(adjustment.date) < MANUAL_CLEAR_AFTER_DAYS) {
      return res.status(400).json({
        error: `This can be dismissed ${MANUAL_CLEAR_AFTER_DAYS} days after its date — ${Math.ceil(MANUAL_CLEAR_AFTER_DAYS - daysSince(adjustment.date))} day(s) left`,
      });
    }
    await prisma.requiredHoursAdjustment.delete({ where: { id: adjustment.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// DELETE /api/attendance/:id/punishment — employee-only, their own
// AttendanceRecord, only once MANUAL_CLEAR_AFTER_DAYS has passed since
// its date. Clears punishmentHours/punishmentReason back to their
// defaults (0/null) — same effect the automatic 30-day sweep eventually
// has, just triggerable sooner by the employee once it's genuinely old.
export async function deleteMyPunishment(req, res, next) {
  try {
    const record = await prisma.attendanceRecord.findUnique({ where: { id: req.params.id } });
    if (!record || record.employeeId !== req.user.employeeId) {
      return res.status(404).json({ error: "Attendance record not found" });
    }
    if (!(record.punishmentHours > 0) && !record.punishmentReason) {
      return res.status(400).json({ error: "This record has no penalty to clear" });
    }
    if (daysSince(record.date) < MANUAL_CLEAR_AFTER_DAYS) {
      return res.status(400).json({
        error: `This can be dismissed ${MANUAL_CLEAR_AFTER_DAYS} days after its date — ${Math.ceil(MANUAL_CLEAR_AFTER_DAYS - daysSince(record.date))} day(s) left`,
      });
    }
    await prisma.attendanceRecord.update({ where: { id: record.id }, data: { punishmentHours: 0, punishmentReason: null } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Shared by the employee-facing getAttendanceMonth and the staff-facing
// getEmployeeAttendanceMonth (Supervisor Mode) — same shape, only the
// caller differs (req.user.employeeId vs. a :employeeId route param
// already ownership-checked by the caller).
async function buildMonthResponse(employeeId, year, month) {
  const now = new Date();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1); // exclusive upper bound

  const [records, adjustments] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employeeId, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.requiredHoursAdjustment.findMany({
      where: { employeeId, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "asc" },
    }),
  ]);

  const days = records.map((record) => ({
    ...record,
    workingHours: computeWorkingHours(record),
    extraHours: computeExtraHours(record),
    adjustments: adjustments.filter((a) => sameDay(a.date, record.date)),
  }));

  // Only count days elapsed so far when looking at the current month in
  // progress — otherwise the rest of this month would count as expected
  // working days with no data yet, unfairly tanking the rate.
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth(year, month);

  return { year, month, days, adjustments, summary: computeMonthSummary(records, daysElapsed) };
}

// Extra Hours spec §7 — "an employee checks in at 4:00 PM but there is
// no check-out recorded after their expected shift... flag the record
// and send a message: Check-out not detected. Are you still working?"
// There's no live fingerprint feed reaching this app (see this file's
// own top comment) so nothing can push a notification the instant a
// shift ends — this runs lazily whenever the employee's own attendance
// is loaded (getAttendanceMonth) instead, which is the closest honest
// approximation available. missingCheckoutAlertedAt guards against
// re-notifying on every subsequent page load for the same still-open day.
const MISSING_CHECKOUT_BUFFER_HOURS = 1; // grace beyond requiredHours before flagging

async function detectMissingCheckout(employeeId) {
  const now = new Date();
  const openRecords = await prisma.attendanceRecord.findMany({
    where: { employeeId, checkIn: { not: null }, checkOut: null, missingCheckoutAlertedAt: null },
  });

  for (const record of openRecords) {
    const elapsedHours = (now.getTime() - record.checkIn.getTime()) / (1000 * 60 * 60);
    if (elapsedHours <= record.requiredHours + MISSING_CHECKOUT_BUFFER_HOURS) continue;

    await prisma.attendanceRecord.update({ where: { id: record.id }, data: { missingCheckoutAlertedAt: now } });
    await createNotification({
      employeeId,
      type: "MISSING_CHECKOUT",
      title: "Check-out Not Detected",
      body: "Check-out not detected. Are you still working?",
      linkType: "ATTENDANCE_RECORD",
      linkId: record.id,
    });
  }
}

// POST /api/attendance/still-working — employee-only. Body: { recordId }.
// Answers the "Are you still working?" prompt with Yes — an
// acknowledgement/audit marker (spec §7), not itself a source of extra-
// hours data; a real checkOut (next import, or a manual correction) is
// still what the extra-hours calculation actually uses.
export async function confirmStillWorking(req, res, next) {
  try {
    const record = await prisma.attendanceRecord.findUnique({ where: { id: req.body.recordId } });
    if (!record || record.employeeId !== req.user.employeeId) {
      return res.status(404).json({ error: "Attendance record not found" });
    }
    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { stillWorkingConfirmedAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/month?year=&month= — the current employee's own
// attendance for one calendar month (defaults to the current month):
// each day's record merged with that day's required-hours adjustments,
// plus a computed monthly summary including the Attendance Rate.
export async function getAttendanceMonth(req, res, next) {
  try {
    const now = new Date();
    const year = req.query.year ?? now.getFullYear();
    const month = req.query.month ?? now.getMonth() + 1; // 1-12
    // Best-effort — an employee viewing their own attendance is the
    // natural, frequent moment to catch a missing checkout (spec §7);
    // never blocks/fails the page load if it errors.
    await detectMissingCheckout(req.user.employeeId).catch(() => {});
    res.json(await buildMonthResponse(req.user.employeeId, year, month));
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/employee/:employeeId/month?year=&month= —
// staff-only (Supervisor Mode's Employee Attendance screen). Same
// response shape as getAttendanceMonth above, just for an arbitrary
// employee the caller has market access to, instead of themselves.
export async function getEmployeeAttendanceMonth(req, res, next) {
  try {
    await requireAccessibleEmployee(req.user, req.params.employeeId);
    const now = new Date();
    const year = req.query.year ?? now.getFullYear();
    const month = req.query.month ?? now.getMonth() + 1;
    res.json(await buildMonthResponse(req.params.employeeId, year, month));
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/employee/:employeeId/extra-hours-balance —
// staff-only counterpart to getExtraHoursBalance, for Supervisor Mode's
// employee attendance screen.
export async function getEmployeeExtraHoursBalance(req, res, next) {
  try {
    await requireAccessibleEmployee(req.user, req.params.employeeId);
    const balanceHours = await computeExtraHoursBalance(prisma, req.params.employeeId);
    res.json({ balanceHours, hoursRequiredPerDayOff: EXTRA_HOURS_PER_DAY_OFF });
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/performance-history?months=6 — the current
// employee's Attendance Rate for each of the last N *completed* calendar
// months (default 6). The current in-progress month is always excluded —
// there is no real "performance" metric in this app beyond Attendance
// Rate (Employee.performanceRate is an unused field), and showing a
// partial current month as if it were final would misrepresent it.
export async function getPerformanceHistory(req, res, next) {
  try {
    const months = Math.min(Number(req.query.months) || 6, 24);
    const now = new Date();

    // Walk backward from last month (the most recent *completed* one).
    const monthRanges = [];
    for (let i = 1; i <= months; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthRanges.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const history = await Promise.all(
      monthRanges.map(async ({ year, month }) => {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 1);
        const records = await prisma.attendanceRecord.findMany({
          where: { employeeId: req.user.employeeId, date: { gte: monthStart, lt: monthEnd } },
        });
        return { year, month, summary: computeMonthSummary(records, daysInMonth(year, month)) };
      })
    );

    res.json(history);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/report/export?marketId=&year=&month= — staff-only,
// builds the 5-sheet monthly Excel report (spec §14/§15) for one market
// and streams it back as a file download. No frontend caller yet — same
// "backend-ready, UI pending Supervisor module" pattern as every other
// staff-only endpoint in this app.
export async function exportAttendanceReport(req, res, next) {
  try {
    const { marketId, year, month } = req.query;
    await assertMarketAccess(req.user, marketId);

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    const employees = await prisma.employee.findMany({ where: { marketId }, orderBy: { name: "asc" } });
    const employeeIds = employees.map((e) => e.id);
    const employeeById = new Map(employees.map((e) => [e.id, e]));

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1;
    const daysElapsed = isCurrentMonth ? new Date().getDate() : daysInMonth(year, month);

    const [records, approvedLeaves, adjustments] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { employeeId: { in: employeeIds }, date: { gte: monthStart, lt: monthEnd } },
        orderBy: [{ employeeId: "asc" }, { date: "asc" }],
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId: { in: employeeIds }, status: "APPROVED", date: { gte: monthStart, lt: monthEnd } },
        include: { reviewedBy: { select: { name: true } } },
        orderBy: [{ employeeId: "asc" }, { date: "asc" }],
      }),
      prisma.requiredHoursAdjustment.findMany({
        where: { employeeId: { in: employeeIds }, date: { gte: monthStart, lt: monthEnd } },
        include: { adjustedBy: { select: { name: true } } },
        orderBy: [{ employeeId: "asc" }, { date: "asc" }],
      }),
    ]);

    const recordsByEmployee = new Map();
    for (const record of records) {
      const list = recordsByEmployee.get(record.employeeId) ?? [];
      list.push(record);
      recordsByEmployee.set(record.employeeId, list);
    }

    const summaryRows = employees.map((employee) => {
      const empRecords = recordsByEmployee.get(employee.id) ?? [];
      const totalWorkedHours = empRecords.reduce((sum, r) => sum + (computeWorkingHours(r) ?? 0), 0);
      const totalRequiredHours = empRecords.reduce((sum, r) => sum + r.requiredHours, 0);
      const daysOff = empRecords.filter((r) => r.status === "DAY_OFF" || r.status === "APPROVED_LEAVE").length;
      const presentDays = empRecords.filter((r) => ["PRESENT", "LATE", "EARLY_LEAVE"].includes(r.status)).length;
      const workingDays = Math.max(daysElapsed - daysOff, 0);
      const attendanceRate = workingDays > 0 ? Math.min((presentDays / workingDays) * 100, 100) : 0;
      return [
        employee.name, employee.employeeCode, employee.role, employee.department ?? "",
        employee.cashierShift ?? employee.shift ?? "",
        Number(totalWorkedHours.toFixed(2)), totalRequiredHours, Number(attendanceRate.toFixed(1)),
      ];
    });

    const dailyRows = records.map((r) => {
      const employee = employeeById.get(r.employeeId);
      const breakMinutes = r.breakStart && r.breakEnd ? (r.breakEnd.getTime() - r.breakStart.getTime()) / 60000 : 0;
      return [
        employee.name, employee.employeeCode, r.date.toISOString().slice(0, 10),
        r.checkIn?.toISOString() ?? "", r.checkOut?.toISOString() ?? "",
        breakMinutes, computeWorkingHours(r) ?? "", r.requiredHours, r.status, r.shift ?? "", r.source,
      ];
    });

    const offDayRows = approvedLeaves.map((l) => {
      const employee = employeeById.get(l.employeeId);
      return [
        employee.name, employee.employeeCode, l.date.toISOString().slice(0, 10),
        l.type, l.reason ?? "", l.reviewedBy?.name ?? "", l.reviewedAt?.toISOString() ?? "",
      ];
    });

    const adjustmentRows = adjustments.map((a) => {
      const employee = employeeById.get(a.employeeId);
      return [
        employee.name, employee.employeeCode, a.date.toISOString().slice(0, 10),
        a.previousRequiredHours, a.newRequiredHours, a.reason, a.adjustedBy?.name ?? "", a.createdAt.toISOString(),
      ];
    });

    const exceptionRows = [];
    for (const r of records) {
      const employee = employeeById.get(r.employeeId);
      if (r.checkIn && !r.checkOut) exceptionRows.push([employee.name, employee.employeeCode, r.date.toISOString().slice(0, 10), "Missing check-out"]);
      else if (!r.checkIn && r.checkOut) exceptionRows.push([employee.name, employee.employeeCode, r.date.toISOString().slice(0, 10), "Missing check-in"]);
      else if (r.status === "INCOMPLETE") exceptionRows.push([employee.name, employee.employeeCode, r.date.toISOString().slice(0, 10), "Incomplete attendance"]);
      else if (r.status === "PENDING_REVIEW") exceptionRows.push([employee.name, employee.employeeCode, r.date.toISOString().slice(0, 10), "Pending review"]);
    }
    const batches = await prisma.attendanceImportBatch.findMany({
      where: { marketId, importedAt: { gte: monthStart, lt: monthEnd } },
    });
    for (const batch of batches) {
      for (const err of batch.errors ?? []) {
        exceptionRows.push(["", err.employeeCode ?? "", "", `${err.message} (row ${err.row})`]);
      }
    }

    const buffer = await buildAttendanceReportWorkbook({
      market: market?.name ?? marketId,
      year,
      month,
      generatedBy: req.user.kind === "staff" ? `User #${req.user.userId}` : "System",
      summaryRows,
      dailyRows,
      offDayRows,
      adjustmentRows,
      exceptionRows,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-report-${market?.name ?? marketId}-${year}-${month}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// AttendanceAdjustmentRequest (spec §10-14) — an employee-submitted claim
// of extra hours worked on a specific date, PENDING until their market's
// Supervisor reviews it. Deliberately a separate model from
// RequiredHoursAdjustment/punishmentHours (both staff-set and
// instant/authoritative) and NOT folded into computeExtraHours() or
// computeExtraHoursBalance() above — performance/extra-hours-balance
// wiring is a separate decision not yet made (spec §15), so an unapproved
// or rejected claim can never silently affect either calculation.
// ---------------------------------------------------------------------

// POST /api/attendance/extra-hours — employee submits a claim for one
// date. Always PENDING on creation; notifies their market's Supervisor
// the same way createWastedOverallReport does (market may have no
// Supervisor assigned yet — the request still exists, just un-notified).
export async function submitExtraHours(req, res, next) {
  try {
    const { date, hours, reason } = req.body;
    const employeeId = req.user.employeeId;

    const request = await prisma.attendanceAdjustmentRequest.create({
      data: { employeeId, date, hours, reason, type: "EXTRA_WORK" },
    });

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { name: true, marketId: true },
    });
    const market = await prisma.market.findUnique({
      where: { id: employee.marketId },
      select: { supervisorId: true },
    });
    if (market?.supervisorId) {
      await createNotificationForUser({
        userId: market.supervisorId,
        type: "EXTRA_HOURS_SUBMITTED",
        title: "Extra Hours Submitted",
        body: `${employee.name} reported ${hours} extra hour${hours === 1 ? "" : "s"} on ${formatDateLabel(date)}. Review submission.`,
        linkType: "ATTENDANCE_ADJUSTMENT",
        linkId: request.id,
      });
    }

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/attendance/extra-hours/:id — employee-only, their own
// request, only while it's still PENDING (once a Supervisor decides it,
// it's no longer this employee's to unilaterally remove — it moves to
// Performance History instead, same "decided items are final" rule
// already applied to Activities/Wasted Overall).
export async function deleteMyExtraHoursRequest(req, res, next) {
  try {
    const request = await prisma.attendanceAdjustmentRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.employeeId !== req.user.employeeId) {
      return res.status(404).json({ error: "Request not found" });
    }
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: "This request has already been reviewed and can no longer be cancelled" });
    }
    await prisma.attendanceAdjustmentRequest.delete({ where: { id: request.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/extra-hours — the current employee's own submitted
// requests, any status.
export async function listMyAttendanceAdjustmentRequests(req, res, next) {
  try {
    const requests = await prisma.attendanceAdjustmentRequest.findMany({
      where: { employeeId: req.user.employeeId },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/extra-hours/market?marketId=&status=&employeeId= —
// staff-only, same market-scoping pattern as
// listWastedOverallReportsForMarket (Supervisor: only their own market;
// Regional Manager: only markets in their zone; Admin: any).
export async function listAttendanceAdjustmentRequestsForMarket(req, res, next) {
  try {
    const { status, employeeId } = req.query;
    const marketId = req.query.marketId ?? req.user.marketId;
    if (!marketId) {
      return res.status(400).json({ error: "marketId is required" });
    }
    await assertMarketAccess(req.user, marketId);

    const where = { employee: { marketId } };
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;

    const requests = await prisma.attendanceAdjustmentRequest.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Extra Hours spec §8: "compare the employee's declaration against
    // the actual attendance records... the attendance record remains the
    // primary source of truth." Attaches what computeExtraHours() would
    // derive from that SAME date's real AttendanceRecord (if one
    // exists), purely for the reviewer to compare side by side — this
    // never overrides or feeds into the declaration itself.
    let recordByEmployeeAndDate = new Map();
    if (requests.length > 0) {
      const dates = requests.map((r) => r.date.getTime());
      // +/- 1 day of buffer: AttendanceAdjustmentRequest.date and
      // AttendanceRecord.date are normalized to "midnight" by two
      // different call sites (submitExtraHours vs. the Excel import),
      // which can land on a different UTC instant for the same real
      // calendar day depending on server timezone — matching is done by
      // the UTC calendar-date STRING below, this range is just a cheap
      // pre-filter and must not be tighter than a day on either side or
      // it can exclude the very row it's looking for.
      const DAY_MS = 24 * 60 * 60 * 1000;
      const records = await prisma.attendanceRecord.findMany({
        where: {
          employeeId: { in: [...new Set(requests.map((r) => r.employeeId))] },
          date: { gte: new Date(Math.min(...dates) - DAY_MS), lte: new Date(Math.max(...dates) + DAY_MS) },
        },
      });
      recordByEmployeeAndDate = new Map(records.map((r) => [`${r.employeeId}|${r.date.toISOString().slice(0, 10)}`, r]));
    }

    const shaped = requests.map((r) => {
      const key = `${r.employeeId}|${r.date.toISOString().slice(0, 10)}`;
      const record = recordByEmployeeAndDate.get(key);
      return { ...r, attendanceExtraHours: record ? computeExtraHours(record) : null, hasAttendanceRecord: !!record };
    });

    res.json(shaped);
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/extra-hours/:id/review — staff approve/reject a
// PENDING request. Scoped via the request's own employee's marketId
// (fetched fresh, never trusted from the request body), same pattern as
// reviewWastedOverallReport, so a Supervisor can't act outside their
// market by guessing an id — and an employee (who has no staff role at
// all) can never reach this route in the first place.
export async function reviewAttendanceAdjustmentRequest(req, res, next) {
  try {
    const { status, reviewNote } = req.body;
    const request = await prisma.attendanceAdjustmentRequest.findUnique({
      where: { id: req.params.id },
      include: { employee: { select: { marketId: true, name: true } } },
    });
    if (!request) return res.status(404).json({ error: "Request not found" });
    await assertMarketAccess(req.user, request.employee.marketId);

    if (request.status !== "PENDING") {
      return res.status(400).json({ error: `This request is already ${request.status.toLowerCase()}` });
    }

    const updated = await prisma.attendanceAdjustmentRequest.update({
      where: { id: request.id },
      data: { status, reviewNote, reviewedById: req.user.userId, reviewedAt: new Date() },
    });

    await createNotification({
      employeeId: request.employeeId,
      type: "SUBMISSION_REVIEWED",
      title: status === "APPROVED" ? "Extra Hours Approved" : "Extra Hours Rejected",
      body:
        status === "APPROVED"
          ? `Your ${request.hours} extra hour${request.hours === 1 ? "" : "s"} on ${formatDateLabel(request.date)} ${request.hours === 1 ? "was" : "were"} approved.`
          : `Your extra-hours submission was rejected${reviewNote ? `: ${reviewNote}` : "."}`,
      linkType: "ATTENDANCE_ADJUSTMENT",
      linkId: request.id,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/history?months=6 — the current employee's own
// combined Attendance/Work History (spec §13-14): every extra-hours
// submission (any status) plus every day with punishment hours applied,
// newest first. Each entry keeps its own real type/status rather than
// being flattened into one shape, so the frontend can render the
// Approved/Pending/Rejected/Punishment distinction the spec calls for —
// nothing here is hardcoded, every row comes straight from
// AttendanceAdjustmentRequest / AttendanceRecord.
export async function getAttendanceHistory(req, res, next) {
  try {
    const employeeId = req.user.employeeId;
    const months = Math.min(Number(req.query.months) || 6, 24);
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const [extraHoursRequests, punishedRecords] = await Promise.all([
      prisma.attendanceAdjustmentRequest.findMany({
        where: { employeeId, date: { gte: since } },
        orderBy: { date: "desc" },
      }),
      prisma.attendanceRecord.findMany({
        where: { employeeId, date: { gte: since }, punishmentHours: { gt: 0 } },
        orderBy: { date: "desc" },
      }),
    ]);

    const entries = [
      ...extraHoursRequests.map((r) => ({
        id: r.id,
        date: r.date,
        type: "EXTRA_WORK",
        hours: r.hours,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
      })),
      ...punishedRecords.map((r) => ({
        id: r.id,
        date: r.date,
        type: "PUNISHMENT",
        hours: r.punishmentHours,
        reason: r.punishmentReason,
        status: "APPLIED",
        createdAt: r.date,
        reviewedAt: null,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    res.json(entries);
  } catch (err) {
    next(err);
  }
}

// Derives a company-attendance row's live state purely from
// checkIn/checkOut/active-break presence — independent of the stored
// AttendanceStatus (which separately captures LATE/ABSENT/DAY_OFF/etc.
// and can co-occur with WORKING, e.g. a late arrival who's still
// clocked in). "MISSING" means no AttendanceRecord exists at all for
// that person on that date — never checked in — distinct from an
// explicit ABSENT record.
function deriveAttendanceState(record, onBreak) {
  if (!record) return "MISSING";
  if (onBreak) return "ON_BREAK";
  if (record.checkIn && !record.checkOut) return "WORKING";
  if (record.checkOut) return "CHECKED_OUT";
  return record.status; // ABSENT / DAY_OFF / APPROVED_LEAVE / PENDING_REVIEW
}

// GET /api/attendance/company — Admin Phase 1 §16: a company-wide
// attendance snapshot for one day (default today), across every market
// — no marketId required, unlike every other attendance endpoint in
// this file (all of which are single-employee or single-market,
// gated via assertMarketAccess/requireAccessibleEmployee). Reuses the
// exact same AttendanceRecord/Employee/Break tables — not a parallel
// attendance system — same "no extra scoping for ADMIN" pattern already
// established in zonesController/marketsController/employeesController.
// Regional Manager/Supervisor do NOT get this endpoint (route is
// ADMIN-only) — this is company-wide visibility, not a broadening of
// their existing zone/market-scoped access.
export async function listCompanyAttendance(req, res, next) {
  try {
    const { date, marketId, zoneId, role, shift, status, search } = req.query;
    const day = dayOnly(date ? new Date(date) : new Date());

    const includeEmployees = role !== "STAFF";
    const includeStaff = !role || role === "STAFF";

    let employeeWhere = {};
    if (marketId) employeeWhere.marketId = marketId;
    else if (zoneId) employeeWhere.market = { zoneId };
    if (role && role !== "STAFF") employeeWhere.role = role;
    if (shift) employeeWhere.OR = [{ cashierShift: shift }, { shift: shift }];
    if (search) {
      employeeWhere.AND = [
        ...(employeeWhere.AND ?? []),
        { OR: [{ name: { contains: search, mode: "insensitive" } }, { employeeCode: { contains: search, mode: "insensitive" } }] },
      ];
    }

    const [employees, staffUsers, records, activeBreaks] = await Promise.all([
      includeEmployees
        ? prisma.employee.findMany({
            where: employeeWhere,
            select: { id: true, name: true, role: true, employeeCode: true, marketId: true, market: { select: { name: true, zoneId: true } } },
            orderBy: { name: "asc" },
          })
        : [],
      includeStaff
        ? prisma.user.findMany({
            where: { role: { in: ["SUPERVISOR", "OVERLOOKING_SUPERVISOR"] } },
            select: {
              id: true, name: true, role: true,
              managedMarket: { select: { id: true, name: true, zoneId: true } },
              managedOverlookingMarket: { select: { id: true, name: true, zoneId: true } },
            },
          })
        : [],
      prisma.attendanceRecord.findMany({ where: { date: day } }),
      prisma.break.findMany({ where: { date: day, status: "ACTIVE" } }),
    ]);

    const recordByEmployeeId = new Map(records.filter((r) => r.employeeId).map((r) => [r.employeeId, r]));
    const recordByStaffId = new Map(records.filter((r) => r.staffUserId).map((r) => [r.staffUserId, r]));
    const onBreakEmployeeIds = new Set(activeBreaks.filter((b) => b.employeeId).map((b) => b.employeeId));
    const onBreakStaffIds = new Set(activeBreaks.filter((b) => b.staffUserId).map((b) => b.staffUserId));

    let rows = employees.map((e) => {
      const record = recordByEmployeeId.get(e.id) ?? null;
      return {
        kind: "employee",
        id: e.id,
        name: e.name,
        role: e.role,
        employeeCode: e.employeeCode,
        marketId: e.marketId,
        marketName: e.market?.name ?? null,
        zoneId: e.market?.zoneId ?? null,
        checkIn: record?.checkIn ?? null,
        checkOut: record?.checkOut ?? null,
        status: record?.status ?? null,
        state: deriveAttendanceState(record, onBreakEmployeeIds.has(e.id)),
      };
    });

    if (includeStaff) {
      const staffRows = staffUsers
        .map((u) => {
          const market = u.managedMarket ?? u.managedOverlookingMarket ?? null;
          if (marketId && market?.id !== marketId) return null;
          if (zoneId && market?.zoneId !== zoneId) return null;
          const record = recordByStaffId.get(u.id) ?? null;
          return {
            kind: "staff",
            id: u.id,
            name: u.name,
            role: u.role,
            employeeCode: null,
            marketId: market?.id ?? null,
            marketName: market?.name ?? null,
            zoneId: market?.zoneId ?? null,
            checkIn: record?.checkIn ?? null,
            checkOut: record?.checkOut ?? null,
            status: record?.status ?? null,
            state: deriveAttendanceState(record, onBreakStaffIds.has(u.id)),
          };
        })
        .filter(Boolean);
      rows = [...rows, ...staffRows];
    }

    if (status) {
      rows = rows.filter((r) => r.state === status || r.status === status);
    }

    res.json({
      date: day,
      summary: {
        total: rows.length,
        working: rows.filter((r) => r.state === "WORKING").length,
        onBreak: rows.filter((r) => r.state === "ON_BREAK").length,
        checkedOut: rows.filter((r) => r.state === "CHECKED_OUT").length,
        missing: rows.filter((r) => r.state === "MISSING").length,
        late: rows.filter((r) => r.status === "LATE").length,
      },
      rows,
    });
  } catch (err) {
    next(err);
  }
}
