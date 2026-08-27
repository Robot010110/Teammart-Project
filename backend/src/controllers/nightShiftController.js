import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";
import { getCurrentDepartments } from "./employeesController.js";
import { generateNightShiftTasks, operationalDateFor } from "../services/nightShiftService.js";

// nightShiftController.js — Night Shift task-definition management
// (ADMIN) and the employee-facing dashboard/completion-history read
// paths. Reuses the existing Activity/ActivityImage tables and the
// existing generic Activity endpoints (PATCH /api/activities/:id for
// submission, POST /api/activities/:id/images for evidence) for the
// actual completion workflow — see activitiesController.updateActivity's
// own Night Shift extension. This file only adds what's genuinely new:
// the reusable task-definition CRUD and the "what should I do tonight"
// aggregation view.

// GET /api/night-shift/task-definitions — any staff role can read (they
// all need visibility into what Night Shift tasks exist for management
// purposes); only ADMIN can write (below).
export async function listTaskDefinitions(req, res, next) {
  try {
    const definitions = await prisma.nightShiftTaskDefinition.findMany({
      include: { market: { select: { id: true, name: true } }, zone: { select: { id: true, number: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(definitions);
  } catch (err) {
    next(err);
  }
}

// POST /api/night-shift/task-definitions — ADMIN-only (route-gated).
// `key` is a stable machine identifier ("WASHING_MARKET") — the seed
// script and any future built-in task both key off this, never a
// generated id, so re-running provisioning is idempotent.
export async function createTaskDefinition(req, res, next) {
  try {
    const { key, name, description, shift, departmentRestriction, marketId, zoneId, requiresEvidence, minPhotos, frequency, dueTime, reviewRequired } = req.body;

    const existing = await prisma.nightShiftTaskDefinition.findUnique({ where: { key } });
    if (existing) return res.status(409).json({ error: "A task definition with this key already exists" });

    if (marketId) {
      const market = await prisma.market.findUnique({ where: { id: marketId } });
      if (!market) return res.status(404).json({ error: "Market not found" });
    }
    if (zoneId) {
      const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) return res.status(404).json({ error: "Zone not found" });
    }

    const created = await prisma.nightShiftTaskDefinition.create({
      data: {
        key, name, description, shift: shift ?? "NIGHT", departmentRestriction: departmentRestriction ?? null,
        marketId: marketId ?? null, zoneId: zoneId ?? null,
        requiresEvidence: requiresEvidence ?? false, minPhotos: minPhotos ?? 0,
        frequency: frequency ?? "DAILY", dueTime: dueTime ?? null, reviewRequired: reviewRequired ?? false,
        createdById: req.user.userId,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/night-shift/task-definitions/:id — ADMIN-only. Partial
// update — most commonly toggling `active` (spec §8's own
// "Active/inactive configuration").
export async function updateTaskDefinition(req, res, next) {
  try {
    const definition = await prisma.nightShiftTaskDefinition.findUnique({ where: { id: req.params.id } });
    if (!definition) return res.status(404).json({ error: "Task definition not found" });

    const updated = await prisma.nightShiftTaskDefinition.update({ where: { id: definition.id }, data: req.body });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/night-shift/my-dashboard — employee-only. "What should I do
// tonight" (spec §7/§29): main/additional department responsibilities,
// operational shift date, and today's Night Shift task instances
// (already-generated Activity rows — see the lazy-generation call below)
// each shaped with its task definition and live evidence count. Daily
// Tasks/Sudden Tasks/main-and-additional-department Activities in other
// categories are deliberately NOT duplicated here — the existing
// GET /api/activities and GET /api/sudden-tasks endpoints already return
// those, correctly scoped to this same employee.
export async function getMyNightShiftDashboard(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.user.employeeId } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const { main, additional } = await getCurrentDepartments(employee.id);
    const operationalDate = operationalDateFor();

    if (employee.operationalShift === "NIGHT" && employee.employmentStatus === "ACTIVE" && employee.accountStatus === "ACTIVE") {
      // Lazy on-read generation (spec §9's "on-demand idempotent
      // generation") — safe to call every time this dashboard loads;
      // the periodic sweep in maintenanceScheduler.js covers employees
      // who never open the app. createMany's skipDuplicates means this
      // is a cheap no-op once tonight's tasks already exist.
      await generateNightShiftTasks();
    }

    const tasks = await prisma.activity.findMany({
      where: { employeeId: employee.id, category: "NIGHT_SHIFT_TASK", operationalDate },
      include: { images: true, nightShiftTaskDefinition: true },
      orderBy: { createdAt: "asc" },
    });

    const now = new Date();
    const shaped = tasks.map((t) => {
      const def = t.nightShiftTaskDefinition;
      let derivedStatus = t.status; // DRAFT / PENDING / APPROVED / REJECTED
      let label = t.status === "DRAFT" ? (t.images.length > 0 ? "In Progress" : "Not Started") : t.status === "PENDING" ? "Completed" : t.status;
      if (t.status === "DRAFT" && def?.dueTime) {
        const [h, m] = def.dueTime.split(":").map(Number);
        const due = new Date(operationalDate);
        due.setDate(due.getDate() + 1); // dueTime is a morning cutoff for the PREVIOUS night's operational date
        due.setHours(h ?? 6, m ?? 0, 0, 0);
        if (now > due) label = "Overdue";
      }
      return {
        id: t.id,
        key: def?.key,
        name: def?.name,
        description: def?.description,
        requiresEvidence: def?.requiresEvidence ?? false,
        minPhotos: def?.minPhotos ?? 0,
        photoCount: t.images.length,
        status: derivedStatus,
        label,
        images: t.images,
      };
    });

    res.json({
      employeeId: employee.id,
      marketId: employee.marketId,
      operationalShift: employee.operationalShift,
      operationalDate,
      mainDepartment: main,
      additionalDepartments: additional,
      tasks: shaped,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/night-shift/market/:marketId — staff-only management view
// (spec §28-29): every Night Shift task instance for a market, most
// recent first, capped like every other Admin/Supervisor listing in
// this app (never an unbounded query).
export async function listNightShiftActivityForMarket(req, res, next) {
  try {
    const marketId = req.params.marketId;
    await assertMarketAccess(req.user, marketId);

    // Filters on the Activity's OWN marketId (frozen at creation time —
    // see generateNightShiftTasks), never the employee's CURRENT
    // marketId. An employee reassigned to a different market after
    // completing a task here must not have that historical completion
    // silently move markets — spec §26-27/Rule 6: "old completed
    // activities must keep showing the ORIGINAL historical context,
    // never resolved from current employee values." Found during audit —
    // the previous `employee: { marketId }` filter would have both hidden
    // a reassigned employee's past completions from their original
    // market AND, incorrectly, shown them under the new one.
    const activities = await prisma.activity.findMany({
      where: { category: "NIGHT_SHIFT_TASK", marketId },
      include: {
        images: true,
        nightShiftTaskDefinition: true,
        employee: { select: { id: true, name: true, employeeCode: true, operationalShift: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.json(activities);
  } catch (err) {
    next(err);
  }
}
