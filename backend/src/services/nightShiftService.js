import { prisma } from "../lib/prisma.js";
import { getCurrentDepartments } from "../controllers/employeesController.js";
import { createNotificationForUser } from "../utils/notifications.js";

// nightShiftService.js — Night Shift §9-10: idempotent daily task
// generation and the operational-shift-date calculation every Night
// Shift feature (generation, completion, reporting) shares. This is the
// ONE place both live, so generation and completion can never disagree
// about which day tonight's shift belongs to.

// A Night Shift crosses midnight (spec §10: 10 PM start, 1:30 AM
// completion belongs to the PREVIOUS day). Anything before noon is
// treated as still "last night's" shift; noon onward starts counting
// toward tonight. This single rule is used both when GENERATING
// tonight's tasks (whatever the actual hour, "tonight" resolves the
// same way) and when a completion is submitted, so the two can never
// drift apart. Day-only (time zeroed), matching AttendanceRecord.date's
// own "day-only" convention.
export function operationalDateFor(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 12) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Which employees are eligible for a given NightShiftTaskDefinition
// right now — Night Shift, ACTIVE employment/account status, and within
// the definition's market/zone/department restriction (all nullable =
// "no restriction on this axis"). Inactive/suspended employees are
// excluded here so they simply never receive new instances (spec §25) —
// their historical rows are untouched (nothing here ever deletes/edits
// an existing Activity).
async function eligibleEmployeesFor(definition) {
  const where = {
    operationalShift: "NIGHT",
    employmentStatus: "ACTIVE",
    accountStatus: "ACTIVE",
  };
  if (definition.marketId) where.marketId = definition.marketId;
  else if (definition.zoneId) where.market = { zoneId: definition.zoneId };

  const candidates = await prisma.employee.findMany({ where, select: { id: true, marketId: true } });
  if (!definition.departmentRestriction) return candidates;

  // Department restriction checks BOTH main and additional
  // responsibilities (spec §4: "the employee must receive activities
  // appropriate to all authorized responsibilities").
  const eligible = [];
  for (const employee of candidates) {
    const { main, additional } = await getCurrentDepartments(employee.id);
    if (main === definition.departmentRestriction || additional.includes(definition.departmentRestriction)) {
      eligible.push(employee);
    }
  }
  return eligible;
}

// Generates today's Night Shift task instances (as Activity rows,
// category NIGHT_SHIFT_TASK) for every active NightShiftTaskDefinition
// and every eligible employee, for the CURRENT operational date. Safe to
// call any number of times — createMany's skipDuplicates relies on the
// exact same @@unique([employeeId, nightShiftTaskDefinitionId,
// operationalDate]) constraint Activity already has (spec §9: "repeated
// calls must safely produce the same result"). Called both lazily (see
// nightShiftController.getMyNightShiftDashboard) and from the periodic
// maintenance sweep — same dual pattern already established for Break
// completion in maintenanceScheduler.js, "whichever runs first wins".
export async function generateNightShiftTasks(now = new Date()) {
  const operationalDate = operationalDateFor(now);
  const definitions = await prisma.nightShiftTaskDefinition.findMany({ where: { active: true } });

  let created = 0;
  for (const definition of definitions) {
    const employees = await eligibleEmployeesFor(definition);
    if (employees.length === 0) continue;

    const result = await prisma.activity.createMany({
      data: employees.map((e) => ({
        category: "NIGHT_SHIFT_TASK",
        date: operationalDate,
        time: "00:00",
        status: "DRAFT",
        employeeId: e.id,
        marketId: e.marketId,
        nightShiftTaskDefinitionId: definition.id,
        operationalDate,
      })),
      skipDuplicates: true,
    });
    created += result.count;
  }
  return { operationalDate, created };
}

// Night Shift §17-18 — find-or-create this MARKET's own Night Shift
// group (spec's own concrete example is market-named — "Qushtapa 1
// Night Shifters" — even though the surrounding prose says "zone"; a
// market is the granularity that actually makes sense for a physical,
// market-specific action like Washing Market, so this follows the
// example rather than the looser prose). Reuses the existing
// CUSTOM_GROUP mechanism — same table, same conversationAccessFor
// authorization every other group already goes through — never a new
// chat concept. Auto-membership: only ever adds employees this exact
// function itself resolved as eligible, never anything client-supplied,
// so an employee can't manipulate their way into another market's group.
async function findOrCreateNightShiftGroup(marketId) {
  const market = await prisma.market.findUnique({ where: { id: marketId }, select: { name: true } });
  if (!market) return null;
  const name = `${market.name} Night Shifters`;

  let group = await prisma.conversation.findFirst({ where: { type: "CUSTOM_GROUP", marketId, name } });
  if (!group) {
    group = await prisma.conversation.create({ data: { type: "CUSTOM_GROUP", marketId, name, groupType: "NORMAL" } });
  }
  return group;
}

// Night Shift §18-21 — after a Washing Market (or any Night Shift task)
// completion succeeds, post to the market's Night Shift group and
// notify its Supervisor/Overlooking Supervisor. Called AFTER the
// Activity row is already committed (see activitiesController.
// updateActivity) — every failure here is caught and logged, never
// re-thrown, so a chat/notification hiccup can never roll back or hide
// a real completion (spec §19/§21: "do not roll back the completed
// task... make failures observable rather than silently ignoring them").
export async function notifyNightShiftCompletion(activity) {
  try {
    const [employee, definition, imageCount] = await Promise.all([
      prisma.employee.findUnique({ where: { id: activity.employeeId }, select: { name: true, marketId: true, market: { select: { name: true, supervisorId: true, overlookingSupervisorId: true } } } }),
      activity.nightShiftTaskDefinitionId
        ? prisma.nightShiftTaskDefinition.findUnique({ where: { id: activity.nightShiftTaskDefinitionId }, select: { name: true } })
        : null,
      prisma.activityImage.count({ where: { activityId: activity.id } }),
    ]);
    if (!employee) return;

    const taskName = definition?.name ?? "Night Shift Task";
    const timeLabel = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const body = `${taskName} Completed\nEmployee: ${employee.name}\nMarket: ${employee.market.name}\nTime: ${timeLabel}\nPhotos: ${imageCount}`;

    const group = await findOrCreateNightShiftGroup(employee.marketId);
    if (group) {
      await prisma.conversationMember.upsert({
        where: { conversationId_employeeId: { conversationId: group.id, employeeId: activity.employeeId } },
        update: {},
        create: { conversationId: group.id, employeeId: activity.employeeId },
      });
      await prisma.message.create({ data: { conversationId: group.id, body, senderEmployeeId: activity.employeeId } });
    }

    const recipients = [employee.market.supervisorId, employee.market.overlookingSupervisorId].filter(Boolean);
    await Promise.all(
      recipients.map((userId) =>
        createNotificationForUser({
          userId,
          type: "NIGHT_SHIFT_TASK_COMPLETED",
          title: `${taskName} Completed`,
          body: `${employee.name} completed ${taskName} at ${employee.market.name} — ${timeLabel}.`,
          linkType: "ACTIVITY",
          linkId: activity.id,
        })
      )
    );
  } catch (err) {
    // Never let a chat/notification failure hide or roll back a real
    // completion — logged for retry/investigation, nothing thrown.
    console.error(`Night Shift completion notification failed for activity ${activity.id}:`, err);
  }
}
