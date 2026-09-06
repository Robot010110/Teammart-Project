import { prisma } from "../lib/prisma.js";

// ---------------------------------------------------------------------
// Delivery preferences (Settings -> Notifications).
//
// Enforced HERE rather than in the UI, because a preference that only
// hides rows client-side is not a preference — the row still exists and
// still counts as unread. This is the one module that writes
// Notification rows, so filtering recipients here covers every trigger
// in the app.
//
// ACCOUNT_STATUS_CHANGED and ROLE_CHANGED are never suppressed: being
// suspended or having your role changed is not optional noise, and the
// brief explicitly says required/system notifications must survive
// muting.
// ---------------------------------------------------------------------
const ALWAYS_DELIVERED = new Set(["ACCOUNT_STATUS_CHANGED", "ROLE_CHANGED"]);

// "Work activity" = things that happen because of the recipient's own
// work: an assignment, a review outcome, an attendance/shift event.
// Deliberately excludes chat and broadcast announcements.
const WORK_ACTIVITY_TYPES = new Set([
  "SUDDEN_TASK",
  "SUBMISSION_REVIEWED",
  "LEAVE_REVIEWED",
  "WASTED_OVERALL",
  "EXTRA_HOURS_SUBMITTED",
  "OFF_DAY_RECORDED",
  "TOTAL_SALES_SUBMITTED",
  "CARD_SALES_SUBMITTED",
  "CARD_SALES_REMINDER",
  "COUNTING_ASSIGNMENT_VERIFICATION_NEEDED",
  "COUNTING_ASSIGNMENT_VERIFIED",
  "MISSING_CHECKOUT",
  "EXCESSIVE_EXTRA_HOURS",
  "BREAK_PENDING_CONFIRMATION",
  "BREAK_COMPLETED",
  "DEPARTMENT_CLOSING_SUBMITTED",
  "NIGHT_SHIFT_TASK_COMPLETED",
  "EMPLOYEE_REPORT_SUBMITTED",
  "MARKET_FEEDBACK",
  "MARKET_VISIT",
]);

function allowedByMode(mode, type) {
  if (ALWAYS_DELIVERED.has(type)) return true;
  switch (mode) {
    case "MUTE_ALL":
      return false;
    case "MENTIONS_ONLY":
      return type === "MENTION";
    case "WORK_ACTIVITY_ONLY":
      return WORK_ACTIVITY_TYPES.has(type);
    default:
      return true; // ALL
  }
}

// WORK_ACTIVITY_ONLY additionally means "while I am actually working",
// per the preference's own description. "Working" is the same real
// attendance state the rest of the app uses: checked in today and not
// yet checked out (see utils/employeeStatus.js) — not a new concept.
async function isCurrentlyWorking({ employeeId, userId }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const record = await prisma.attendanceRecord.findFirst({
    where: {
      ...(employeeId ? { employeeId } : { staffUserId: userId }),
      date: { gte: start, lt: end },
    },
    select: { checkIn: true, checkOut: true },
  });
  return !!(record?.checkIn && !record.checkOut);
}

// Narrows a recipient list to those whose own preference accepts this
// notification type. Returns the ids that should actually receive it.
async function filterEmployeeRecipients(employeeIds, type) {
  if (employeeIds.length === 0) return [];
  const rows = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, notificationMode: true },
  });
  const kept = [];
  for (const r of rows) {
    if (!allowedByMode(r.notificationMode, type)) continue;
    if (r.notificationMode === "WORK_ACTIVITY_ONLY" && !ALWAYS_DELIVERED.has(type)) {
      if (!(await isCurrentlyWorking({ employeeId: r.id }))) continue;
    }
    kept.push(r.id);
  }
  return kept;
}


// notifications.js — the one place that writes a Notification row, so
// every trigger (Sudden Task assignment, Leave review, a new Chat
// message) creates the exact same shape instead of each controller
// hand-rolling its own `prisma.notification.create`. Deliberately only
// called from the concrete actions that already exist — no invented
// triggers for review steps that don't have a backend yet (e.g. Item
// Reports have no review endpoint, so nothing calls this from there).
export async function createNotification({ employeeId, type, title, body, linkType, linkId }) {
  const [allowed] = await filterEmployeeRecipients([employeeId], type);
  if (!allowed) return null;
  return prisma.notification.create({
    data: { employeeId, type, title, body, linkType, linkId },
  });
}

// Staff-recipient counterpart to createNotification — for the one case
// where the recipient is a User, not an Employee (a Worker's Wasted
// Overall report notifying their market's Supervisor). See the
// Notification model comment for why both employeeId and userId exist,
// dual-nullable, exactly one ever set.
export async function createNotificationForUser({ userId, type, title, body, linkType, linkId }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationMode: true } });
  if (user && !allowedByMode(user.notificationMode, type)) return null;
  if (user?.notificationMode === "WORK_ACTIVITY_ONLY" && !ALWAYS_DELIVERED.has(type)) {
    if (!(await isCurrentlyWorking({ userId }))) return null;
  }
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
  const marketRecipients = await filterEmployeeRecipients(employees.map((e) => e.id), type);
  if (marketRecipients.length === 0) return;
  await prisma.notification.createMany({
    data: marketRecipients.map((employeeId) => ({ employeeId, type, title, body, linkType, linkId })),
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
  const recipients = await filterEmployeeRecipients(employeeIds, type);
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map((employeeId) => ({ employeeId, type, title, body, linkType, linkId })),
  });
}

// Zone-wide counterpart to createNotificationForMarket — fans out to every
// employee whose market belongs to this zone (a Zone Announcement, e.g.).
export async function createNotificationForZone({ zoneId, excludeEmployeeId, type, title, body, linkType, linkId }) {
  const employees = await prisma.employee.findMany({
    where: { market: { zoneId }, id: excludeEmployeeId ? { not: excludeEmployeeId } : undefined },
    select: { id: true },
  });
  const zoneRecipients = await filterEmployeeRecipients(employees.map((e) => e.id), type);
  if (zoneRecipients.length === 0) return;
  await prisma.notification.createMany({
    data: zoneRecipients.map((employeeId) => ({ employeeId, type, title, body, linkType, linkId })),
  });
}
