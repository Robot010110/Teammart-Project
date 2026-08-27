import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";
import { createNotificationForUser } from "../utils/notifications.js";

// priceReportsController.js — a cashier flagging a shelf-price vs.
// POS-system-price mismatch, automatically routed to the market's own
// Supervisor (Cleanup Phase §6) — the report is both immediately visible
// via listPriceReportsForMarket AND now actively notifies the Supervisor,
// the same real Notification model every other staff-facing event uses
// (this file predates that system; this is the retrofit, not a second
// notification mechanism).

// POST /api/price-reports — cashier-only.
export async function createPriceReport(req, res, next) {
  try {
    const { productName, barcode, shelfPrice, systemPrice, notes, photoUrl } = req.body;

    const report = await prisma.priceReport.create({
      data: {
        productName,
        barcode,
        shelfPrice,
        systemPrice,
        notes,
        photoUrl,
        shift: req.user.cashierShift ?? undefined,
        employeeId: req.user.employeeId,
        marketId: req.user.marketId,
      },
    });

    const market = await prisma.market.findUnique({ where: { id: req.user.marketId }, select: { supervisorId: true, overlookingSupervisorId: true } });
    const recipients = [market?.supervisorId, market?.overlookingSupervisorId].filter(Boolean);
    if (recipients.length) {
      const employee = await prisma.employee.findUnique({ where: { id: req.user.employeeId }, select: { name: true } });
      await Promise.all(
        recipients.map((userId) =>
          createNotificationForUser({
            userId,
            type: "EMPLOYEE_REPORT_SUBMITTED",
            title: "Price Mismatch Reported",
            body: `${employee.name} flagged a price mismatch on ${productName} (shelf ${shelfPrice} vs. system ${systemPrice}).`,
            linkType: "PRICE_REPORT",
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

// GET /api/price-reports — the current cashier's own reports.
export async function listPriceReports(req, res, next) {
  try {
    const reports = await prisma.priceReport.findMany({
      where: { employeeId: req.user.employeeId, deletedAt: null },
      orderBy: { reportedAt: "desc" },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
}

// GET /api/price-reports/market?marketId=&status= — staff-only, scoped to
// a market they can access. No frontend caller yet (no Supervisor screen
// exists) — built now so the endpoint is real and tested, the same
// "backend-ready, UI pending Supervisor module" pattern already used for
// Sudden Task assignment and Attendance import.
export async function listPriceReportsForMarket(req, res, next) {
  try {
    const { status } = req.query;
    const marketId = req.query.marketId ?? req.user.marketId;
    if (!marketId) {
      return res.status(400).json({ error: "marketId is required" });
    }

    await assertMarketAccess(req.user, marketId);

    const where = { marketId, deletedAt: null };
    if (status) where.status = status;

    const reports = await prisma.priceReport.findMany({
      where,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { reportedAt: "desc" },
    });

    res.json(reports);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/price-reports/:id — staff-only, scoped to the report's own
// market (assertMarketAccess re-checked against the real row's
// marketId). Soft delete (see PriceReport.deletedAt's own schema
// comment).
export async function deletePriceReport(req, res, next) {
  try {
    const existing = await prisma.priceReport.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Report not found" });
    await assertMarketAccess(req.user, existing.marketId);

    if (!existing.deletedAt) {
      await prisma.priceReport.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
