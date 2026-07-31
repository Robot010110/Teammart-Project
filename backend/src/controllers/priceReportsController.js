import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";

// priceReportsController.js — a cashier flagging a shelf-price vs.
// POS-system-price mismatch. "Automatically send to the Supervisor" means
// the report is immediately visible to any Supervisor of this market via
// listPriceReportsForMarket — no push-notification system exists anywhere
// in this app (same resolution already used for SuddenTask/ItemReport).

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

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
}

// GET /api/price-reports — the current cashier's own reports.
export async function listPriceReports(req, res, next) {
  try {
    const reports = await prisma.priceReport.findMany({
      where: { employeeId: req.user.employeeId },
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

    const where = { marketId };
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
