import { prisma } from "../lib/prisma.js";

// notificationsController.js — a real notification feed (see
// utils/notifications.js for where rows get written). Works for both an
// Employee (recipient = employeeId) and a staff User (recipient =
// userId, e.g. a Supervisor receiving a Regional Manager's Warning/
// Recognition, or a Regional Manager receiving their own management
// alerts) — same Notification model, same three endpoints, just scoped
// to whichever recipient column applies to the caller. Previously this
// was employee-only, which meant every Notification ever written with a
// userId recipient (WASTED_OVERALL to a Supervisor, MARKET_FEEDBACK to a
// Supervisor) was created but had no way to ever be read back.

function recipientWhere(user) {
  return user.kind === "employee" ? { employeeId: user.employeeId } : { userId: user.userId };
}

// GET /api/notifications?limit= — most recent first, plus unreadCount so
// the Home screen / bottom-nav badge don't need a second request.
export async function listMyNotifications(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const where = { ...recipientWhere(req.user), deletedAt: null };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
      }),
      prisma.notification.count({
        where: { ...where, read: false },
      }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notifications/:id/read
export async function markNotificationRead(req, res, next) {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return res.status(404).json({ error: "Notification not found" });

    const isRecipient =
      req.user.kind === "employee" ? notification.employeeId === req.user.employeeId : notification.userId === req.user.userId;
    if (!isRecipient) {
      return res.status(403).json({ error: "You do not have access to this notification" });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notifications/read-all
export async function markAllNotificationsRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { ...recipientWhere(req.user), read: false, deletedAt: null },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notifications/:id — Repair Pass §6. Soft-deletes (see
// Notification.deletedAt's own schema comment) — real persistence, not a
// React-state-only hide: it's excluded from listMyNotifications/
// unreadCount from this point on, and stays excluded across refresh/
// logout/re-login since it's a real column, not client state. Ownership
// uses the exact same recipient check as markNotificationRead (never a
// client-supplied id trusted on its own) — a user can never delete
// another user's notification by editing the id in the URL.
export async function deleteNotification(req, res, next) {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return res.status(404).json({ error: "Notification not found" });

    const isRecipient =
      req.user.kind === "employee" ? notification.employeeId === req.user.employeeId : notification.userId === req.user.userId;
    if (!isRecipient) {
      return res.status(403).json({ error: "You do not have access to this notification" });
    }

    if (!notification.deletedAt) {
      await prisma.notification.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notifications — bulk "Delete All" for the caller's own
// notification feed. Same soft-delete as the single-notification path
// above (deletedAt, never a hard delete) and the same ownership scoping
// (recipientWhere) every other endpoint in this file already uses — this
// can only ever touch the caller's own rows, there is no id in the
// request at all for anything to be spoofed.
export async function deleteAllNotifications(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { ...recipientWhere(req.user), deletedAt: null },
      data: { deletedAt: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
