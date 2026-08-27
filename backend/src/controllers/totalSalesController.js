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
    const { marketId, date, from, to, status } = req.query;
    if (!marketId) return res.status(400).json({ error: "marketId is required" });
    await assertMarketAccess(req.user, marketId);

    const where = { marketId, deletedAt: null };
    if (date) {
      where.date = dayOnly(date);
    } else if (from || to) {
      where.date = {};
      if (from) where.date.gte = dayOnly(from);
      if (to) where.date.lte = dayOnly(to);
    }
    // Cleanup Phase §2/§10 — status is an explicit opt-in filter, not the
    // default: this endpoint's existing callers expect every historical
    // row back (spec's own "nothing is ever deleted/overwritten"). The RM
    // frontend is what applies the "Pending = active" split, by passing
    // status=PENDING for its action queue and no filter for History.
    if (status) where.status = status;

    const reports = await prisma.totalSalesReport.findMany({
      where,
      include: {
        submittedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/total-sales/:id/review — Regional Manager/Admin-only.
// Approve or Reject a PENDING report exactly once (spec §10: "must not
// remain as an active pending item after the decision" + "the historical
// record must remain available"). Re-review of an already-decided report
// is rejected rather than silently allowed — a decision, once made, is
// part of the historical record too.
export async function reviewTotalSalesReport(req, res, next) {
  try {
    if (req.user.kind !== "staff" || (req.user.role !== "REGIONAL_MANAGER" && req.user.role !== "ADMIN")) {
      return res.status(403).json({ error: "Only a Regional Manager or Admin account can review Total Sales" });
    }

    const report = await prisma.totalSalesReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: "Total Sales report not found" });
    await assertMarketAccess(req.user, report.marketId);

    if (report.status !== "PENDING") {
      return res.status(409).json({ error: `This report has already been ${report.status.toLowerCase()}` });
    }

    const { status, rejectionReason } = req.body;
    const updated = await prisma.totalSalesReport.update({
      where: { id: report.id },
      data: { status, rejectionReason: status === "REJECTED" ? rejectionReason : null, reviewedById: req.user.userId, reviewedAt: new Date() },
    });

    await createNotificationForUser({
      userId: report.submittedById,
      type: "SUBMISSION_REVIEWED",
      title: `Total Sales ${status === "APPROVED" ? "Approved" : "Rejected"}`,
      body: status === "APPROVED"
        ? `Your Total Sales report of $${report.amount.toFixed(2)} was approved.`
        : `Your Total Sales report of $${report.amount.toFixed(2)} was rejected: ${rejectionReason}`,
      linkType: "TOTAL_SALES",
      linkId: report.id,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/total-sales/:id — Regional Manager/Admin-only, same
// restriction as viewing/reviewing this report type (spec's own repeated
// rule: a Supervisor never gets read access to Total Sales, so deletion
// follows the same boundary rather than opening a new one). Soft delete
// (see TotalSalesReport.deletedAt's own schema comment) — real money-
// report history is kept, never hard-deleted.
export async function deleteTotalSalesReport(req, res, next) {
  try {
    if (req.user.kind !== "staff" || (req.user.role !== "REGIONAL_MANAGER" && req.user.role !== "ADMIN")) {
      return res.status(403).json({ error: "Only a Regional Manager or Admin account can delete a Total Sales report" });
    }

    const report = await prisma.totalSalesReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: "Total Sales report not found" });
    await assertMarketAccess(req.user, report.marketId);

    if (!report.deletedAt) {
      await prisma.totalSalesReport.update({ where: { id: report.id }, data: { deletedAt: new Date() } });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
