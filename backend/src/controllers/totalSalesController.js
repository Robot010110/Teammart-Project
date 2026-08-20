import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";
import { createNotificationForUser } from "../utils/notifications.js";

// totalSalesController.js — a market's total money sold in one 24-hour
// reporting day (spec §4-5). Supervisor-only to submit; Regional
// Manager/Admin-only to view — the spec is explicit and repeated on this:
// "the Regional Manager is the only management role that can view the
// submitted Total Sales report" (§4), and the Supervisor's own §15
// permission list stops at "Submit Total Sales / Upload evidence", never
// "view". A Supervisor still sees confirmation of what they just
// submitted directly in submitTotalSales's response — there is
// deliberately no Supervisor-facing read endpoint for the persisted
// history.

function dayOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// POST /api/total-sales — Supervisor-only, always their own market
// (never a market id from the request body — the token is the only
// source of truth for which market this is). Always CREATES a new row,
// never upserts over an existing same-day report — "preserve historical
// records rather than simply replacing previous reports" (spec's own
// words); a corrected resubmission is just another row.
export async function submitTotalSales(req, res, next) {
  try {
    if (req.user.kind !== "staff" || req.user.role !== "SUPERVISOR") {
      return res.status(403).json({ error: "Only a Supervisor account can submit Total Sales" });
    }
    const { date, amount, photoUrl } = req.body;
    const marketId = req.user.marketId;
    if (!marketId) return res.status(400).json({ error: "Your account is not assigned to a market" });

    const report = await prisma.totalSalesReport.create({
      data: { marketId, date: dayOnly(date), amount, photoUrl, submittedById: req.user.userId },
    });

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { name: true, zone: { select: { managerId: true } } },
    });
    if (market?.zone?.managerId) {
      await createNotificationForUser({
        userId: market.zone.managerId,
        type: "TOTAL_SALES_SUBMITTED",
        title: "Total Sales Submitted",
        body: `${market.name} submitted a Total Sales report of $${amount.toFixed(2)} for ${dayOnly(date).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`,
        linkType: "TOTAL_SALES",
        linkId: report.id,
      });
    }

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
}

// GET /api/total-sales?marketId=&date=&from=&to= — Regional-Manager/Admin
// only. Returns every historical report for the market, most recent
// first (never just the latest — see the model's own "append-only,
// preserve history" comment), optionally narrowed to one exact date or a
// date range.
export async function listTotalSalesReports(req, res, next) {
  try {
    if (req.user.kind !== "staff" || (req.user.role !== "REGIONAL_MANAGER" && req.user.role !== "ADMIN")) {
      return res.status(403).json({ error: "Only a Regional Manager or Admin account can view Total Sales" });
    }
    const { marketId, date, from, to } = req.query;
    if (!marketId) return res.status(400).json({ error: "marketId is required" });
    await assertMarketAccess(req.user, marketId);

    const where = { marketId };
    if (date) {
      where.date = dayOnly(date);
    } else if (from || to) {
      where.date = {};
      if (from) where.date.gte = dayOnly(from);
      if (to) where.date.lte = dayOnly(to);
    }

    const reports = await prisma.totalSalesReport.findMany({
      where,
      include: { submittedBy: { select: { id: true, name: true } } },
      orderBy: { submittedAt: "desc" },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
}
