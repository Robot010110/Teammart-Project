import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";
import { createNotification } from "../utils/notifications.js";

// leaveRequestsController.js — Off Day / Personal Leave requests (spec
// §10/§11). An employee submits one for a specific date; their
// Supervisor approves or rejects it. Approving upserts the matching
// AttendanceRecord (DAY_OFF for a Monthly Off day, APPROVED_LEAVE for
// Personal Leave) in the same transaction, so the calendar never shows a
// conflicting "Present" day for an approved leave — the AttendanceRecord
// is always the single source of truth the calendar reads from.

// POST /api/leave-requests — employee-only.
export async function createLeaveRequest(req, res, next) {
  try {
    const { date, type, reason } = req.body;

    const request = await prisma.leaveRequest.create({
      data: { date, type, reason, employeeId: req.user.employeeId, marketId: req.user.marketId },
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
    const operations = [
      prisma.leaveRequest.update({
        where: { id: request.id },
        data: { status, reviewedById: req.user.userId, reviewedAt: new Date(), reviewNote },
      }),
    ];

    if (status === "APPROVED") {
      const attendanceStatus = request.type === "MONTHLY_OFF" ? "DAY_OFF" : "APPROVED_LEAVE";
      const dayOffType = request.type === "MONTHLY_OFF" ? "MONTHLY" : undefined;
      operations.push(
        prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: request.employeeId, date: request.date } },
          update: { status: attendanceStatus, dayOffType, source: "SYSTEM" },
          create: { employeeId: request.employeeId, date: request.date, status: attendanceStatus, dayOffType, source: "SYSTEM" },
        })
      );
    }

    const [updated] = await prisma.$transaction(operations);

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
