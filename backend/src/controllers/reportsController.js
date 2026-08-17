import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";

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
    else if (req.user.role === "REGIONAL_MANAGER") where.market = { zoneId: { in: req.user.zoneIds } };

    if (marketId) {
      await assertMarketAccess(req.user, String(marketId));
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
      await assertMarketAccess(req.user, employee.marketId);
    }

    // Aggregated at the DB layer (groupBy) instead of fetching every Task
    // row this employee has ever had just to count them in JS — same
    // approach dashboardController.js already uses. Scales with the
    // number of distinct statuses/types (fixed, small), not with how many
    // tasks the employee has submitted over their whole history.
    const [byStatusRaw, byTypeRaw] = await Promise.all([
      prisma.task.groupBy({ by: ["status"], where: { employeeId: employee.id }, _count: { _all: true } }),
      prisma.task.groupBy({ by: ["type"], where: { employeeId: employee.id }, _count: { _all: true } }),
    ]);

    const countByStatus = Object.fromEntries(byStatusRaw.map((r) => [r.status, r._count._all]));
    const byType = Object.fromEntries(byTypeRaw.map((r) => [r.type, r._count._all]));

    const completedTasks = countByStatus.APPROVED ?? 0;
    const rejectedTasks = countByStatus.REJECTED ?? 0;
    const pendingTasks = (countByStatus.PENDING ?? 0) + (countByStatus.ASSIGNED ?? 0);
    const totalTasks = byStatusRaw.reduce((sum, r) => sum + r._count._all, 0);
    const reviewed = completedTasks + rejectedTasks;
    const approvalRate = reviewed > 0 ? Math.round((completedTasks / reviewed) * 100) : null;

    res.json({
      employee: { id: employee.id, name: employee.name, employeeCode: employee.employeeCode },
      totalTasks,
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
