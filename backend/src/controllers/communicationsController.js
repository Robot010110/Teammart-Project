import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/auth.js";
import { authorizeTargeting, calculateRecipients } from "../services/communicationTargeting.js";
import { createNotificationForEmployees, createNotificationForUser } from "../utils/notifications.js";

// communicationsController.js — Warnings & Notifications. See
// communicationTargeting.js for the security-critical authorization +
// matching logic; this file is the thin HTTP layer around it plus the
// employee-facing read/acknowledge/complete endpoints and the sender's
// history/progress views.

// POST /api/communications/preview — staff-only (ADMIN/REGIONAL_MANAGER,
// enforced inside authorizeTargeting). Recalculates from scratch every
// call; the count returned here is NEVER trusted again at send time
// (spec §21/§24 — "do not trust the earlier preview result during the
// final send").
export async function previewCommunication(req, res, next) {
  try {
    await authorizeTargeting(req.user, req.body);
    const recipients = await calculateRecipients(req.body);
    res.json({ recipientCount: recipients.length });
  } catch (err) {
    next(err);
  }
}

// POST /api/communications — the real send. Re-runs authorization AND
// recipient calculation independently of whatever the preview call
// returned (spec §24's numbered list, in order): the frontend's job
// ends at "the user clicked Send" — everything from here down is
// re-derived from the database.
export async function sendCommunication(req, res, next) {
  try {
    const { type, category, title, message, priority, deadline, actionType, clientRequestId, ...targeting } = req.body;

    const { marketId, zoneId, zoneNumber, targetSupervisorId } = await authorizeTargeting(req.user, targeting);
    const recipients = await calculateRecipients(targeting);

    if (recipients.length === 0) {
      throw new HttpError(422, "No employees match the selected criteria.");
    }

    const sender = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true, role: true } });

    let communication;
    try {
      communication = await prisma.$transaction(async (tx) => {
        const created = await tx.communication.create({
          data: {
            senderId: req.user.userId,
            senderNameSnapshot: sender.name,
            senderRoleSnapshot: sender.role,
            // The human-readable "Zone 2" label (Zone.number), NOT the
            // Zone.id FK — display code must never confuse the two (see
            // authorizeTargeting's own comment; this was caught during
            // frontend implementation before any UI shipped against it).
            senderZoneSnapshot: zoneNumber,
            type,
            category,
            title,
            message,
            priority: priority ?? "NORMAL",
            scopeType: targeting.scopeType,
            zoneId: targeting.scopeType === "ZONE" ? zoneId : null,
            marketId: targeting.scopeType === "MARKET" ? marketId : null,
            targetSupervisorId: targeting.scopeType === "SPECIFIC_SUPERVISOR" ? targetSupervisorId : null,
            targetRole: targeting.scopeType === "SPECIFIC_SUPERVISOR" ? null : targeting.targetRole,
            targetDepartment: targeting.scopeType === "SPECIFIC_SUPERVISOR" ? null : (targeting.targetDepartment ?? null),
            deadline: deadline ?? null,
            actionType: actionType ?? "INFORMATIONAL",
            recipientCount: recipients.length,
            clientRequestId: clientRequestId ?? null,
          },
        });

        // createMany, not one create() per recipient — one round trip
        // regardless of audience size, and the real @@unique constraints
        // (one for employeeId, one for userId — see the schema's own
        // comment on why it's two, not one compound index) are the real
        // guarantee against a duplicate recipient row even if
        // `recipients` somehow contained the same person twice.
        await tx.communicationRecipient.createMany({
          data: recipients.map((r) =>
            r.kind === "staff"
              ? { communicationId: created.id, userId: r.id }
              : { communicationId: created.id, employeeId: r.id }
          ),
          skipDuplicates: true,
        });

        return created;
      });
    } catch (err) {
      // A retried/double-click request reusing the same clientRequestId
      // hits the real unique constraint (spec §41) — treat it as "already
      // sent" and hand back the existing record instead of erroring or,
      // worse, silently creating a second communication.
      if (err.code === "P2002" && clientRequestId) {
        const existing = await prisma.communication.findUnique({ where: { clientRequestId } });
        if (existing) {
          return res.status(200).json({ ...existing, alreadySent: true });
        }
      }
      throw err;
    }

    // Fire-and-observe, same failure-isolation pattern as Night Shift's
    // notifyNightShiftCompletion — the Communication + its recipient
    // snapshot are already committed above; a bell-notification write
    // failure must never be mistaken for the send itself failing (spec
    // §42: "notification delivery fails... keep the authoritative
    // records"). Logged, never rethrown.
    try {
      const employeeIds = recipients.filter((r) => r.kind === "employee").map((r) => r.id);
      const staffIds = recipients.filter((r) => r.kind === "staff").map((r) => r.id);
      await Promise.all([
        employeeIds.length
          ? createNotificationForEmployees({
              employeeIds,
              type: "COMMUNICATION",
              title: communication.title,
              body: communication.message,
              linkType: "COMMUNICATION",
              linkId: communication.id,
            })
          : null,
        ...staffIds.map((userId) =>
          createNotificationForUser({
            userId,
            type: "COMMUNICATION",
            title: communication.title,
            body: communication.message,
            linkType: "COMMUNICATION",
            linkId: communication.id,
          })
        ),
      ]);
    } catch (err) {
      console.error(`Communication ${communication.id}: bell-notification fan-out failed:`, err);
    }

    res.status(201).json(communication);
  } catch (err) {
    next(err);
  }
}

// GET /api/communications/sent — the sender's own history (spec §32).
// Scoped to communications THIS sender created — a Zone Manager only
// ever sees their own sends, never another manager's, matching the
// existing "history is sender-scoped" convention (e.g. Admin audit log
// is the one exception, and this isn't that).
export async function listSentCommunications(req, res, next) {
  try {
    if (req.user.kind !== "staff" || !["ADMIN", "REGIONAL_MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized for this action" });
    }

    const communications = await prisma.communication.findMany({
      where: { senderId: req.user.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { market: { select: { id: true, name: true } }, zone: { select: { id: true, number: true } } },
    });

    res.json(communications);
  } catch (err) {
    next(err);
  }
}

// GET /api/communications/:id — sender-only detail + live progress
// (spec §33), derived from the real CommunicationRecipient rows every
// time, never from a cached count.
export async function getCommunicationProgress(req, res, next) {
  try {
    const communication = await prisma.communication.findUnique({
      where: { id: req.params.id },
      include: { market: { select: { id: true, name: true } }, zone: { select: { id: true, number: true } } },
    });
    if (!communication) return res.status(404).json({ error: "Communication not found" });
    if (communication.senderId !== req.user.userId) {
      return res.status(403).json({ error: "You do not have access to this communication" });
    }

    const [read, acknowledged, completed] = await Promise.all([
      prisma.communicationRecipient.count({ where: { communicationId: communication.id, readAt: { not: null } } }),
      prisma.communicationRecipient.count({ where: { communicationId: communication.id, acknowledgedAt: { not: null } } }),
      prisma.communicationRecipient.count({ where: { communicationId: communication.id, completedAt: { not: null } } }),
    ]);

    res.json({
      ...communication,
      progress: {
        recipients: communication.recipientCount,
        read,
        unread: communication.recipientCount - read,
        acknowledged,
        completed,
        pending: communication.recipientCount - completed,
      },
    });
  } catch (err) {
    next(err);
  }
}

// --- Employee-facing --------------------------------------------------

// GET /api/communications/my — every communication this caller (an
// Employee, or — Verification pass §1 — a staff User targeted via
// Specific-Supervisor) is a recipient of, most recent first, with THEIR
// OWN recipient row's state. reachable by any authenticated account;
// naturally empty for a sender-only role like Admin/RM that's never a
// recipient — no separate authorization needed beyond "this is you."
export async function listMyCommunications(req, res, next) {
  try {
    const where = req.user.kind === "employee" ? { employeeId: req.user.employeeId } : { userId: req.user.userId };
    const recipientRows = await prisma.communicationRecipient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { communication: true },
    });
    res.json(recipientRows.map(shapeForRecipient));
  } catch (err) {
    next(err);
  }
}

// GET /api/communications/my/:id — single communication, this
// employee's own state, and marks it READ as a side effect of opening it
// (same "opening it is what marks it read" convention as the existing
// Notification bell — see notificationsController's markNotificationRead
// being a separate explicit action there vs. this being automatic here;
// either is defensible, this mirrors how a Task detail screen already
// behaves in this app).
export async function getMyCommunication(req, res, next) {
  try {
    const row = await requireOwnRecipientRow(req);
    if (!row.readAt) {
      const updated = await prisma.communicationRecipient.update({
        where: { id: row.id },
        data: { readAt: new Date(), status: row.status === "UNREAD" ? "READ" : row.status },
      });
      return res.json(shapeForRecipient({ ...row, ...updated, communication: row.communication }));
    }
    res.json(shapeForRecipient(row));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/communications/my/:id/acknowledge
export async function acknowledgeCommunication(req, res, next) {
  try {
    const row = await requireOwnRecipientRow(req);
    if (row.communication.actionType !== "ACKNOWLEDGEMENT") {
      return res.status(400).json({ error: "This communication does not require acknowledgement" });
    }
    if (row.acknowledgedAt) return res.json(shapeForRecipient(row));

    const updated = await prisma.communicationRecipient.update({
      where: { id: row.id },
      data: { acknowledgedAt: new Date(), readAt: row.readAt ?? new Date(), status: "ACKNOWLEDGED" },
    });
    res.json(shapeForRecipient({ ...row, ...updated, communication: row.communication }));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/communications/my/:id/start — Start Task (spec §19).
export async function startCommunicationTask(req, res, next) {
  try {
    const row = await requireOwnRecipientRow(req);
    if (row.communication.actionType !== "COMPLETION") {
      return res.status(400).json({ error: "This communication is not an actionable task" });
    }
    if (row.completedAt) return res.json(shapeForRecipient(row));

    const updated = await prisma.communicationRecipient.update({
      where: { id: row.id },
      data: { startedAt: row.startedAt ?? new Date(), readAt: row.readAt ?? new Date(), status: "IN_PROGRESS" },
    });
    res.json(shapeForRecipient({ ...row, ...updated, communication: row.communication }));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/communications/my/:id/complete — Submit Result (spec §19-20).
export async function completeCommunicationTask(req, res, next) {
  try {
    const row = await requireOwnRecipientRow(req);
    if (row.communication.actionType !== "COMPLETION") {
      return res.status(400).json({ error: "This communication does not require completion" });
    }
    if (row.completedAt) {
      return res.status(400).json({ error: "This task has already been completed" });
    }

    const updated = await prisma.communicationRecipient.update({
      where: { id: row.id },
      data: {
        completedAt: new Date(),
        readAt: row.readAt ?? new Date(),
        startedAt: row.startedAt ?? new Date(),
        status: "COMPLETED",
        response: req.body.response ?? undefined,
      },
    });
    res.json(shapeForRecipient({ ...row, ...updated, communication: row.communication }));
  } catch (err) {
    next(err);
  }
}

// Shared ownership lookup for every /my/:id action — a recipient (either
// an Employee or, since Verification pass §1's Specific-Supervisor
// targeting, a staff User) may only ever act on THEIR OWN
// CommunicationRecipient row, looked up by (communicationId, own id),
// never by trusting a recipient id supplied in the URL/body alone.
async function requireOwnRecipientRow(req) {
  const where =
    req.user.kind === "employee"
      ? { communicationId_employeeId: { communicationId: req.params.id, employeeId: req.user.employeeId } }
      : { communicationId_userId: { communicationId: req.params.id, userId: req.user.userId } };
  const row = await prisma.communicationRecipient.findUnique({ where, include: { communication: true } });
  if (!row) throw new HttpError(404, "Communication not found");
  return row;
}

function shapeForRecipient(row) {
  return {
    id: row.communication.id,
    type: row.communication.type,
    category: row.communication.category,
    title: row.communication.title,
    message: row.communication.message,
    priority: row.communication.priority,
    deadline: row.communication.deadline,
    actionType: row.communication.actionType,
    senderName: row.communication.senderNameSnapshot,
    senderRole: row.communication.senderRoleSnapshot,
    senderZone: row.communication.senderZoneSnapshot,
    createdAt: row.communication.createdAt,
    myStatus: row.status,
    readAt: row.readAt,
    acknowledgedAt: row.acknowledgedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    response: row.response,
  };
}
