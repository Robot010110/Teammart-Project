import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";
import { createNotificationForUser } from "../utils/notifications.js";

// wastedOverallController.js — a Worker reporting wasted produce (Eggs,
// Tomato, Potato, Cucumber, Onion), routed automatically to their
// market's Supervisor. Deliberately its own module, not ItemReport: see
// the WastedOverallReport schema comment for why (ItemReport is hard-tied
// to a real Product with an unconditional stock-decrement side effect;
// none of that applies to a fixed produce list with no catalog entry).

// POST /api/wasted-overall — employee-only. employeeId/marketId are
// always derived from the authenticated token, never trusted from the
// request body — the frontend cannot report on behalf of another
// employee or market.
export async function createWastedOverallReport(req, res, next) {
  try {
    const { item, quantityKg, quantityCount, otherItemName, photoUrl, notes } = req.body;
    const employeeId = req.user.employeeId;
    const marketId = req.user.marketId;

    const report = await prisma.wastedOverallReport.create({
      data: { item, quantityKg, quantityCount, otherItemName, photoUrl, notes, employeeId, marketId },
    });

    // Route to the market's Supervisor automatically — the employee never
    // picks one. A market may have no Supervisor assigned yet (nullable
    // relation); the report still exists, it just goes un-notified until
    // one is.
    const market = await prisma.market.findUnique({ where: { id: marketId }, select: { supervisorId: true } });
    if (market?.supervisorId) {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true } });
      const itemLabel = item === "OTHER" ? otherItemName : item.toLowerCase();
      const quantityLabel = item === "EGGS" ? `${quantityCount} egg${quantityCount === 1 ? "" : "s"}` : `${quantityKg}kg`;
      await createNotificationForUser({
        userId: market.supervisorId,
        type: "WASTED_OVERALL",
        title: "Wasted Overall Report",
        body: `${employee.name} reported ${quantityLabel} of ${itemLabel} wasted.`,
        linkType: "WASTED_OVERALL",
        linkId: report.id,
      });
    }

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
}

// GET /api/wasted-overall — the current employee's own submitted reports.
export async function listMyWastedOverallReports(req, res, next) {
  try {
    const reports = await prisma.wastedOverallReport.findMany({
      where: { employeeId: req.user.employeeId },
      orderBy: { reportedAt: "desc" },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
}

// GET /api/wasted-overall/market?marketId=&status= — staff-only, scoped
// to a market they can access (Supervisor: only their own market;
// Regional Manager: only markets in their zone; Admin: any). No frontend
// caller yet (no Supervisor review screen exists anywhere in this app) —
// same "backend-ready" pattern as every other staff-only endpoint here.
export async function listWastedOverallReportsForMarket(req, res, next) {
  try {
    const { status } = req.query;
    const marketId = req.query.marketId ?? req.user.marketId;
    if (!marketId) {
      return res.status(400).json({ error: "marketId is required" });
    }
    await assertMarketAccess(req.user, marketId);

    const where = { marketId };
    if (status) where.status = status;

    const reports = await prisma.wastedOverallReport.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: { reportedAt: "desc" },
    });

    res.json(reports);
  } catch (err) {
    next(err);
  }
}
