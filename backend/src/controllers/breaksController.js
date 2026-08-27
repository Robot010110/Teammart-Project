import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";
import { createNotification, createNotificationForUser } from "../utils/notifications.js";
import * as breakService from "../services/breakService.js";

// breaksController.js — Phase 1 foundation for the fingerprint-triggered
// break workflow. HTTP layer only; the actual state-machine logic lives
// in services/breakService.js so both this controller and the
// fingerprint adapter (services/fingerprintAdapter.js) go through the
// exact same code path — one source of truth for how a Break is created
// and transitioned, never a raw `status` field accepted from a client
// anywhere in this file.

function ownerFromUser(user) {
  if (user.kind === "employee") return { employeeId: user.employeeId, marketId: user.marketId };
  if (user.kind === "staff" && (user.role === "SUPERVISOR" || user.role === "OVERLOOKING_SUPERVISOR")) {
    return { staffUserId: user.userId, marketId: user.marketId };
  }
  return null;
}

// POST /api/breaks — ADMIN-only. This is the "controlled internal test
// call" the Phase 1 spec explicitly asks for in place of a real
// fingerprint connection (see services/fingerprintAdapter.js) — not a
// general employee/staff self-service way to start a break, and not
// pretending to be the real hardware trigger.
export async function createBreak(req, res, next) {
  try {
    const { employeeId, staffUserId } = req.body;
    if (!employeeId && !staffUserId) {
      return res.status(400).json({ error: "employeeId or staffUserId is required" });
    }
    if (employeeId && staffUserId) {
      return res.status(400).json({ error: "Provide only one of employeeId or staffUserId" });
    }

    let marketId;
    if (employeeId) {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee) return res.status(400).json({ error: "employeeId does not refer to an existing employee" });
      marketId = employee.marketId;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: staffUserId },
        include: { managedMarket: true, managedOverlookingMarket: true },
      });
      if (!user || !["SUPERVISOR", "OVERLOOKING_SUPERVISOR"].includes(user.role)) {
        return res.status(400).json({ error: "staffUserId does not refer to a Supervisor/Overlooking account" });
      }
      marketId = user.managedMarket?.id ?? user.managedOverlookingMarket?.id;
      if (!marketId) return res.status(400).json({ error: "That account is not assigned to a market" });
    }

    const brk = await breakService.createPendingBreak({ employeeId, staffUserId, marketId });

    if (employeeId) {
      await createNotification({
        employeeId,
        type: "BREAK_PENDING_CONFIRMATION",
        title: "Did you take a break?",
        body: "Confirm to start your 60-minute break.",
        linkType: "BREAK",
        linkId: brk.id,
      });
    } else {
      await createNotificationForUser({
        userId: staffUserId,
        type: "BREAK_PENDING_CONFIRMATION",
        title: "Did you take a break?",
        body: "Confirm to start your 60-minute break.",
        linkType: "BREAK",
        linkId: brk.id,
      });
    }

    res.status(201).json(brk);
  } catch (err) {
    next(err);
  }
}

// GET /api/breaks/me — the caller's own current break (whatever is most
// recent), with server-computed remaining time. Returns null if there
// is none — not an error, just "no break right now".
export async function getMyBreak(req, res, next) {
  try {
    const owner = ownerFromUser(req.user);
    if (!owner) return res.status(403).json({ error: "This account has no break state" });

    const where = owner.employeeId ? { employeeId: owner.employeeId } : { staffUserId: owner.staffUserId };
    let brk = await prisma.break.findFirst({ where, orderBy: { createdAt: "desc" } });
    if (!brk) return res.json(null);

    brk = await breakService.withLazyCompletion(brk);
    res.json({ ...brk, remainingSeconds: breakService.remainingSeconds(brk) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/breaks/:id/confirm — the employee/staff themself confirms
// their OWN pending break. Ownership is enforced inside
// breakService.confirmBreak (403 if not theirs), and the only state
// transition this can ever cause is PENDING_CONFIRMATION -> ACTIVE — an
// employee cannot send status=COMPLETED or any other value to bypass the
// 60-minute wait, because no field in this request body is ever read as
// the new status.
export async function confirmBreak(req, res, next) {
  try {
    const owner = ownerFromUser(req.user);
    if (!owner) return res.status(403).json({ error: "This account has no break state" });

    const brk = await breakService.confirmBreak(req.params.id, owner);
    res.json({ ...brk, remainingSeconds: breakService.remainingSeconds(brk) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/breaks/:id/cancel — same ownership rule as confirm above.
export async function cancelBreak(req, res, next) {
  try {
    const owner = ownerFromUser(req.user);
    if (!owner) return res.status(403).json({ error: "This account has no break state" });

    const brk = await breakService.cancelBreak(req.params.id, owner, req.body?.reason);
    res.json(brk);
  } catch (err) {
    next(err);
  }
}

// GET /api/breaks/market?marketId= — staff-only, basic visibility into
// today's breaks for a market they can access (Admin/Regional Manager/
// Supervisor/Overlooking, scoped the same way every other market-scoped
// endpoint in this app is). Deliberately minimal — a real monitoring/
// report view is Phase 2/3 work; this exists so Phase 1's foundation is
// actually checkable through the API, not to be the final screen.
export async function listBreaksForMarket(req, res, next) {
  try {
    const { marketId } = req.query;
    if (!marketId) return res.status(400).json({ error: "marketId is required" });
    await assertMarketAccess(req.user, marketId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const breaks = await prisma.break.findMany({
      where: { marketId, date: today },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        staffUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const withCompletion = await Promise.all(breaks.map((b) => breakService.withLazyCompletion(b)));
    res.json(withCompletion);
  } catch (err) {
    next(err);
  }
}
