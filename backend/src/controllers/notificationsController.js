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
    const where = recipientWhere(req.user);

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
      where: { ...recipientWhere(req.user), read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
