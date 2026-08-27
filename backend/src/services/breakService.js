import { prisma } from "../lib/prisma.js";
import { createNotification, createNotificationForUser } from "../utils/notifications.js";

const BREAK_DURATION_MINUTES = 60;

function dayOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isOwner(brk, owner) {
  return owner.employeeId ? brk.employeeId === owner.employeeId : brk.staffUserId === owner.staffUserId;
}

// breakService.js — the one place that actually creates/transitions a
// Break row, called from both the ADMIN-only manual/test endpoint
// (breaksController.createBreak) and the fingerprint adapter
// (services/fingerprintAdapter.js) — one break-creation code path,
// regardless of which boundary triggered it, per the Phase 1 spec's own
// "one source of truth" principle applied to breaks the same way it's
// applied to Department Closing submissions.
//
// Owner shape throughout this file: { employeeId } XOR { staffUserId } —
// same convention as attendanceController.attendanceOwnerFromUser.

// The partial unique index on Break (employeeId)/(staffUserId) WHERE
// status IN ('PENDING_CONFIRMATION','ACTIVE') — added by hand in this
// model's migration.sql, since Prisma's schema language can't express a
// WHERE clause on @@unique — is the REAL guarantee against two
// concurrent requests creating duplicate active breaks. The findFirst
// check below only produces a fast, friendly error for the common
// (non-racing) case; the catch block below is what actually handles a
// genuine race, translating the resulting P2002 into the same 409.
export async function createPendingBreak({ employeeId, staffUserId, marketId, fingerprintEventId }) {
  const activeWhere = employeeId
    ? { employeeId, status: { in: ["PENDING_CONFIRMATION", "ACTIVE"] } }
    : { staffUserId, status: { in: ["PENDING_CONFIRMATION", "ACTIVE"] } };

  const existing = await prisma.break.findFirst({ where: activeWhere });
  if (existing) {
    throw httpError(409, "An active or pending break already exists for this person");
  }

  try {
    return await prisma.break.create({
      data: {
        status: "PENDING_CONFIRMATION",
        date: dayOnly(new Date()),
        employeeId: employeeId ?? null,
        staffUserId: staffUserId ?? null,
        marketId,
        fingerprintEventId: fingerprintEventId ?? null,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw httpError(409, "An active or pending break already exists for this person");
    }
    throw err;
  }
}

// PENDING_CONFIRMATION -> ACTIVE. startTime/expectedEndTime are set
// atomically, server-side, right here — the frontend never supplies
// either (spec: "the server/database is authoritative").
export async function confirmBreak(breakId, owner) {
  const brk = await prisma.break.findUnique({ where: { id: breakId } });
  if (!brk) throw httpError(404, "Break not found");
  if (!isOwner(brk, owner)) throw httpError(403, "You do not have access to this break");
  if (brk.status !== "PENDING_CONFIRMATION") {
    throw httpError(400, `This break is ${brk.status.toLowerCase()}, not pending confirmation`);
  }

  const startTime = new Date();
  const expectedEndTime = new Date(startTime.getTime() + BREAK_DURATION_MINUTES * 60000);
  return prisma.break.update({ where: { id: breakId }, data: { status: "ACTIVE", startTime, expectedEndTime } });
}

// PENDING_CONFIRMATION or ACTIVE -> CANCELLED. Same ownership check as
// confirmBreak — an employee cannot cancel someone else's break, and
// neither transition can be skipped/forced past this function (no
// route accepts a raw `status` field from the client — see
// breaksController.js).
export async function cancelBreak(breakId, owner, reason) {
  const brk = await prisma.break.findUnique({ where: { id: breakId } });
  if (!brk) throw httpError(404, "Break not found");
  if (!isOwner(brk, owner)) throw httpError(403, "You do not have access to this break");
  if (!["PENDING_CONFIRMATION", "ACTIVE"].includes(brk.status)) {
    throw httpError(400, `This break is already ${brk.status.toLowerCase()}`);
  }

  return prisma.break.update({
    where: { id: breakId },
    data: { status: "CANCELLED", actualEndTime: new Date(), cancelReason: reason ?? null },
  });
}

// Lazily flips ACTIVE -> COMPLETED once expectedEndTime has passed —
// same "closest honest approximation given no live job scheduler"
// pattern already established by attendanceController's missing-
// checkout detection (this app has no cron/background-job
// infrastructure yet — see this file's own note in the Phase 1 report).
// A real Phase 2 sweep can run this proactively without changing the
// state machine itself; every read path in breaksController.js runs a
// Break through this first so the state is never stale by more than the
// time since it was last read.
export async function withLazyCompletion(brk) {
  if (brk && brk.status === "ACTIVE" && brk.expectedEndTime && brk.expectedEndTime <= new Date()) {
    // Same race-tolerant pattern as jobs/maintenanceScheduler.js's sweep
    // (which now handles the common case — this stays as the immediate
    // fallback for anyone who reads a break in the gap before the next
    // scheduled tick): updateMany with status: "ACTIVE" in the WHERE
    // means a break already completed by the scheduler between the
    // caller's read and this call is simply not touched again — no
    // double notification.
    const result = await prisma.break.updateMany({
      where: { id: brk.id, status: "ACTIVE" },
      data: { status: "COMPLETED", actualEndTime: brk.expectedEndTime },
    });
    if (result.count > 0) {
      if (brk.employeeId) {
        await createNotification({
          employeeId: brk.employeeId,
          type: "BREAK_COMPLETED",
          title: "Break completed",
          body: "Your break has ended.",
          linkType: "BREAK",
          linkId: brk.id,
        });
      } else if (brk.staffUserId) {
        await createNotificationForUser({
          userId: brk.staffUserId,
          type: "BREAK_COMPLETED",
          title: "Break completed",
          body: "Your break has ended.",
          linkType: "BREAK",
          linkId: brk.id,
        });
      }
      return { ...brk, status: "COMPLETED", actualEndTime: brk.expectedEndTime };
    }
    // Someone else (the scheduler, another concurrent request) already
    // completed it — re-fetch so the caller sees the real current row.
    return prisma.break.findUnique({ where: { id: brk.id } });
  }
  return brk;
}

// remaining = expectedEndTime - now, computed fresh on every call —
// never a stored countdown (spec §6). Zero for anything not currently
// ACTIVE.
export function remainingSeconds(brk) {
  if (brk.status !== "ACTIVE" || !brk.expectedEndTime) return 0;
  return Math.max(Math.round((new Date(brk.expectedEndTime).getTime() - Date.now()) / 1000), 0);
}
