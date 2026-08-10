import { prisma } from "../lib/prisma.js";

// notifications.js — the one place that writes a Notification row, so
// every trigger (Sudden Task assignment, Leave review, a new Chat
// message) creates the exact same shape instead of each controller
// hand-rolling its own `prisma.notification.create`. Deliberately only
// called from the concrete actions that already exist — no invented
// triggers for review steps that don't have a backend yet (e.g. Item
// Reports have no review endpoint, so nothing calls this from there).
export function createNotification({ employeeId, type, title, body, linkType, linkId }) {
  return prisma.notification.create({
    data: { employeeId, type, title, body, linkType, linkId },
  });
}

// Fan-out version for market-wide events (a Warnings broadcast, or any
// future "notify everyone in this market" action) — one row per employee
// rather than a single shared row, so read state is per-employee like
// everywhere else in this app.
export async function createNotificationForMarket({ marketId, excludeEmployeeId, type, title, body, linkType, linkId }) {
  const employees = await prisma.employee.findMany({
    where: { marketId, id: excludeEmployeeId ? { not: excludeEmployeeId } : undefined },
    select: { id: true },
  });
  if (employees.length === 0) return;
  await prisma.notification.createMany({
    data: employees.map((e) => ({ employeeId: e.id, type, title, body, linkType, linkId })),
  });
}
