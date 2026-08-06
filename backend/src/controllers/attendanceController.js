import { prisma } from "../lib/prisma.js";
import { staffCanAccessMarket, requireAccessibleEmployee, assertMarketAccess } from "../middleware/auth.js";
import { parseAttendanceWorkbook, buildAttendanceReportWorkbook } from "../utils/attendanceExcel.js";
import { attendanceImportRowSchema } from "../utils/validate.js";

// attendanceController.js — check-in/out, breaks, shift, day-off, and
// required-hours tracking. Populated by importAttendanceRecords (a real
// .xlsx upload parsed server-side — see utils/attendanceExcel.js) rather
// than a live fingerprint-device feed, which isn't reachable from this
// app. The employee-facing month view only ever reflects real imported/
// adjusted rows — zero/empty when nothing exists yet, never a hardcoded
// number.

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

// GET /api/attendance/month?year=&month= — the current employee's own
// attendance for one calendar month (defaults to the current month):
// each day's record merged with that day's required-hours adjustments,
// plus a computed monthly summary including the Attendance Rate.
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
      prisma.requiredHoursAdjustment.findMany({
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

    const daysOff = records.filter((r) => r.status === "DAY_OFF" || r.status === "APPROVED_LEAVE").length;
    const totalWorkingDays = Math.max(daysElapsed - daysOff, 0);
    const presentDays = records.filter((r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "EARLY_LEAVE").length;
    const totalHoursWorked = days.reduce((total, d) => total + (d.workingHours ?? 0), 0);
    const totalRequiredHours = records.reduce((total, r) => total + r.requiredHours, 0);
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
        totalRequiredHours,
        attendanceRate,
      },
    });
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
