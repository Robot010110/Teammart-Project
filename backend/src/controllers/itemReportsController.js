import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";
import { createNotificationForUser } from "../utils/notifications.js";

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

    // Cleanup Phase §6 — route straight to the market's own Supervisor,
    // the same fire-and-forget pattern already used for Wasted Overall
    // (wastedOverallController.js) and Department Closing. Never Admin —
    // Admin only ever sees this via its own separate global dashboards
    // (AdminActivitiesPage/AdminReportsPage), not because a report is
    // "sent" there.
    const market = await prisma.market.findUnique({ where: { id: req.user.marketId }, select: { supervisorId: true, overlookingSupervisorId: true } });
    const recipients = [market?.supervisorId, market?.overlookingSupervisorId].filter(Boolean);
    if (recipients.length) {
      const employee = await prisma.employee.findUnique({ where: { id: req.user.employeeId }, select: { name: true } });
      await Promise.all(
        recipients.map((userId) =>
          createNotificationForUser({
            userId,
            type: "EMPLOYEE_REPORT_SUBMITTED",
            title: "Item Report Submitted",
            body: `${employee.name} reported ${quantity} unit${quantity === 1 ? "" : "s"} of ${product.name} as ${condition.toLowerCase()}.`,
            linkType: "ITEM_REPORT",
            linkId: report.id,
          })
        )
      );
    }

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
        deletedAt: null,
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

    const where = { marketId, deletedAt: null };
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

// DELETE /api/item-reports/:id — staff-only, scoped to the report's own
// market (assertMarketAccess re-checked against the real row's marketId,
// never a client-supplied one). Soft delete (see ItemReport.deletedAt's
// own schema comment) — the underlying Product.stockQuantity decrement
// this report originally caused is never reversed (that's real inventory
// history, not something a deleted report should silently undo);
// deleting only removes the report itself from view.
export async function deleteItemReport(req, res, next) {
  try {
    const existing = await prisma.itemReport.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Report not found" });
    await assertMarketAccess(req.user, existing.marketId);

    if (!existing.deletedAt) {
      await prisma.itemReport.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
