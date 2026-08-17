import { prisma } from "../lib/prisma.js";

// Builds the same { zoneId? / marketId? } scoping used elsewhere, so an
// Admin's dashboard is global, a Regional Manager's is zone-wide, and a
// Supervisor's is market-only.
function scopeWhere(user) {
  if (user.role === "REGIONAL_MANAGER") return { market: { zoneId: { in: user.zoneIds } } };
  if (user.role === "SUPERVISOR") return { marketId: user.marketId };
  return {}; // ADMIN
}

// GET /api/dashboard
export async function getDashboard(req, res, next) {
  try {
    if (req.user.kind === "employee") {
      return getEmployeeDashboard(req, res, next);
    }

    const taskWhere = scopeWhere(req.user);

    const [zonesCount, marketsCount, employeesCount, taskCountsRaw] = await Promise.all([
      req.user.role === "ADMIN"
        ? prisma.zone.count()
        : req.user.role === "REGIONAL_MANAGER"
        ? Promise.resolve(req.user.zoneIds.length)
        : Promise.resolve(null),

      prisma.market.count({
        where:
          req.user.role === "REGIONAL_MANAGER"
            ? { zoneId: { in: req.user.zoneIds } }
            : req.user.role === "SUPERVISOR"
            ? { id: req.user.marketId }
            : undefined,
      }),

      prisma.employee.count({
        where:
          req.user.role === "REGIONAL_MANAGER"
            ? { market: { zoneId: { in: req.user.zoneIds } } }
            : req.user.role === "SUPERVISOR"
            ? { marketId: req.user.marketId }
            : undefined,
      }),

      prisma.task.groupBy({
        by: ["status"],
        where: taskWhere,
        _count: { _all: true },
      }),
    ]);

    const taskCounts = { ASSIGNED: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const row of taskCountsRaw) {
      taskCounts[row.status] = row._count._all;
    }

    const reviewedCount = taskCounts.APPROVED + taskCounts.REJECTED;
    const approvalRate = reviewedCount > 0 ? Math.round((taskCounts.APPROVED / reviewedCount) * 100) : null;

    res.json({
      scope: req.user.role,
      zonesCount,
      marketsCount,
      employeesCount,
      tasks: taskCounts,
      approvalRate,
    });
  } catch (err) {
    next(err);
  }
}

// Personal dashboard for an Employee — their own task counts only.
async function getEmployeeDashboard(req, res, next) {
  try {
    const taskCountsRaw = await prisma.task.groupBy({
      by: ["status"],
      where: { employeeId: req.user.employeeId },
      _count: { _all: true },
    });

    const taskCounts = { ASSIGNED: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const row of taskCountsRaw) {
      taskCounts[row.status] = row._count._all;
    }

    const reviewedCount = taskCounts.APPROVED + taskCounts.REJECTED;
    const approvalRate = reviewedCount > 0 ? Math.round((taskCounts.APPROVED / reviewedCount) * 100) : null;

    res.json({ scope: "EMPLOYEE", tasks: taskCounts, approvalRate });
  } catch (err) {
    next(err);
  }
}
