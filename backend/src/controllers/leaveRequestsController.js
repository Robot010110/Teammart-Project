import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, HttpError } from "../middleware/auth.js";
import { createNotification, createNotificationForUser } from "../utils/notifications.js";
import { computeExtraHoursBalance, EXTRA_HOURS_PER_DAY_OFF } from "./attendanceController.js";

// leaveRequestsController.js — Off Day / Personal Leave / Earned Day Off
// requests.
//
// Two genuinely different workflows share this one model:
//
//   PERSONAL_LEAVE / EARNED_DAY_OFF — unchanged from the original
//   design. The employee submits, the Supervisor approves or rejects
//   (reviewLeaveRequest below), and approving upserts the matching
//   AttendanceRecord (APPROVED_LEAVE / DAY_OFF) so the calendar never
//   shows a conflicting "Present" day for an approved leave.
//
//   WEEKLY_OFF / MONTHLY_OFF / EMERGENCY_OFF — the Attendance calendar
//   picker (tap a date -> Choose Off Type). These are created ALREADY
//   APPROVED — there is no review step, per the explicit design
//   decision that the employee does not wait for a Supervisor decision
//   on these three. Real backend-enforced quotas apply (see
//   CALENDAR_OFF_QUOTAS below); Monthly/Emergency send the Supervisor a
//   purely informational notification afterward (createOffDay), Weekly
//   deliberately does not.
//
// EARNED_DAY_OFF spends the employee's extra-hours balance (see
// computeExtraHoursBalance in attendanceController.js — there is no
// ledger table, the balance is always derived from AttendanceRecord vs.
// already-APPROVED EARNED_DAY_OFF requests). The balance is checked here
// too (early, friendly rejection) but the authoritative check happens at
// approval time inside a Serializable transaction (see reviewLeaveRequest
// below) — that's the only point that can actually prevent two pending
// requests from double-spending the same hours.

const CALENDAR_OFF_TYPES = ["WEEKLY_OFF", "MONTHLY_OFF", "EMERGENCY_OFF"];

// The Attendance calendar picker's three types map onto DayOffType 1:1.
// EARNED_DAY_OFF keeps using OTHER (unchanged) since it's a different
// kind of day off (funded by the extra-hours balance, not a scheduled
// weekly/monthly/emergency rest day).
const CALENDAR_DAY_OFF_TYPE = { WEEKLY_OFF: "WEEKLY", MONTHLY_OFF: "MONTHLY", EMERGENCY_OFF: "EMERGENCY" };

// All date arithmetic in this file is UTC-normalized on purpose.
// LeaveRequest.date and AttendanceRecord.date are date-only markers
// stored at UTC midnight (verified against live data) — mixing
// local-timezone getters with those values is exactly the bug that was
// found and fixed in the Attendance calendar grid (AttendanceMonthGrid.
// jsx's own comment). There is no per-employee timezone anywhere in this
// schema, so "today" is the server's own local calendar date, expressed
// in the same UTC-midnight representation everything else already uses
// — that's what makes a stored date directly comparable to it.
function utcMidnight(year, month, day) {
  return new Date(Date.UTC(year, month, day));
}
function toUtcMidnight(date) {
  return utcMidnight(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
function todayUtcMidnight() {
  const now = new Date();
  return utcMidnight(now.getFullYear(), now.getMonth(), now.getDate());
}
// Monday-start calendar week — same convention
// activitiesController.startOfWeek uses for the Performance trend,
// expressed in UTC terms here to match how this table's dates are
// actually stored.
function startOfWeekUtc(date) {
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() + diff);
  return start;
}
function startOfMonthUtc(date) {
  return utcMidnight(date.getUTCFullYear(), date.getUTCMonth(), 1);
}
function startOfNextMonthUtc(date) {
  return utcMidnight(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}
// "September 5" — human-readable notification text, same style as
// attendanceController's own formatDateLabel.
function formatDateLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

async function countWeeklyOff(tx, employeeId, dateUtc) {
  const weekStart = startOfWeekUtc(dateUtc);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return tx.leaveRequest.count({
    where: { employeeId, type: "WEEKLY_OFF", status: "APPROVED", date: { gte: weekStart, lt: weekEnd } },
  });
}
async function countMonthlyOff(tx, employeeId, dateUtc) {
  return tx.leaveRequest.count({
    where: {
      employeeId,
      type: "MONTHLY_OFF",
      status: "APPROVED",
      date: { gte: startOfMonthUtc(dateUtc), lt: startOfNextMonthUtc(dateUtc) },
    },
  });
}

const WEEKLY_OFF_LIMIT = 1;
const MONTHLY_OFF_LIMIT = 2;

// GET /api/leave-requests/quota?date= — employee-only. Real usage for
// the week/month containing `date`, so the Attendance calendar's Choose
// Off Type sheet can show "1/1 Used" and disable an exhausted option
// BEFORE the employee taps it — this is UX only; the authoritative
// check is always the one inside createLeaveRequest's own transaction.
// Emergency Off has no `max` here on purpose: no numerical limit is
// defined anywhere in this codebase's business rules, and inventing one
// (or displaying "Unlimited" as if that were an established company
// policy) would be worse than being honest that it's simply not
// quota-limited by this system.
export async function getOffDayQuota(req, res, next) {
  try {
    const date = toUtcMidnight(req.query.date);
    const [weeklyUsed, monthlyUsed] = await Promise.all([
      countWeeklyOff(prisma, req.user.employeeId, date),
      countMonthlyOff(prisma, req.user.employeeId, date),
    ]);
    res.json({
      weekly: { used: weeklyUsed, max: WEEKLY_OFF_LIMIT, available: weeklyUsed < WEEKLY_OFF_LIMIT },
      monthly: { used: monthlyUsed, max: MONTHLY_OFF_LIMIT, available: monthlyUsed < MONTHLY_OFF_LIMIT },
      emergency: { used: null, max: null, available: true },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/leave-requests — employee-only.
export async function createLeaveRequest(req, res, next) {
  try {
    const { date, type, reason } = req.body;

    if (CALENDAR_OFF_TYPES.includes(type)) {
      return createCalendarOffDay(req, res, next, { date, type, reason });
    }

    if (type === "EARNED_DAY_OFF") {
      const balance = await computeExtraHoursBalance(prisma, req.user.employeeId);
      if (balance < EXTRA_HOURS_PER_DAY_OFF) {
        return res.status(400).json({
          error: `Not enough extra hours yet — you have ${balance}h, a day off requires ${EXTRA_HOURS_PER_DAY_OFF}h.`,
        });
      }
    }

    const request = await prisma.leaveRequest.create({
      data: {
        date,
        type,
        reason,
        hoursSpent: type === "EARNED_DAY_OFF" ? EXTRA_HOURS_PER_DAY_OFF : undefined,
        employeeId: req.user.employeeId,
        marketId: req.user.marketId,
      },
    });

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
}

// The WEEKLY_OFF / MONTHLY_OFF / EMERGENCY_OFF path — instant creation,
// no Supervisor review, real server-side quota/date/conflict
// enforcement. Every check below is authoritative (never trust the
// frontend's own copy of the same rule, which exists purely for UX —
// see AttendanceOffDaySheet.jsx on the frontend for the mirrored,
// non-authoritative version of these same checks).
async function createCalendarOffDay(req, res, next, { date, type, reason }) {
  try {
    const requestDate = toUtcMidnight(date);

    if (requestDate < todayUtcMidnight()) {
      return res.status(400).json({ error: "Past dates cannot be selected." });
    }

    const existingAttendance = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: req.user.employeeId, date: requestDate } },
    });
    if (existingAttendance) {
      return res.status(400).json({ error: "This date already has an attendance/off-day record." });
    }

    // Belt-and-suspenders against the same date being claimed twice by
    // two different LeaveRequest types (e.g. an EARNED_DAY_OFF that
    // hasn't been approved yet, so no AttendanceRecord exists for it):
    // give the friendly message here rather than letting the raw
    // LeaveRequest @@unique([employeeId, date]) constraint surface as a
    // generic "Duplicate value for: employeeId,date" via errorHandler's
    // P2002 fallback.
    const existingLeaveRequest = await prisma.leaveRequest.findUnique({
      where: { employeeId_date: { employeeId: req.user.employeeId, date: requestDate } },
    });
    if (existingLeaveRequest) {
      return res.status(400).json({ error: "This date already has an attendance/off-day record." });
    }

    // Serializable so two concurrent taps (e.g. a double-submit) can't
    // both read "0 used" and both create — the second transaction's
    // recompute is guaranteed to see the first one's write, or the
    // transaction fails cleanly and can be retried, exactly the same
    // race-safety pattern reviewLeaveRequest already uses below for
    // EARNED_DAY_OFF's balance check.
    const created = await prisma.$transaction(
      async (tx) => {
        if (type === "WEEKLY_OFF") {
          const used = await countWeeklyOff(tx, req.user.employeeId, requestDate);
          if (used >= WEEKLY_OFF_LIMIT) {
            throw new HttpError(400, "You already used your weekly off this week.");
          }
        } else if (type === "MONTHLY_OFF") {
          const used = await countMonthlyOff(tx, req.user.employeeId, requestDate);
          if (used >= MONTHLY_OFF_LIMIT) {
            throw new HttpError(400, "You already used both monthly off days this month.");
          }
        }
        // EMERGENCY_OFF — deliberately no quota check (see
        // getOffDayQuota's own comment on why no limit is invented).

        const request = await tx.leaveRequest.create({
          data: {
            date: requestDate,
            type,
            reason,
            status: "APPROVED", // instant — no Supervisor review for these three types
            employeeId: req.user.employeeId,
            marketId: req.user.marketId,
          },
        });

        await tx.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: req.user.employeeId, date: requestDate } },
          update: { status: "DAY_OFF", dayOffType: CALENDAR_DAY_OFF_TYPE[type], source: "SYSTEM" },
          create: {
            employeeId: req.user.employeeId,
            date: requestDate,
            status: "DAY_OFF",
            dayOffType: CALENDAR_DAY_OFF_TYPE[type],
            source: "SYSTEM",
          },
        });

        return request;
      },
      { isolationLevel: "Serializable" }
    );

    // Informational only — Monthly/Emergency notify the Supervisor,
    // Weekly deliberately does not (spec: no approval, no notification
    // for Weekly Off). Never blocks the response: the off day is
    // already committed above regardless of whether this succeeds, and
    // the response's own `notified` flag tells the frontend the truth
    // about whether it actually went out rather than always claiming
    // success.
    let notified = false;
    if (type === "MONTHLY_OFF" || type === "EMERGENCY_OFF") {
      try {
        const employee = await prisma.employee.findUnique({
          where: { id: req.user.employeeId },
          select: { name: true, marketId: true },
        });
        const market = await prisma.market.findUnique({
          where: { id: employee.marketId },
          select: { supervisorId: true },
        });
        if (market?.supervisorId) {
          const offTypeLabel = type === "MONTHLY_OFF" ? "Monthly Off" : "Emergency Off";
          // Emergency Off always has a real reason now (required at
          // validation) — worth putting in the Supervisor's
          // notification itself, since "why" is the one thing an
          // urgent/unexpected absence needs to actually communicate.
          const body =
            type === "EMERGENCY_OFF"
              ? `${employee.name} selected ${formatDateLabel(requestDate)} as Emergency Off: ${reason}`
              : `${employee.name} selected ${formatDateLabel(requestDate)} as ${offTypeLabel}.`;
          await createNotificationForUser({
            userId: market.supervisorId,
            type: "OFF_DAY_RECORDED",
            title: `${offTypeLabel} recorded`,
            body,
            linkType: "LEAVE_REQUEST",
            linkId: created.id,
          });
          notified = true;
        }
      } catch {
        // notified stays false — the off day itself is still valid and
        // already saved; only the informational notification failed.
      }
    }

    res.status(201).json({ ...created, notified });
  } catch (err) {
    next(err);
  }
}

// GET /api/leave-requests — the current employee's own requests.
export async function listMyLeaveRequests(req, res, next) {
  try {
    const requests = await prisma.leaveRequest.findMany({
      where: { employeeId: req.user.employeeId },
      orderBy: { date: "desc" },
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

// GET /api/leave-requests/market?marketId=&status= — staff-only, scoped
// to a market they can access. No frontend caller yet (no Supervisor
// approval-queue screen exists) — same "backend-ready" pattern as every
// other staff-only endpoint in this app.
export async function listLeaveRequestsForMarket(req, res, next) {
  try {
    const { status } = req.query;
    const marketId = req.query.marketId ?? req.user.marketId;
    if (!marketId) {
      return res.status(400).json({ error: "marketId is required" });
    }
    await assertMarketAccess(req.user, marketId);

    const where = { marketId };
    if (status) where.status = status;

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true, department: true } } },
      orderBy: { submittedAt: "desc" },
    });

    res.json(requests);
  } catch (err) {
    next(err);
  }
}

async function reviewLeaveRequest(req, res, next, { status, action }) {
  try {
    const request = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: "Leave request not found" });

    await assertMarketAccess(req.user, request.marketId);

    if (request.status !== "PENDING") {
      return res.status(400).json({ error: `This request is already ${request.status.toLowerCase()}` });
    }

    const { reviewNote } = req.body;

    // Interactive transaction (rather than the array form used elsewhere)
    // because EARNED_DAY_OFF needs to read the current balance and decide
    // whether to proceed *inside* the transaction — Serializable isolation
    // so two concurrent approvals of two different pending requests can't
    // both read the same balance and both succeed (the second one's
    // recompute is guaranteed to see the first one's write, or the
    // transaction fails and can be retried/reported instead of silently
    // over-spending the balance).
    const updated = await prisma.$transaction(
      async (tx) => {
        if (status === "APPROVED" && request.type === "EARNED_DAY_OFF") {
          const balance = await computeExtraHoursBalance(tx, request.employeeId);
          if (balance < request.hoursSpent) {
            throw new HttpError(
              400,
              `Cannot approve — this employee's extra-hours balance (${balance}h) is now less than the ${request.hoursSpent}h this request needs.`
            );
          }
        }

        const updatedRequest = await tx.leaveRequest.update({
          where: { id: request.id },
          data: { status, reviewedById: req.user.userId, reviewedAt: new Date(), reviewNote },
        });

        if (status === "APPROVED") {
          const attendanceStatus = request.type === "PERSONAL_LEAVE" ? "APPROVED_LEAVE" : "DAY_OFF";
          const dayOffType =
            request.type === "MONTHLY_OFF" ? "MONTHLY" : request.type === "EARNED_DAY_OFF" ? "OTHER" : undefined;
          await tx.attendanceRecord.upsert({
            where: { employeeId_date: { employeeId: request.employeeId, date: request.date } },
            update: { status: attendanceStatus, dayOffType, source: "SYSTEM" },
            create: { employeeId: request.employeeId, date: request.date, status: attendanceStatus, dayOffType, source: "SYSTEM" },
          });
        }

        return updatedRequest;
      },
      { isolationLevel: "Serializable" }
    );

    await prisma.attendanceAuditLog.create({
      data: {
        action,
        employeeId: request.employeeId,
        performedById: req.user.userId,
        previousValue: { status: "PENDING" },
        newValue: { status },
        reason: reviewNote,
      },
    });

    await createNotification({
      employeeId: request.employeeId,
      type: "LEAVE_REVIEWED",
      title: status === "APPROVED" ? "Leave request approved" : "Leave request rejected",
      body: reviewNote || `Your ${request.type === "MONTHLY_OFF" ? "off day" : "leave"} request for ${request.date.toISOString().slice(0, 10)} was ${status.toLowerCase()}.`,
      linkType: "LEAVE_REQUEST",
      linkId: request.id,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/leave-requests/:id/approve — staff-only.
export async function approveLeaveRequest(req, res, next) {
  return reviewLeaveRequest(req, res, next, { status: "APPROVED", action: "LEAVE_APPROVED" });
}

// PATCH /api/leave-requests/:id/reject — staff-only.
export async function rejectLeaveRequest(req, res, next) {
  return reviewLeaveRequest(req, res, next, { status: "REJECTED", action: "LEAVE_REJECTED" });
}
