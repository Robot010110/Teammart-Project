import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, requireAccessibleEmployee } from "../middleware/auth.js";

// POST /api/tasks — an Employee submits a completed activity on their own
// initiative (the common case: "Refilling Update", "Shelf Facing", etc.).
// employeeId/marketId come from the token, never from the request body —
// an employee can only ever create a task for themselves.
export async function submitTask(req, res, next) {
  try {
    const { type, label, department, notes, requiresPhoto, beforePhotoUrl, afterPhotoUrl } = req.body;

    const task = await prisma.task.create({
      data: {
        type,
        label,
        department,
        notes,
        requiresPhoto,
        beforePhotoUrl,
        afterPhotoUrl,
        status: "PENDING",
        employeeId: req.user.employeeId,
        marketId: req.user.marketId,
      },
    });

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

// POST /api/tasks/assign — a Supervisor/Regional Manager/Admin proactively
// assigns a task to a specific employee.
export async function assignTask(req, res, next) {
  try {
    const { employeeId, type, label, department, notes, requiresPhoto } = req.body;

    const employee = await requireAccessibleEmployee(req.user, employeeId);

    const task = await prisma.task.create({
      data: {
        type,
        label,
        department,
        notes,
        requiresPhoto,
        status: "ASSIGNED",
        employeeId,
        marketId: employee.marketId,
        assignedById: req.user.userId,
      },
    });

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tasks/:id/submit — an Employee marks their own ASSIGNED task
// as done, moving it to PENDING for review. (Self-submitted tasks skip
// this step entirely — they start at PENDING already.)
export async function submitAssignedTask(req, res, next) {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: "This task was not assigned to you" });
    }
    if (task.status !== "ASSIGNED") {
      return res.status(400).json({ error: `Task is already ${task.status.toLowerCase()}` });
    }

    const { notes, beforePhotoUrl, afterPhotoUrl } = req.body;

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        status: "PENDING",
        notes: notes ?? task.notes,
        beforePhotoUrl,
        afterPhotoUrl,
        submittedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/tasks?status=&employeeId=&marketId= — scoped by role:
//   Employee           -> only their own tasks
//   SUPERVISOR         -> only their market's tasks
//   REGIONAL_MANAGER   -> only their zone's tasks
//   ADMIN               -> everything (filters still apply if given)
export async function listTasks(req, res, next) {
  try {
    const { status, employeeId, marketId } = req.query;
    let where = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    if (marketId) where.marketId = marketId;

    if (req.user.kind === "employee") {
      where.employeeId = req.user.employeeId; // employees can never see anyone else's tasks
    } else if (req.user.role === "SUPERVISOR") {
      where.marketId = req.user.marketId;
    } else if (req.user.role === "REGIONAL_MANAGER") {
      where.market = { zoneId: req.user.zoneId };
    }

    // If a staff member explicitly asked for a marketId, verify they can
    // actually see it (otherwise they'd learn whether it exists from a
    // 200-vs-empty-array response, a minor info leak).
    if (marketId && req.user.kind === "staff") {
      await assertMarketAccess(req.user, String(marketId));
    }

    const tasks = await prisma.task.findMany({
      where,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { submittedAt: "desc" },
    });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

// GET /api/tasks/:id
export async function getTask(req, res, next) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { employee: true },
    });
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (req.user.kind === "employee") {
      if (task.employeeId !== req.user.employeeId) {
        return res.status(403).json({ error: "You do not have access to this task" });
      }
    } else {
      await assertMarketAccess(req.user, task.marketId);
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tasks/:id/approve — staff only, scoped to their market/zone.
export async function approveTask(req, res, next) {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ error: "Task not found" });

    await assertMarketAccess(req.user, task.marketId);
    if (task.status !== "PENDING") {
      return res.status(400).json({ error: `Only PENDING tasks can be approved (this one is ${task.status})` });
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: { status: "APPROVED", reviewedById: req.user.userId, reviewedAt: new Date(), rejectionReason: null },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tasks/:id/reject — staff only, scoped to their market/zone.
export async function rejectTask(req, res, next) {
  try {
    const { rejectionReason } = req.body;

    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ error: "Task not found" });

    await assertMarketAccess(req.user, task.marketId);
    if (task.status !== "PENDING") {
      return res.status(400).json({ error: `Only PENDING tasks can be rejected (this one is ${task.status})` });
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: { status: "REJECTED", reviewedById: req.user.userId, reviewedAt: new Date(), rejectionReason },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
