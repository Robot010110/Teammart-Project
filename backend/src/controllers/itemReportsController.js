import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";

// itemReportsController.js — the Expired/Wasted Items module. An employee
// identifies a Product (barcode scan or photo -> manual search on the
// frontend, see ItemReportFlow.jsx) and reports a quantity as expired or
// wasted. Submitting immediately decrements Product.stockQuantity in the
// same transaction as creating the report — no manual inventory
// adjustment from a supervisor required, per the spec. The decrement is
// unconditional (can go negative): a negative stock value is itself a
// useful signal that the recorded stock was already wrong, not an error
// to hide from the employee mid-report.

// POST /api/item-reports — employee-only.
export async function createItemReport(req, res, next) {
  try {
    const { productId, condition, quantity, notes, imageUrl } = req.body;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(400).json({ error: "productId does not refer to an existing product" });
    }
    if (product.marketId !== req.user.marketId) {
      return res.status(403).json({ error: "This product does not belong to your market" });
    }

    const [report] = await prisma.$transaction([
      prisma.itemReport.create({
        data: {
          condition,
          quantity,
          notes,
          imageUrl,
          productId,
          employeeId: req.user.employeeId,
          marketId: req.user.marketId,
        },
      }),
      prisma.product.update({
        where: { id: productId },
        data: { stockQuantity: { decrement: quantity } },
      }),
    ]);

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
}

// GET /api/item-reports?year=&month= — the current employee's own reports
// for a given month, defaulting to the current month.
export async function listItemReports(req, res, next) {
  try {
    const now = new Date();
    const year = req.query.year ?? now.getFullYear();
    const month = req.query.month ?? now.getMonth() + 1; // 1-12

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1); // exclusive upper bound

    const reports = await prisma.itemReport.findMany({
      where: {
        employeeId: req.user.employeeId,
        reportedAt: { gte: monthStart, lt: monthEnd },
      },
      include: { product: { select: { id: true, name: true, barcode: true } } },
      orderBy: { reportedAt: "desc" },
    });

    res.json(reports);
  } catch (err) {
    next(err);
  }
}

// GET /api/item-reports/market?marketId=&employeeId=&condition=&status= —
// staff-only, scoped to a market they can access (Supervisor: only their
// own market). Powers the Supervisor "Today's Activity" feed and an
// employee's Activity History — mirrors the exact pattern already used by
// wastedOverallController.listWastedOverallReportsForMarket /
// priceReportsController's market-scoped listing.
export async function listItemReportsForMarket(req, res, next) {
  try {
    const { employeeId, condition, status } = req.query;
    const marketId = req.query.marketId ?? req.user.marketId;
    if (!marketId) {
      return res.status(400).json({ error: "marketId is required" });
    }
    await assertMarketAccess(req.user, marketId);

    const where = { marketId };
    if (employeeId) where.employeeId = employeeId;
    if (condition) where.condition = condition;
    if (status) where.status = status;

    const reports = await prisma.itemReport.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        product: { select: { id: true, name: true, barcode: true } },
      },
      orderBy: { reportedAt: "desc" },
    });

    res.json(reports);
  } catch (err) {
    next(err);
  }
}
