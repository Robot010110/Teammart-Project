import { prisma } from "../lib/prisma.js";
import { staffCanAccessMarket } from "../middleware/auth.js";

// suddenTasksController.js — an urgent, ASAP task a Supervisor/Manager/
// Admin pushes directly at an employee. Separate module from Activities
// (employee logs their own work) and from the existing Task model
// (activity-shaped submission workflow) — see the schema.prisma comment
// on SuddenTask for why. Mirrors the access-control shape already used by
// tasksController.js: staffCanAccessMarket() for staff writes,
// req.user.employeeId scoping for everything an employee touches.

// POST /api/sudden-tasks/assign — staff pushes an urgent task to a
// specific employee.
export async function assignSuddenTask(req, res, next) {
  try {
    const { employeeId, title, description, priority } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return res.status(400).json({ error: "employeeId does not refer to an existing employee" });
    }

    const allowed = await staffCanAccessMarket(req.user, employee.marketId);
    if (!allowed || allowed === "not-found") {
      return res.status(403).json({ error: "You do not have access to this employee" });
    }

    const suddenTask = await prisma.suddenTask.create({
      data: {
        title,
        description,
        priority,
        status: "ASSIGNED",
        employeeId,
        marketId: employee.marketId,
        assignedById: req.user.userId,
      },
    });

    res.status(201).json(suddenTask);
  } catch (err) {
    next(err);
  }
}

// GET /api/sudden-tasks?status=&priority=&employeeId=&marketId= — scoped
// by role, same pattern as listTasks in tasksController.js:
//   Employee           -> only their own sudden tasks
//   SUPERVISOR         -> only their market's sudden tasks
//   REGIONAL_MANAGER   -> only their zone's sudden tasks
//   ADMIN               -> everything (filters still apply if given)
export async function listSuddenTasks(req, res, next) {
  try {
    const { status, priority, employeeId, marketId } = req.query;
    let where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (employeeId) where.employeeId = employeeId;
    if (marketId) where.marketId = marketId;

    if (req.user.kind === "employee") {
      where.employeeId = req.user.employeeId; // employees can never see anyone else's sudden tasks
    } else if (req.user.role === "SUPERVISOR") {
      where.marketId = req.user.marketId;
    } else if (req.user.role === "REGIONAL_MANAGER") {
      where.market = { zoneId: req.user.zoneId };
    }

    if (marketId && req.user.kind === "staff") {
      const allowed = await staffCanAccessMarket(req.user, String(marketId));
      if (allowed === "not-found") return res.status(404).json({ error: "Market not found" });
      if (!allowed) return res.status(403).json({ error: "You do not have access to this market" });
    }

    const suddenTasks = await prisma.suddenTask.findMany({
      where,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { assignedAt: "desc" },
    });

    res.json(suddenTasks);
  } catch (err) {
    next(err);
  }
}

// GET /api/sudden-tasks/:id
export async function getSuddenTask(req, res, next) {
  try {
    const suddenTask = await prisma.suddenTask.findUnique({
      where: { id: req.params.id },
      include: { employee: true },
    });
    if (!suddenTask) return res.status(404).json({ error: "Sudden task not found" });

    if (req.user.kind === "employee") {
      if (suddenTask.employeeId !== req.user.employeeId) {
        return res.status(403).json({ error: "You do not have access to this task" });
      }
    } else {
      const allowed = await staffCanAccessMarket(req.user, suddenTask.marketId);
      if (!allowed || allowed === "not-found") {
        return res.status(403).json({ error: "You do not have access to this task" });
      }
    }

    res.json(suddenTask);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/sudden-tasks/:id/complete — employee marks their own sudden
// task as done.
export async function completeSuddenTask(req, res, next) {
  try {
    const suddenTask = await prisma.suddenTask.findUnique({ where: { id: req.params.id } });
    if (!suddenTask) return res.status(404).json({ error: "Sudden task not found" });

    if (suddenTask.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: "This task was not assigned to you" });
    }
    if (suddenTask.status !== "ASSIGNED") {
      return res.status(400).json({ error: `Task is already ${suddenTask.status.toLowerCase()}` });
    }

    const updated = await prisma.suddenTask.update({
      where: { id: req.params.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
