import { prisma } from "../lib/prisma.js";
import { recordAudit } from "../utils/audit.js";
import { createNotificationForUser } from "../utils/notifications.js";

// adminVisitController.js — Admin Phase 3 §1-8: formal Market Visits and
// Administrative Inspections. Both share the EXISTING MarketVisit table
// (already used by Regional Manager's own lightweight visit-grouping
// flow — marketManagementController.createMarketVisit) rather than a new
// AdminVisit/Inspection table, distinguished by adminUserId (set here,
// never for an RM's plain grouping visit) + visitType + status. Never
// touches an RM's own createMarketVisit endpoint or its rows.

function shapeVisit(v) {
  return {
    id: v.id,
    marketId: v.marketId,
    marketName: v.market?.name,
    zoneId: v.market?.zoneId,
    adminUserId: v.adminUserId,
    adminName: v.adminUser?.name,
    visitType: v.visitType,
    status: v.status,
    startedAt: v.visitDate,
    endedAt: v.endedAt,
    notes: v.adminNotes,
  };
}

// POST /api/admin/markets/:marketId/visits — starts a formal Market
// Visit or Administrative Inspection (body: { visitType, notes? }).
// Explicit action only — opening the Market page elsewhere never
// creates one of these (spec §1's own "do not treat a normal market
// page open as automatically being an administrative visit").
export async function startMarketVisit(req, res, next) {
  try {
    const market = await prisma.market.findUnique({ where: { id: req.params.marketId }, select: { id: true, name: true, zoneId: true, supervisorId: true } });
    if (!market) return res.status(404).json({ error: "Market not found" });

    // One open (STARTED) visit per Admin at a time — prevents an
    // accidental duplicate start (spec §26's "prevent duplicate visit
    // creation where inappropriate") without needing a DB constraint
    // that would also have to account for RM's own unrelated rows.
    const openVisit = await prisma.marketVisit.findFirst({
      where: { adminUserId: req.user.userId, status: "STARTED" },
    });
    if (openVisit) {
      return res.status(409).json({ error: "You already have an open Market Visit/Inspection — complete or cancel it first.", visitId: openVisit.id });
    }

    const visitType = req.body.visitType === "INSPECTION" ? "INSPECTION" : "VISIT";

    const visit = await prisma.marketVisit.create({
      data: {
        marketId: market.id,
        adminUserId: req.user.userId,
        visitType,
        status: "STARTED",
        adminNotes: req.body.notes ?? null,
      },
      include: { market: { select: { name: true, zoneId: true } }, adminUser: { select: { name: true } } },
    });

    await recordAudit({
      actorUserId: req.user.userId,
      action: visitType === "INSPECTION" ? "INSPECTION_STARTED" : "MARKET_VISIT_STARTED",
      targetType: "Market", targetId: market.id, marketId: market.id, zoneId: market.zoneId,
      metadata: { visitId: visit.id, visitType },
    });

    // Notify the market's Supervisor (spec §3) — never a substitute
    // recipient if the market has none (spec's own explicit instruction).
    if (market.supervisorId) {
      await createNotificationForUser({
        userId: market.supervisorId,
        type: "MARKET_VISIT",
        title: "Administrative Market Visit",
        body: `${visit.adminUser?.name ?? "An administrator"} ${visitType === "INSPECTION" ? "started an inspection at" : "visited"} ${market.name}.`,
        linkType: null,
        linkId: null,
      });
    }

    res.status(201).json(shapeVisit(visit));
  } catch (err) {
    next(err);
  }
}

async function loadOwnOpenVisit(req) {
  const visit = await prisma.marketVisit.findUnique({
    where: { id: req.params.visitId },
    include: { market: { select: { name: true, zoneId: true } }, adminUser: { select: { name: true } } },
  });
  if (!visit || visit.adminUserId !== req.user.userId) return null;
  return visit;
}

// PATCH /api/admin/visits/:visitId/complete — body: { notes? }
export async function completeMarketVisit(req, res, next) {
  try {
    const visit = await loadOwnOpenVisit(req);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    if (visit.status !== "STARTED") {
      return res.status(400).json({ error: `This visit is already ${visit.status.toLowerCase()} and cannot be completed again.` });
    }

    const updated = await prisma.marketVisit.update({
      where: { id: visit.id },
      data: { status: "COMPLETED", endedAt: new Date(), adminNotes: req.body.notes ?? visit.adminNotes },
      include: { market: { select: { name: true, zoneId: true } }, adminUser: { select: { name: true } } },
    });

    await recordAudit({
      actorUserId: req.user.userId,
      action: visit.visitType === "INSPECTION" ? "INSPECTION_COMPLETED" : "MARKET_VISIT_COMPLETED",
      targetType: "Market", targetId: visit.marketId, marketId: visit.marketId, zoneId: visit.market.zoneId,
      metadata: { visitId: visit.id }, reason: req.body.notes,
    });

    res.json(shapeVisit(updated));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/visits/:visitId/cancel — body: { reason? }
export async function cancelMarketVisit(req, res, next) {
  try {
    const visit = await loadOwnOpenVisit(req);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    if (visit.status !== "STARTED") {
      return res.status(400).json({ error: `This visit is already ${visit.status.toLowerCase()} and cannot be cancelled.` });
    }

    const updated = await prisma.marketVisit.update({
      where: { id: visit.id },
      data: { status: "CANCELLED", endedAt: new Date() },
      include: { market: { select: { name: true, zoneId: true } }, adminUser: { select: { name: true } } },
    });

    await recordAudit({
      actorUserId: req.user.userId,
      action: visit.visitType === "INSPECTION" ? "INSPECTION_CANCELLED" : "MARKET_VISIT_CANCELLED",
      targetType: "Market", targetId: visit.marketId, marketId: visit.marketId, zoneId: visit.market.zoneId,
      metadata: { visitId: visit.id }, reason: req.body.reason,
    });

    res.json(shapeVisit(updated));
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/visits?marketId=&zoneId=&status=&adminUserId=&page=&pageSize=
// — Admin Phase 3 §4: this Admin's own visits by default; company-wide
// when explicitly filtered by another adminUserId (Admin is already
// company-wide — spec §4's "broader visibility where business rules
// allow"). Paginated, never the whole history in one response.
export async function listMarketVisits(req, res, next) {
  try {
    const { marketId, zoneId, status, adminUserId, page = 1, pageSize = 25 } = req.query;

    const where = { adminUserId: { not: null } };
    if (marketId) where.marketId = marketId;
    if (zoneId) where.market = { zoneId };
    if (status) where.status = status;
    if (adminUserId) where.adminUserId = adminUserId;

    const [total, visits] = await Promise.all([
      prisma.marketVisit.count({ where }),
      prisma.marketVisit.findMany({
        where,
        include: { market: { select: { name: true, zoneId: true } }, adminUser: { select: { name: true } } },
        orderBy: { visitDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({ total, page, pageSize, visits: visits.map(shapeVisit) });
  } catch (err) {
    next(err);
  }
}
