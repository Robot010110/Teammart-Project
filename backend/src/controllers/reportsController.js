import { prisma } from "../lib/prisma.js";
import { staffCanAccessMarket } from "../middleware/auth.js";

// GET /api/reports/tasks?from=&to=&marketId=&status=
// A basic activity report: every task in a date range, scoped by role,
// plus a small summary block. Meant to back a simple "Reports" page —
// swap this for a heavier aggregation query later if needed.
export async function tasksReport(req, res, next) {
  try {
    const { from, to, marketId, status } = req.query;

    let where = {};
    if (status) where.status = status;
    if (from || to) {
      where.submittedAt = {};
      if (from) where.submittedAt.gte = new Date(from);
      if (to) where.submittedAt.lte = new Date(to);
    }
    if (marketId) where.marketId = marketId;

    if (req.user.role === "SUPERVISOR") where.marketId = req.user.marketId;
    else if (req.user.role === "REGIONAL_MANAGER") where.market = { zoneId: req.user.zoneId };

    if (marketId) {
      const allowed = await staffCanAccessMarket(req.user, String(marketId));
      if (allowed === "not-found") return res.status(404).json({ error: "Market not found" });
      if (!allowed) return res.status(403).json({ error: "You do not have access to this market" });
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    const summary = tasks.reduce(
      (acc, t) => {
        acc.total += 1;
        acc.byStatus[t.status] = (acc.byStatus[t.status] ?? 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} }
    );

    res.json({ summary, tasks });
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/employees/:id/summary
// Loosely mirrors the shape of the frontend's generatePerformanceStats
// mock, but built from real Task rows.
export async function employeeSummaryReport(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    if (req.user.kind === "employee") {
      if (req.user.employeeId !== employee.id) {
        return res.status(403).json({ error: "You do not have access to this employee" });
      }
    } else {
      const allowed = await staffCanAccessMarket(req.user, employee.marketId);
      if (!allowed || allowed === "not-found") {
        return res.status(403).json({ error: "You do not have access to this employee" });
      }
    }

    const tasks = await prisma.task.findMany({ where: { employeeId: employee.id } });

    const completedTasks = tasks.filter((t) => t.status === "APPROVED").length;
    const rejectedTasks = tasks.filter((t) => t.status === "REJECTED").length;
    const pendingTasks = tasks.filter((t) => t.status === "PENDING" || t.status === "ASSIGNED").length;
    const reviewed = completedTasks + rejectedTasks;
    const approvalRate = reviewed > 0 ? Math.round((completedTasks / reviewed) * 100) : null;

    const byType = tasks.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] ?? 0) + 1;
      return acc;
    }, {});

    res.json({
      employee: { id: employee.id, name: employee.name, employeeCode: employee.employeeCode },
      totalTasks: tasks.length,
      completedTasks,
      rejectedTasks,
      pendingTasks,
      approvalRate,
      byType,
    });
  } catch (err) {
    next(err);
  }
}
