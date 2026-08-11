import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, HttpError } from "../middleware/auth.js";
import { createNotification } from "../utils/notifications.js";
import { computeExtraHoursBalance, EXTRA_HOURS_PER_DAY_OFF } from "./attendanceController.js";

// leaveRequestsController.js — Off Day / Personal Leave / Earned Day Off
// requests. An employee submits one for a specific date; their Supervisor
// approves or rejects it. Approving upserts the matching AttendanceRecord
// (DAY_OFF for Monthly Off or an Earned Day Off, APPROVED_LEAVE for
// Personal Leave) in the same transaction, so the calendar never shows a
// conflicting "Present" day for an approved leave — the AttendanceRecord
// is always the single source of truth the calendar reads from.
//
// EARNED_DAY_OFF spends the employee's extra-hours balance (see
// computeExtraHoursBalance in attendanceController.js — there is no
// ledger table, the balance is always derived from AttendanceRecord vs.
// already-APPROVED EARNED_DAY_OFF requests). The balance is checked here
// too (early, friendly rejection) but the authoritative check happens at
// approval time inside a Serializable transaction (see reviewLeaveRequest
// below) — that's the only point that can actually prevent two pending
// requests from double-spending the same hours.

// POST /api/leave-requests — employee-only.
export async function createLeaveRequest(req, res, next) {
  try {
    const { date, type, reason } = req.body;

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
