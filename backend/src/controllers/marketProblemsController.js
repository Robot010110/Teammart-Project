import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, assertZoneAccess } from "../middleware/auth.js";

// marketProblemsController.js — Repair Pass §4: real backend for the
// Supervisor's "Reports & Problems" screen (physical/technical market
// issues — freezer down, broken door, etc). Previously entirely mock,
// in-memory frontend data (Frontend/src/data/supervisorMockData.js) that
// reset on every page load and never actually separated resolved items
// from the active view. Same OPEN -> IN_PROGRESS -> RESOLVED lifecycle
// the mock already modeled, now persisted — `view=active` (default) vs
// `view=history` is what actually enforces "resolved leaves the active
// queue, stays in history", not a frontend-only filter.

// GET /api/market-problems?marketId=&view=active|history — staff-only,
// scoped to a market this caller can actually access (assertMarketAccess
// — same IDOR guard every other market-scoped endpoint in this app
// uses).
//
// GET /api/market-problems?zoneId=&view= — Chat Hub Reports §8: the
// Regional-Manager-wide equivalent, every problem across every market in
// one of their own zones (assertZoneAccess — Admin/RM only, same guard
// getZoneSalesSummary/listCompanyActivities already use for their own
// zone-wide views). Same shape either way, with `market` now always
// included so a zone-wide list can show which market each report is
// from.
export async function listMarketProblems(req, res, next) {
  try {
    const { marketId, zoneId, view = "active" } = req.query;
    const statusWhere = view === "history" ? "RESOLVED" : { not: "RESOLVED" };

    let where;
    if (marketId) {
      await assertMarketAccess(req.user, marketId);
      where = { marketId, deletedAt: null, status: statusWhere };
    } else {
      await assertZoneAccess(req.user, zoneId);
      where = { market: { zoneId }, deletedAt: null, status: statusWhere };
    }

    const problems = await prisma.marketProblem.findMany({
      where,
      include: {
        reportedByUser: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
      },
      orderBy: view === "history" ? { resolvedAt: "desc" } : { createdAt: "desc" },
    });
    res.json(problems);
  } catch (err) {
    next(err);
  }
}

// POST /api/market-problems — staff-only. marketId/reportedByUserId are
// always derived from the authenticated caller (their own managed
// market), never trusted from the request body.
export async function createMarketProblem(req, res, next) {
  try {
    const marketId = req.user.marketId;
    if (!marketId) return res.status(400).json({ error: "Your account is not assigned to a market" });

    const { problemType, location, description, photoUrl } = req.body;
    const problem = await prisma.marketProblem.create({
      data: { marketId, problemType, location, description, photoUrl, reportedByUserId: req.user.userId },
      include: { reportedByUser: { select: { id: true, name: true } } },
    });
    res.status(201).json(problem);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/market-problems/:id/status — staff-only, scoped to the
// problem's own market (assertMarketAccess re-checked against the real
// row's marketId, not a client-supplied one). resolvedAt is set exactly
// when status becomes RESOLVED (what the active/history split above
// actually filters on) and cleared if moved back off RESOLVED — a
// Supervisor correcting a mistaken resolve doesn't leave a stale
// resolvedAt behind.
export async function updateMarketProblemStatus(req, res, next) {
  try {
    const existing = await prisma.marketProblem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Problem not found" });
    await assertMarketAccess(req.user, existing.marketId);

    const { status } = req.body;
    const problem = await prisma.marketProblem.update({
      where: { id: existing.id },
      data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
      include: { reportedByUser: { select: { id: true, name: true } } },
    });
    res.json(problem);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/market-problems/:id — staff-only, scoped to the problem's
// own market (assertMarketAccess re-checked against the real row's
// marketId, same pattern as updateMarketProblemStatus above — never a
// client-supplied marketId). Soft delete (see MarketProblem.deletedAt's
// own schema comment) — removed from both Active and History
// immediately, the row itself is kept.
export async function deleteMarketProblem(req, res, next) {
  try {
    const existing = await prisma.marketProblem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Problem not found" });
    await assertMarketAccess(req.user, existing.marketId);

    if (!existing.deletedAt) {
      await prisma.marketProblem.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
