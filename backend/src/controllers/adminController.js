import { prisma } from "../lib/prisma.js";

// adminController.js — Admin Phase 1: company-wide overview counts and
// global search. Both are ADMIN-only (see admin.routes.js) and both read
// the exact same Zone/Market/Employee/User tables every other part of
// this app already uses — no parallel "admin" data model. Employee rows
// are always shaped to strip passwordHash (see publicEmployee in
// employeesController.js's own comment) — this file does the same
// locally so nothing here can ever leak a credential.

function publicEmployee(e) {
  const { passwordHash, ...rest } = e;
  return rest;
}

// GET /api/admin/overview — real company-wide counts for Admin Home
// (spec §7). Every number here is a live aggregate query, never a
// hardcoded/placeholder figure.
export async function getCompanyOverview(req, res, next) {
  try {
    const [
      zonesCount,
      marketsCount,
      employeesByRole,
      employeesByStatus,
      staffByRole,
    ] = await Promise.all([
      prisma.zone.count(),
      prisma.market.count(),
      prisma.employee.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.employee.groupBy({ by: ["employmentStatus"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    ]);

    const roleCounts = { WORKER: 0, CASHIER: 0, BUTCHER: 0 };
    for (const row of employeesByRole) roleCounts[row.role] = row._count._all;

    const statusCounts = { ACTIVE: 0, INACTIVE: 0, ON_LEAVE: 0 };
    for (const row of employeesByStatus) statusCounts[row.employmentStatus] = row._count._all;

    const staffCounts = { ADMIN: 0, REGIONAL_MANAGER: 0, SUPERVISOR: 0, OVERLOOKING_SUPERVISOR: 0 };
    for (const row of staffByRole) staffCounts[row.role] = row._count._all;

    const totalEmployees = roleCounts.WORKER + roleCounts.CASHIER + roleCounts.BUTCHER;

    res.json({
      zonesCount,
      marketsCount,
      totalEmployees,
      employeesByRole: roleCounts,
      employeesByStatus: statusCounts,
      staffByRole: staffCounts,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/search?q= — Admin Phase 1 §14: a single company-wide
// search across Employee (name/employeeCode), Market (name), and Zone
// (number). Backend-filtered and capped (10 per bucket) — never a
// "fetch everything, filter in the browser" search, and never returns
// anything password/credential-shaped.
export async function globalSearch(req, res, next) {
  try {
    const q = req.query.q;
    const zoneNumber = Number(q.replace(/[^0-9]/g, ""));

    const [employees, markets, zones] = await Promise.all([
      prisma.employee.findMany({
        where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { employeeCode: { contains: q, mode: "insensitive" } }] },
        select: {
          id: true, name: true, role: true, employeeCode: true, marketId: true,
          market: { select: { name: true, zoneId: true } },
        },
        take: 10,
      }),
      prisma.market.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, zoneId: true },
        take: 10,
      }),
      Number.isFinite(zoneNumber) && zoneNumber > 0
        ? prisma.zone.findMany({ where: { number: zoneNumber }, select: { id: true, number: true }, take: 10 })
        : [],
    ]);

    res.json({
      employees: employees.map((e) => publicEmployee(e)),
      markets,
      zones,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/reports/summary?marketId=&zoneId=&dateFrom=&dateTo= —
// Admin Phase 3 §14-15: company-wide administrative reporting, built
// entirely on real aggregate queries over the exact same
// Activity/AttendanceRecord/MarketVisit/AuditLog tables every other
// Admin page already reads — never a fabricated metric. `dateFrom`/
// `dateTo` scope Activities/AuditLog/MarketVisit (default: last 30
// days); Attendance is always "today" (a trend over arbitrary ranges
// isn't derivable from the current AttendanceRecord shape without a
// separate aggregation table this phase doesn't need to build).
export async function getAdminReportsSummary(req, res, next) {
  try {
    const { marketId, zoneId } = req.query;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : new Date();

    const marketFilter = marketId ? { marketId } : zoneId ? { market: { zoneId: Number(zoneId) } } : {};
    const activityMarketFilter = marketId
      ? { OR: [{ employee: { marketId } }, { marketId }] }
      : zoneId
      ? { OR: [{ employee: { market: { zoneId: Number(zoneId) } } }, { market: { zoneId: Number(zoneId) } }] }
      : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      attendanceByStatus,
      activitiesByStatus,
      activitiesByCategory,
      visitsByStatus,
      visitsByType,
      auditByAction,
    ] = await Promise.all([
      prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: today, ...marketFilter }, _count: { _all: true } }),
      prisma.activity.groupBy({ by: ["status"], where: { date: { gte: dateFrom, lte: dateTo }, ...activityMarketFilter }, _count: { _all: true } }),
      prisma.activity.groupBy({ by: ["category"], where: { date: { gte: dateFrom, lte: dateTo }, ...activityMarketFilter }, _count: { _all: true } }),
      prisma.marketVisit.groupBy({ by: ["status"], where: { adminUserId: { not: null }, visitDate: { gte: dateFrom, lte: dateTo }, ...marketFilter }, _count: { _all: true } }),
      prisma.marketVisit.groupBy({ by: ["visitType"], where: { adminUserId: { not: null }, visitDate: { gte: dateFrom, lte: dateTo }, ...marketFilter }, _count: { _all: true } }),
      prisma.auditLog.groupBy({ by: ["action"], where: { createdAt: { gte: dateFrom, lte: dateTo }, ...(marketId ? { marketId } : {}), ...(zoneId ? { zoneId: Number(zoneId) } : {}) }, _count: { _all: true } }),
    ]);

    const toMap = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r._count._all]));

    res.json({
      range: { from: dateFrom, to: dateTo },
      attendance: { date: today, byStatus: toMap(attendanceByStatus, "status") },
      activities: { byStatus: toMap(activitiesByStatus, "status"), byCategory: toMap(activitiesByCategory, "category") },
      visits: { byStatus: toMap(visitsByStatus, "status"), byType: toMap(visitsByType, "visitType") },
      auditActions: toMap(auditByAction, "action"),
    });
  } catch (err) {
    next(err);
  }
}
