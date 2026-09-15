// performanceController.js — HTTP shape only. Every score is computed by
// the engine and every response passes through performanceView.
//
// Performance Engine §D/§I. Two rules hold across every handler here:
//
//   1. Nothing is ever read from the request body to produce a score.
//      There is no write path to a performance number at all — the only
//      mutating route is the ADMIN recompute, which re-derives from source
//      data and accepts no values.
//   2. Nothing does res.json(row) on a raw record. The viewer is passed to
//      publicSnapshot/publicWorkReview/publicAggregate, which decide what
//      that viewer may see.

import { PERIOD_TYPES } from "../utils/period.js";
import { assertZoneAccess, requireAccessibleEmployee, HttpError } from "../middleware/auth.js";
import {
  getCurrentPeriod, getHistory, getAggregate, getPeriodByStart,
  listMarketPerformance, listZonePerformance,
  markPeriodsStale, recomputeSnapshot,
} from "../services/performance/performanceService.js";
import { getStreak } from "../services/performance/performanceRollupService.js";
import { listReviewsForEmployee } from "../services/workReviewService.js";
import {
  publicSnapshot, publicWorkReview, publicStreak, publicAggregate,
} from "../services/performance/performanceView.js";

// The employee whose data this request is about, and the viewer asking.
// An employee route always resolves to the caller themselves; a staff
// route resolves to the :employeeId in the path, after a market check.
async function resolveSubject(req) {
  if (req.user.kind === "employee") return req.user.employeeId;
  const employee = await requireAccessibleEmployee(req.user, req.params.employeeId);
  return employee.id;
}

// A "YYYY-MM-DD" path/query param names a CALENDAR DAY, and every period
// boundary this app stores is local midnight (see utils/period.js). Letting
// `new Date("2026-09-05")` handle it would parse UTC midnight instead,
// which is a different instant in every timezone but UTC — and therefore
// never equal to a stored periodStart. Parsed explicitly here so the API
// behaves the same wherever the server runs.
function parseLocalDate(value, label) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `${label} must be a valid date`);
  return parsed;
}

// Start/end of the local day containing `date` — used to turn a calendar
// date into the half-open range a stored timestamp can be matched against.
function localDayBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function parsePeriodType(value, fallback = PERIOD_TYPES.MONTH) {
  const periodType = value ?? fallback;
  if (!Object.values(PERIOD_TYPES).includes(periodType)) {
    throw new HttpError(400, `periodType must be WEEK or MONTH`);
  }
  return periodType;
}

// GET /api/performance/me
// GET /api/performance/employees/:employeeId
//
// The homepage figure. Defaults to the CURRENT MONTH, not the current week
// — spec §13 is explicit that the employee home card shows the month.
export async function getPerformanceSummary(req, res, next) {
  try {
    const employeeId = await resolveSubject(req);
    const periodType = parsePeriodType(req.query.periodType);
    const [current, streak] = await Promise.all([
      getCurrentPeriod({ employeeId, periodType }),
      getStreak({ employeeId }),
    ]);
    res.json({
      employeeId,
      current: publicSnapshot(current, { viewer: req.user }),
      streaks: publicStreak(streak),
    });
  } catch (err) {
    next(err);
  }
}

// GET .../history?periodType=WEEK&limit=13
//
// Closed periods only, most recent first. ~13 weeks covers the roughly
// three months of weekly history the spec asks to retain.
export async function getPerformanceHistory(req, res, next) {
  try {
    const employeeId = await resolveSubject(req);
    const periodType = parsePeriodType(req.query.periodType, PERIOD_TYPES.WEEK);
    const limit = Math.min(Number(req.query.limit) || (periodType === PERIOD_TYPES.WEEK ? 13 : 12), 24);

    const periods = await getHistory({ employeeId, periodType, limit });
    res.json({
      employeeId,
      periodType,
      periods: periods.map((p) => publicSnapshot(p, { viewer: req.user })),
    });
  } catch (err) {
    next(err);
  }
}

// GET .../aggregate?months=6|12 — the combined six-month / one-year figure.
export async function getPerformanceAggregate(req, res, next) {
  try {
    const employeeId = await resolveSubject(req);
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
    const aggregate = await getAggregate({ employeeId, months });
    res.json({ employeeId, ...publicAggregate(aggregate, { viewer: req.user }) });
  } catch (err) {
    next(err);
  }
}

// GET .../periods/:periodType/:periodStart — the drill-down for one closed
// period, plus the reviews that produced its Quality score.
//
// This is the single most sensitive endpoint in the feature: it is where
// an employee gets closest to the per-item scoring. publicWorkReview is
// what keeps severity and point values out of their copy.
export async function getPerformancePeriod(req, res, next) {
  try {
    const employeeId = await resolveSubject(req);
    const periodType = parsePeriodType(req.params.periodType);
    const periodStart = parseLocalDate(req.params.periodStart, "periodStart");
    const snapshot = await getPeriodByStart({ employeeId, periodType, periodStart });
    if (!snapshot) throw new HttpError(404, "No performance record for that period");

    const reviews = await listReviewsForEmployee({
      employeeId,
      from: snapshot.periodStart,
      to: snapshot.periodEnd,
    });

    res.json({
      employeeId,
      period: publicSnapshot(snapshot, { viewer: req.user }),
      reviews: reviews.map((r) => publicWorkReview(r, { viewer: req.user })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/performance/market?marketId=&periodType=&offset=
export async function getMarketPerformance(req, res, next) {
  try {
    const marketId = req.query.marketId ?? req.user.marketId;
    if (!marketId) throw new HttpError(400, "marketId is required");
    const periodType = parsePeriodType(req.query.periodType);
    const offset = Math.max(Number(req.query.offset) || 1, 1);

    const result = await listMarketPerformance({ marketId, periodType, offset });
    res.json({
      ...result,
      employees: result.employees.map((s) => ({
        employee: s.employee,
        ...publicSnapshot(s, { viewer: req.user }),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/performance/zone?zoneId=&periodType=&offset=
export async function getZonePerformance(req, res, next) {
  try {
    const zoneId = req.query.zoneId;
    if (!zoneId) throw new HttpError(400, "zoneId is required");
    await assertZoneAccess(req.user, zoneId);
    const periodType = parsePeriodType(req.query.periodType);
    const offset = Math.max(Number(req.query.offset) || 1, 1);

    const result = await listZonePerformance({ zoneId, periodType, offset });
    res.json({
      ...result,
      employees: result.employees.map((s) => ({
        employee: s.employee,
        ...publicSnapshot(s, { viewer: req.user }),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/performance/recompute — ADMIN only.
//
// Accepts no score of any kind: it marks periods stale and re-derives them
// from source data. This is the escape hatch for "last month's attendance
// import was wrong", which is a real operational need now that a bad
// import moves a stored, sealed number rather than just a widget.
export async function recomputePerformance(req, res, next) {
  try {
    const { employeeId, from, to } = req.body;
    const employee = await requireAccessibleEmployee(req.user, employeeId);
    // Widened to whole local days so a caller passing plain calendar dates
    // cannot miss a period that starts at local midnight inside the range.
    const fromDate = localDayBounds(parseLocalDate(from, "from")).start;
    const toDate = localDayBounds(parseLocalDate(to, "to")).end;
    if (fromDate > toDate) throw new HttpError(400, "from must not be after to");

    // Sealed snapshots are deliberately excluded — their source data is
    // gone, so a recompute would invent a number rather than correct one.
    const targets = await getPeriodsInRange({ employeeId: employee.id, fromDate, toDate });

    const results = [];
    for (const snapshot of targets) {
      const result = await recomputeSnapshot({ snapshotId: snapshot.id, actorUserId: req.user.userId });
      results.push({ id: snapshot.id, periodType: snapshot.periodType, periodStart: snapshot.periodStart, ...result });
    }
    res.json({ employeeId: employee.id, recomputed: results.filter((r) => r.recomputed).length, periods: results });
  } catch (err) {
    next(err);
  }
}

// Kept local: the only caller is the admin recompute route above, and it
// is the one place that deliberately reaches for unsealed snapshots by
// date range rather than by period offset.
async function getPeriodsInRange({ employeeId, fromDate, toDate }) {
  const { prisma } = await import("../lib/prisma.js");
  return prisma.performanceSnapshot.findMany({
    where: { employeeId, sealedAt: null, periodStart: { gte: fromDate }, periodEnd: { lte: toDate } },
    orderBy: { periodStart: "asc" },
    select: { id: true, periodType: true, periodStart: true },
  });
}

// GET /api/performance/employees/:employeeId/reviews (and the /me variant)
// — the Quality drill-down's review list.
export async function getEmployeeReviews(req, res, next) {
  try {
    const employeeId = await resolveSubject(req);
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const reviews = await listReviewsForEmployee({ employeeId, from, to });
    res.json({
      employeeId,
      reviews: reviews.map((r) => publicWorkReview(r, { viewer: req.user })),
    });
  } catch (err) {
    next(err);
  }
}

export { markPeriodsStale };
