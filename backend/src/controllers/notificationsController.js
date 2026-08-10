import { prisma } from "../lib/prisma.js";

// notificationsController.js — a real notification feed (see
// utils/notifications.js for where rows get written). Employee-only:
// this is a personal feed, not a staff/management view.

// GET /api/notifications?limit= — most recent first, plus unreadCount so
// the Home screen / bottom-nav badge don't need a second request.
export async function listMyNotifications(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 30;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { employeeId: req.user.employeeId },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
      }),
      prisma.notification.count({
        where: { employeeId: req.user.employeeId, read: false },
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
    if (notification.employeeId !== req.user.employeeId) {
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
      where: { employeeId: req.user.employeeId, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
