import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, HttpError } from "../middleware/auth.js";
import { attachEmployeeStatuses } from "../utils/employeeStatus.js";
import { createNotificationForUser } from "../utils/notifications.js";

// marketManagementController.js — the Regional Manager's market
// inspection/evaluation layer: overview, department "sections"
// (observation-only, not operational control — see the Section
// endpoints' own comment for why this reuses Employee.department instead
// of inventing a separate Section catalog), ratings, notes, and formal
// Warning/Recognition feedback, optionally grouped into a MarketVisit.
// RBAC is the same assertMarketAccess every other staff-scoped endpoint
// in this app already uses — a Regional Manager can only touch a market
// in one of their own zones (staffCanAccessMarket now checks zoneIds
// membership, not a single zoneId).

function publicEmployee(e) {
  const { passwordHash, ...rest } = e;
  return rest;
}

// GET /api/markets/:id/overview — staff-only. Everything the Market
// Overview header needs in one request: market identity, supervisor,
// employee/active counts, current (most recent) rating, and last visit
// date — all real, computed from existing data, nothing hardcoded.
export async function getMarketOverview(req, res, next) {
  try {
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: {
        zone: { select: { id: true, number: true } },
        supervisor: { select: { id: true, name: true } },
        employees: true,
      },
    });
    if (!market) return res.status(404).json({ error: "Market not found" });

    const [latestRating, latestVisit, employeesWithStatus] = await Promise.all([
      prisma.marketRating.findFirst({ where: { marketId }, orderBy: { createdAt: "desc" } }),
      prisma.marketVisit.findFirst({ where: { marketId }, orderBy: { visitDate: "desc" } }),
      attachEmployeeStatuses(market.employees.map(publicEmployee)),
    ]);

    res.json({
      id: market.id,
      name: market.name,
      status: market.status,
      zone: market.zone,
      supervisor: market.supervisor,
      employeeCount: market.employees.length,
      activeCount: employeesWithStatus.filter((e) => e.status === "ACTIVE").length,
      currentRating: latestRating?.rating ?? null,
      lastVisitDate: latestVisit?.visitDate ?? null,
      employees: employeesWithStatus,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/markets/:id/sections — staff-only. "Sections" are built from
// Employee.department (real, already-assigned data — see
// DepartmentAssignment) rather than a separate hardcoded/invented Section
// catalog: no operational record in this app (Activity, ItemReport,
// WastedOverallReport) is tagged by a physical section today, only by
// employee, and every employee already has a real department. Grouping
// by whichever department values actually have employees in this market
// gives a genuinely dynamic section list (spec §7: "configurable rather
// than permanently hardcoded") without a duplicate system.
export async function listMarketSections(req, res, next) {
  try {
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);

    const employees = await prisma.employee.findMany({ where: { marketId } });
    const withStatus = await attachEmployeeStatuses(employees.map(publicEmployee));

    const byDepartment = new Map();
    for (const e of withStatus) {
      const dept = e.department || "Unassigned";
      if (!byDepartment.has(dept)) byDepartment.set(dept, []);
      byDepartment.get(dept).push(e);
    }

    const sections = [...byDepartment.entries()].map(([department, deptEmployees]) => ({
      department,
      employeeCount: deptEmployees.length,
      activeCount: deptEmployees.filter((e) => e.status === "ACTIVE").length,
    }));
    sections.sort((a, b) => a.department.localeCompare(b.department));

    res.json(sections);
  } catch (err) {
    next(err);
  }
}

// GET /api/markets/:id/sections/:department — staff-only. Observation-
// mode detail: who's assigned here (with real status), and recent
// activity from this department's employees over the last 14 days —
// Activities, Item Reports (expired/wasted), and Wasted Overall reports,
// each already a real model with real evidence photos. This is
// read-only by construction (no write endpoints here) — matches "let the
// Regional Manager understand what is happening, not operate the
// department" (spec §8).
export async function getMarketSectionDetail(req, res, next) {
  try {
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);
    const department = req.params.department === "Unassigned" ? null : req.params.department;

    const employees = await prisma.employee.findMany({
      where: department ? { marketId, department } : { marketId, department: null },
    });
    const withStatus = await attachEmployeeStatuses(employees.map(publicEmployee));
    const employeeIds = employees.map((e) => e.id);

    const since = new Date();
    since.setDate(since.getDate() - 14);

    const [activities, itemReports, wastedReports] = employeeIds.length
      ? await Promise.all([
          prisma.activity.findMany({
            where: { employeeId: { in: employeeIds }, createdAt: { gte: since } },
            include: { images: true, employee: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
          prisma.itemReport.findMany({
            where: { employeeId: { in: employeeIds }, reportedAt: { gte: since } },
            include: { product: { select: { name: true } }, employee: { select: { id: true, name: true } } },
            orderBy: { reportedAt: "desc" },
            take: 100,
          }),
          prisma.wastedOverallReport.findMany({
            where: { employeeId: { in: employeeIds }, reportedAt: { gte: since } },
            include: { employee: { select: { id: true, name: true } } },
            orderBy: { reportedAt: "desc" },
            take: 100,
          }),
        ])
      : [[], [], []];

    res.json({
      department: req.params.department,
      employees: withStatus,
      recentActivities: activities,
      recentItemReports: itemReports,
      recentWastedReports: wastedReports,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// Market inspection: Visits, Ratings, Notes, Feedback (Warning/
// Recognition). Restricted to REGIONAL_MANAGER/ADMIN — these are
// management-evaluation actions a Supervisor doesn't perform on their
// own market (they're the one being evaluated).
// ---------------------------------------------------------------------

function requireRmRole(req, res) {
  if (req.user.kind !== "staff" || !["REGIONAL_MANAGER", "ADMIN"].includes(req.user.role)) {
    res.status(403).json({ error: "This action requires a Regional Manager or Admin account" });
    return false;
  }
  return true;
}

// POST /api/markets/:id/visits — starts a visit record other actions
// (rating/note/feedback) can optionally attach to via visitId, so one
// inspection's records show up together (spec §25).
export async function createMarketVisit(req, res, next) {
  try {
    if (!requireRmRole(req, res)) return;
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);

    const visit = await prisma.marketVisit.create({
      data: { marketId, regionalManagerId: req.user.userId },
    });
    res.status(201).json(visit);
  } catch (err) {
    next(err);
  }
}

// POST /api/markets/:id/ratings — 1-10, never overwrites a previous
// rating (each call creates a new row — see MarketRating's own comment).
export async function rateMarket(req, res, next) {
  try {
    if (!requireRmRole(req, res)) return;
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);

    const { rating, notes, visitId } = req.body;
    if (visitId) await assertVisitBelongsToMarket(visitId, marketId);

    const created = await prisma.marketRating.create({
      data: { marketId, regionalManagerId: req.user.userId, rating, notes, visitId },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// GET /api/markets/:id/ratings — history/trend (most recent first).
export async function listMarketRatings(req, res, next) {
  try {
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);

    const ratings = await prisma.marketRating.findMany({
      where: { marketId },
      include: { regionalManager: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(ratings);
  } catch (err) {
    next(err);
  }
}

// POST /api/markets/:id/notes — internal management notes, never shown
// to the market's Supervisor (distinct from Warning/Recognition, which
// are).
export async function addMarketNote(req, res, next) {
  try {
    if (!requireRmRole(req, res)) return;
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);

    const { content, category, visitId } = req.body;
    if (visitId) await assertVisitBelongsToMarket(visitId, marketId);

    const note = await prisma.marketNote.create({
      data: { marketId, regionalManagerId: req.user.userId, content, category, visitId },
    });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

// POST /api/markets/:id/feedback — a formal Warning or Recognition,
// always routed to the market's Supervisor as a real staff Notification
// (spec §21: kept structurally separate from Chat — see
// MarketFeedback's own schema comment).
export async function sendMarketFeedback(req, res, next) {
  try {
    if (!requireRmRole(req, res)) return;
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);

    const { type, title, description, category, priority, photoUrl, visitId } = req.body;
    if (visitId) await assertVisitBelongsToMarket(visitId, marketId);

    const market = await prisma.market.findUnique({ where: { id: marketId }, select: { name: true, supervisorId: true } });
    if (!market) return res.status(404).json({ error: "Market not found" });

    const feedback = await prisma.marketFeedback.create({
      data: { marketId, regionalManagerId: req.user.userId, type, title, description, category, priority, photoUrl, visitId },
    });

    if (market.supervisorId) {
      await createNotificationForUser({
        userId: market.supervisorId,
        type: "MARKET_FEEDBACK",
        title: type === "WARNING" ? `Warning: ${market.name}` : `Recognition: ${market.name}`,
        body: title,
        linkType: "MARKET_FEEDBACK",
        linkId: feedback.id,
      });
    }

    res.status(201).json(feedback);
  } catch (err) {
    next(err);
  }
}

// GET /api/markets/:id/history — every visit, rating, note, and feedback
// for this market, newest first, so the Regional Manager can review past
// inspections as one combined timeline (spec §26). Notes are internal
// (RM/Admin only, per requireRmRole below); ratings and feedback are
// visible to any staff with market access (the Supervisor should be able
// to see warnings/recognition sent about their own market).
export async function getMarketHistory(req, res, next) {
  try {
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);

    const includeNotes = req.user.kind === "staff" && ["REGIONAL_MANAGER", "ADMIN"].includes(req.user.role);

    const [visits, ratings, notes, feedback] = await Promise.all([
      prisma.marketVisit.findMany({ where: { marketId }, include: { regionalManager: { select: { id: true, name: true } } }, orderBy: { visitDate: "desc" } }),
      prisma.marketRating.findMany({ where: { marketId }, include: { regionalManager: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
      includeNotes
        ? prisma.marketNote.findMany({ where: { marketId }, include: { regionalManager: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } })
        : Promise.resolve([]),
      prisma.marketFeedback.findMany({ where: { marketId }, include: { regionalManager: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    ]);

    res.json({ visits, ratings, notes, feedback });
  } catch (err) {
    next(err);
  }
}

async function assertVisitBelongsToMarket(visitId, marketId) {
  const visit = await prisma.marketVisit.findUnique({ where: { id: visitId }, select: { marketId: true } });
  if (!visit || visit.marketId !== marketId) {
    throw new HttpError(400, "visitId does not belong to this market");
  }
}
