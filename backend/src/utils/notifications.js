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

// Staff-recipient counterpart to createNotification — for the one case
// where the recipient is a User, not an Employee (a Worker's Wasted
// Overall report notifying their market's Supervisor). See the
// Notification model comment for why both employeeId and userId exist,
// dual-nullable, exactly one ever set.
export function createNotificationForUser({ userId, type, title, body, linkType, linkId }) {
  return prisma.notification.create({
    data: { userId, type, title, body, linkType, linkId },
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

// Fan-out version for an explicit, already-resolved employee id list —
// Warnings & Notifications' own recipient snapshot, which (unlike
// createNotificationForMarket above) isn't "everyone in one market" but
// a precisely-targeted set possibly spanning many markets/a whole zone.
// A no-op writer failing here must never be mistaken for the
// Communication/CommunicationRecipient rows themselves failing — see
// communicationsController.sendCommunication's own comment on why this
// call happens AFTER that transaction already committed.
export async function createNotificationForEmployees({ employeeIds, type, title, body, linkType, linkId }) {
  if (employeeIds.length === 0) return;
  await prisma.notification.createMany({
    data: employeeIds.map((employeeId) => ({ employeeId, type, title, body, linkType, linkId })),
  });
}

// Zone-wide counterpart to createNotificationForMarket — fans out to every
// employee whose market belongs to this zone (a Zone Announcement, e.g.).
export async function createNotificationForZone({ zoneId, excludeEmployeeId, type, title, body, linkType, linkId }) {
  const employees = await prisma.employee.findMany({
    where: { market: { zoneId }, id: excludeEmployeeId ? { not: excludeEmployeeId } : undefined },
    select: { id: true },
  });
  if (employees.length === 0) return;
  await prisma.notification.createMany({
    data: employees.map((e) => ({ employeeId: e.id, type, title, body, linkType, linkId })),
  });
}
