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

// 10 minutes — Market Activities §4: "give the market approximately 10
// minutes to complete the requirement" after a reminder before it's
// treated as Not Completed. Derived at read time in
// getZoneCardSalesSummary (CardSalesReminder.sentAt + this window vs
// now), never a stored status — see that model's own schema comment for
// why (this app's existing "no scheduler, derive-on-read" convention).
const REMINDER_GRACE_MS = 10 * 60 * 1000;

// GET /api/card-sales/zone-summary?date= — Regional Manager/Admin-only.
// Market Activities §3's landing-page Car/Card Sales card: every market
// in the zone (or, for Admin, every market), how many of today's 3
// shifts are submitted, and a derived completion status per market —
// COMPLETED (3/3), NOT_COMPLETED (a reminder was sent 10+ minutes ago
// and it's still incomplete), PENDING_REMINDER (a reminder was sent,
// still inside the grace window), or PENDING (no reminder sent yet).
export async function getZoneCardSalesSummary(req, res, next) {
  try {
    if (req.user.kind !== "staff" || (req.user.role !== "REGIONAL_MANAGER" && req.user.role !== "ADMIN")) {
      return res.status(403).json({ error: "Only a Regional Manager or Admin account can view the zone Card Sales summary" });
    }

    let marketWhere;
    if (req.user.role === "REGIONAL_MANAGER") {
      marketWhere = { zoneId: { in: req.user.zoneIds } };
    }
    const markets = await prisma.market.findMany({ where: marketWhere, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const marketIds = markets.map((m) => m.id);
    const targetDate = req.query.date ? dayOnly(req.query.date) : dayOnly(new Date());

    if (marketIds.length === 0) {
      return res.json({ date: targetDate, markets: [], summary: { completed: 0, pending: 0, notCompleted: 0 } });
    }

    const [reports, reminders] = await Promise.all([
      prisma.cardSalesReport.findMany({
        where: { marketId: { in: marketIds }, date: targetDate, deletedAt: null },
        select: { marketId: true, shift: true },
      }),
      prisma.cardSalesReminder.findMany({
        where: { marketId: { in: marketIds }, date: targetDate },
        orderBy: { sentAt: "desc" },
        select: { marketId: true, sentAt: true },
      }),
    ]);

    const completedShiftsByMarket = new Map();
    for (const r of reports) {
      const set = completedShiftsByMarket.get(r.marketId) ?? new Set();
      set.add(r.shift);
      completedShiftsByMarket.set(r.marketId, set);
    }
    // First hit per market wins — reminders are already ordered
    // newest-sentAt-first, so that's the most recent one.
    const latestReminderByMarket = new Map();
    for (const r of reminders) {
      if (!latestReminderByMarket.has(r.marketId)) latestReminderByMarket.set(r.marketId, r.sentAt);
    }

    const now = Date.now();
    const shaped = markets.map((m) => {
      const completedCount = completedShiftsByMarket.get(m.id)?.size ?? 0;
      const lastReminderAt = latestReminderByMarket.get(m.id) ?? null;
      let status;
      if (completedCount === SHIFTS.length) status = "COMPLETED";
      else if (lastReminderAt && now - lastReminderAt.getTime() >= REMINDER_GRACE_MS) status = "NOT_COMPLETED";
      else if (lastReminderAt) status = "PENDING_REMINDER";
      else status = "PENDING";
      return { marketId: m.id, name: m.name, completedCount, totalShifts: SHIFTS.length, status, lastReminderAt };
    });

    const summary = shaped.reduce(
      (acc, m) => {
        if (m.status === "COMPLETED") acc.completed++;
        else if (m.status === "NOT_COMPLETED") acc.notCompleted++;
        else acc.pending++;
        return acc;
      },
      { completed: 0, pending: 0, notCompleted: 0 }
    );

    res.json({ date: targetDate, markets: shaped, summary });
  } catch (err) {
    next(err);
  }
}

// POST /api/card-sales/remind — Regional Manager/Admin-only. Market
// Activities §4: nudges the market's Supervisor AND Overlooking account
// (a real notification each, not a fake frontend-only banner) that
// today's Card Sales reporting isn't complete, and starts this market's
// 10-minute grace window (see REMINDER_GRACE_MS above). Sending another
// reminder is allowed any time — it's just another row, and resets the
// window. Refused once the day is already fully reported (nothing left
// to remind about).
export async function sendCardSalesReminder(req, res, next) {
  try {
    if (req.user.kind !== "staff" || (req.user.role !== "REGIONAL_MANAGER" && req.user.role !== "ADMIN")) {
      return res.status(403).json({ error: "Only a Regional Manager or Admin account can send a Card Sales reminder" });
    }
    const { marketId } = req.body;
    const date = req.body.date ? dayOnly(req.body.date) : dayOnly(new Date());
    await assertMarketAccess(req.user, marketId);

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { name: true, supervisorId: true, overlookingSupervisorId: true },
    });
    if (!market) return res.status(404).json({ error: "Market not found" });

    const existing = await prisma.cardSalesReport.findMany({
      where: { marketId, date, deletedAt: null },
      select: { shift: true },
    });
    if (new Set(existing.map((r) => r.shift)).size === SHIFTS.length) {
      return res.status(409).json({ error: "This market has already completed today's Card Sales reporting." });
    }

    const reminder = await prisma.cardSalesReminder.create({ data: { marketId, date, sentById: req.user.userId } });

    const recipientIds = [market.supervisorId, market.overlookingSupervisorId].filter((id) => id != null);
    await Promise.all(
      recipientIds.map((userId) =>
        createNotificationForUser({
          userId,
          type: "CARD_SALES_REMINDER",
          title: "Card Sales Reminder",
          body: `Please complete today's Card Sales reporting for ${market.name}.`,
          linkType: "CARD_SALES_MARKET",
          linkId: marketId,
        })
      )
    );

    res.status(201).json({ id: reminder.id, sentAt: reminder.sentAt });
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
