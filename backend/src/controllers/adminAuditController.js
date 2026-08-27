import { prisma } from "../lib/prisma.js";

// adminAuditController.js — Admin Phase 3 §13/§28: read access to the
// audit log. No update/delete route exists anywhere in this app for
// AuditLog — append-only by omission, not by a permission check (there
// is simply nothing to call). Paginated so this never returns the whole
// history in one response (spec §16).
export async function listAuditLog(req, res, next) {
  try {
    const { actorUserId, action, targetType, marketId, zoneId, dateFrom, dateTo, page = 1, pageSize = 25 } = req.query;

    const where = {};
    if (actorUserId) where.actorUserId = actorUserId;
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (marketId) where.marketId = marketId;
    if (zoneId) where.zoneId = zoneId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [total, entries] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, role: true } },
          market: { select: { id: true, name: true } },
          zone: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({ total, page, pageSize, entries });
  } catch (err) {
    next(err);
  }
}
