import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";
import { createNotificationForUser } from "../utils/notifications.js";

// cardSalesController.js — per-shift card-count verification, separate
// from Total Sales (spec §6-8). Submittable by either the market's
// Supervisor or its Overlooking account; viewable by any staff with
// market access (Supervisor/Overlooking of that market, or Regional
// Manager/Admin) — Card Sales isn't flagged as restricted financial data
// the way Total Sales explicitly is, and the Supervisor/Overlooking
// genuinely need to see which of the day's three shifts are still
// pending.

const CARD_SALES_SUBMITTER_ROLES = ["SUPERVISOR", "OVERLOOKING_SUPERVISOR"];
const SHIFTS = ["MORNING", "AFTERNOON", "NIGHT"];

function dayOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// POST /api/card-sales — Supervisor or Overlooking, always their own
// market. Always CREATES a new row for the same append-only-history
// reason as TotalSalesReport — a shift can be resubmitted/corrected; the
// day-view below always shows the most recent report per shift.
export async function submitCardSales(req, res, next) {
  try {
    if (req.user.kind !== "staff" || !CARD_SALES_SUBMITTER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: "Only a Supervisor or Overlooking account can submit Card Sales" });
    }
    const { date, shift, photoUrl, photoUrl2 } = req.body;
    const marketId = req.user.marketId;
    if (!marketId) return res.status(400).json({ error: "Your account is not assigned to a market" });

    const report = await prisma.cardSalesReport.create({
      data: { marketId, date: dayOnly(date), shift, photoUrl, photoUrl2: photoUrl2 || null, submittedById: req.user.userId },
    });

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { name: true, zone: { select: { managerId: true } } },
    });
    if (market?.zone?.managerId) {
      await createNotificationForUser({
        userId: market.zone.managerId,
        type: "CARD_SALES_SUBMITTED",
        title: "Card Sales Submitted",
        body: `${market.name} submitted the ${shift.charAt(0)}${shift.slice(1).toLowerCase()} Card Sales report for ${dayOnly(date).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`,
        linkType: "CARD_SALES",
        linkId: report.id,
      });
    }

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
}

// GET /api/card-sales/day?marketId=&date= — staff with market access.
// Shapes one day into the three fixed reporting slots (spec §8) — each
// Submitted or Pending, using the most recent report per shift if more
// than one exists.
export async function getCardSalesDay(req, res, next) {
  try {
    const { marketId, date } = req.query;
    if (!marketId || !date) return res.status(400).json({ error: "marketId and date are required" });
    await assertMarketAccess(req.user, marketId);

    const reports = await prisma.cardSalesReport.findMany({
      where: { marketId, date: dayOnly(date), deletedAt: null },
      include: { submittedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { submittedAt: "desc" },
    });

    const slots = {};
    for (const shift of SHIFTS) {
      const latest = reports.find((r) => r.shift === shift);
      slots[shift] = latest ? { status: "SUBMITTED", report: latest } : { status: "PENDING", report: null };
    }
    res.json({ date: dayOnly(date), slots });
  } catch (err) {
    next(err);
  }
}

// GET /api/card-sales/history?marketId=&from=&to= — staff with market
// access. Every historical report, most recent first.
export async function listCardSalesHistory(req, res, next) {
  try {
    const { marketId, from, to } = req.query;
    if (!marketId) return res.status(400).json({ error: "marketId is required" });
    await assertMarketAccess(req.user, marketId);

    const where = { marketId, deletedAt: null };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = dayOnly(from);
      if (to) where.date.lte = dayOnly(to);
    }

    const reports = await prisma.cardSalesReport.findMany({
      where,
      include: { submittedBy: { select: { id: true, name: true, role: true } } },
      orderBy: [{ date: "desc" }, { submittedAt: "desc" }],
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/card-sales/:id — staff with market access (same
// restriction as viewing this report type — see this file's own top
// comment on why Card Sales isn't RM/Admin-restricted like Total Sales).
// Soft delete (see CardSalesReport.deletedAt's own schema comment).
export async function deleteCardSalesReport(req, res, next) {
  try {
    const report = await prisma.cardSalesReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: "Card Sales report not found" });
    await assertMarketAccess(req.user, report.marketId);

    if (!report.deletedAt) {
      await prisma.cardSalesReport.update({ where: { id: report.id }, data: { deletedAt: new Date() } });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
