import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, HttpError } from "../middleware/auth.js";
import { attachEmployeeStatuses } from "../utils/employeeStatus.js";
import { createNotificationForUser } from "../utils/notifications.js";
import { getMarketDepartmentStatus, getMarketDepartmentCompletion, ensureMarketDepartment } from "../services/departmentMonitoringService.js";
import { findOrCreateChannel } from "./chatController.js";

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
        overlookingSupervisor: { select: { id: true, name: true } },
        employees: true,
      },
    });
    if (!market) return res.status(404).json({ error: "Market not found" });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [latestRating, latestVisit, employeesWithStatus, latestTotalSales, cardSalesToday] = await Promise.all([
      prisma.marketRating.findFirst({ where: { marketId }, orderBy: { createdAt: "desc" } }),
      prisma.marketVisit.findFirst({ where: { marketId }, orderBy: { visitDate: "desc" } }),
      attachEmployeeStatuses(market.employees.map(publicEmployee)),
      // Only surfaced here if the viewer is actually allowed to see it —
      // Total Sales stays Regional-Manager/Admin-only even as a summary
      // tile (see totalSalesController.js's own comment on why this is
      // never shown to a Supervisor, not even their own market's).
      req.user.role === "REGIONAL_MANAGER" || req.user.role === "ADMIN"
        ? prisma.totalSalesReport.findFirst({ where: { marketId, date: todayStart }, orderBy: { submittedAt: "desc" } })
        : null,
      prisma.cardSalesReport.findMany({ where: { marketId, date: todayStart }, select: { shift: true } }),
    ]);
    const submittedShiftsToday = new Set(cardSalesToday.map((r) => r.shift));

    res.json({
      id: market.id,
      name: market.name,
      status: market.status,
      zone: market.zone,
      supervisor: market.supervisor,
      overlookingSupervisor: market.overlookingSupervisor,
      employeeCount: market.employees.length,
      activeCount: employeesWithStatus.filter((e) => e.status === "ACTIVE").length,
      currentRating: latestRating?.rating ?? null,
      lastVisitDate: latestVisit?.visitDate ?? null,
      employees: employeesWithStatus,
      // Entry-point summaries for the Total Sales / Card Sales pages —
      // null totalSalesToday for a Supervisor/Overlooking viewer just
      // means "not visible to you", not "nothing submitted yet".
      totalSalesToday: latestTotalSales ? { amount: latestTotalSales.amount, submittedAt: latestTotalSales.submittedAt } : null,
      cardSalesToday: { MORNING: submittedShiftsToday.has("MORNING"), AFTERNOON: submittedShiftsToday.has("AFTERNOON"), NIGHT: submittedShiftsToday.has("NIGHT") },
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

// ---------------------------------------------------------------------
// Phase 2 — Department Monitoring, Completion, and the Final Department
// Report. All three read from the exact same DEPARTMENT_CLOSING Activity
// records Employee/Supervisor submission already writes (see
// services/departmentMonitoringService.js) — nothing here duplicates
// that data into a second table just for display (spec §13/§20).
// ---------------------------------------------------------------------

// GET /api/markets/:id/departments — staff-only, the Department
// Monitoring section's data (spec §12): per-department assigned
// employee, today's submission status, submitter, and photo
// availability, all derived live — nothing cached that could drift.
export async function listMarketDepartments(req, res, next) {
  try {
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);
    const statuses = await getMarketDepartmentStatus(marketId, { date: req.query.date ? new Date(req.query.date) : new Date() });
    res.json(statuses);
  } catch (err) {
    next(err);
  }
}

// POST /api/markets/:id/departments — staff-only. Registers a department
// in this market's catalog before anyone is assigned to it (spec §15:
// an Unassigned department has to be nameable/trackable even with zero
// current employees) — the same underlying registration
// assignDepartment/Department-Closing submissions already trigger
// automatically, exposed here as an explicit action for this case.
export async function addMarketDepartment(req, res, next) {
  try {
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);
    const department = await ensureMarketDepartment(marketId, req.body.name, req.user.userId);
    res.status(201).json(department);
  } catch (err) {
    next(err);
  }
}

// GET /api/markets/:id/departments/completion — staff-only. The
// backend-authoritative completion count (spec §17-18) — the frontend
// never computes "X/Y departments complete" itself, it only displays
// what this endpoint returns.
export async function getMarketDepartmentCompletionRoute(req, res, next) {
  try {
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);
    const completion = await getMarketDepartmentCompletion(marketId, { date: req.query.date ? new Date(req.query.date) : new Date() });
    res.json(completion);
  } catch (err) {
    next(err);
  }
}

// POST /api/markets/:id/department-report — staff-only (Supervisor/
// Overlooking of this market, or RM/Admin). Sends the Final Department
// Report (spec §19-22): re-validates completion server-side (never
// trusts anything the frontend computed), refuses if incomplete unless
// `override: true` is explicitly passed (recorded — who/when/reason,
// spec §18), and posts the report into this market's own existing
// MARKET_GROUP conversation — never an invented "Zone group". The
// DepartmentReport.@@unique([marketId, date, shift]) constraint is the
// real guarantee against two concurrent "Send Report" requests both
// succeeding for the same market/day/shift (same partial-unique-index
// philosophy as Break's one-active-break guarantee) — this function
// still checks first for a fast, friendly error, but that constraint is
// what actually decides it under a genuine race.
export async function sendDepartmentReport(req, res, next) {
  try {
    const marketId = req.params.id;
    await assertMarketAccess(req.user, marketId);

    const { date, shift, override, overrideReason } = req.body;
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    const existing = await prisma.departmentReport.findUnique({
      where: { marketId_date_shift: { marketId, date: reportDate, shift } },
    });
    if (existing) {
      return res.status(409).json({ error: "A report for this market/date/shift has already been sent", report: existing });
    }

    const completion = await getMarketDepartmentCompletion(marketId, { date: reportDate });
    if (!completion.isComplete && !override) {
      return res.status(400).json({
        error: "Required departments are not all complete yet.",
        requiredCount: completion.requiredCount,
        completedCount: completion.completedCount,
        missing: completion.missing,
      });
    }
    if (!completion.isComplete && override && !overrideReason) {
      return res.status(400).json({ error: "An override reason is required to send an incomplete report." });
    }

    const market = await prisma.market.findUnique({ where: { id: marketId }, select: { name: true } });
    const lines = completion.statuses.map((s) => {
      const who = s.submission?.submittedBy
        ? s.submission.submittedBy.kind === "staff" ? "Supervisor" : s.submission.submittedBy.name
        : "—";
      const stateLabel = s.state === "COMPLETED" ? "Completed" : s.state === "UNASSIGNED" ? "Unassigned" : "Missing";
      return `- ${s.department} — ${who} — ${stateLabel}`;
    });
    const dateLabel = reportDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    const shiftLabel = shift.charAt(0) + shift.slice(1).toLowerCase();
    const body = [
      `${market.name} — Department Closing Report`,
      "",
      `Date: ${dateLabel}`,
      `Shift: ${shiftLabel}`,
      "",
      `${completion.completedCount}/${completion.requiredCount} departments completed${completion.overrideUsed ? " (sent with override)" : ""}.`,
      "",
      "Departments:",
      ...lines,
    ].join("\n");

    const conversation = await findOrCreateChannel(marketId, "MARKET_GROUP");
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, body, senderUserId: req.user.userId },
    });

    const report = await prisma.departmentReport.create({
      data: {
        marketId,
        date: reportDate,
        shift,
        requiredCount: completion.requiredCount,
        completedCount: completion.completedCount,
        overrideUsed: !completion.isComplete && !!override,
        overrideReason: !completion.isComplete && override ? overrideReason : null,
        sentById: req.user.userId,
        conversationId: conversation.id,
        messageId: message.id,
      },
    });

    res.status(201).json({ report, message });
  } catch (err) {
    next(err);
  }
}
