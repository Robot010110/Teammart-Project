// performanceService.js — orchestration for the Performance engine.
//
// Performance Engine §B/§H. The division of labour:
//   performanceFacts   reads the database
//   scoringEngine      does the arithmetic (pure)
//   this file          decides WHAT to score, and what to store
//
// The central rule: the in-progress period is computed live; a CLOSED
// period is stored. See PerformanceSnapshot's schema comment for why
// storage is mandatory rather than an optimisation.

import { prisma } from "../../lib/prisma.js";
import { recordAudit } from "../../utils/audit.js";
import { periodRange, closedPeriods, PERIOD_TYPES } from "../../utils/period.js";
import { collectFacts } from "./performanceFacts.js";
import { scorePeriod, applyCurve } from "./scoringEngine.js";
import { resolveProfile } from "./scoringProfile.js";

// A snapshot becomes immutable this long after its period ends.
//
// 25 < ADJUSTMENT_RETENTION_DAYS (30, in jobs/maintenanceScheduler.js) is
// LOAD-BEARING, not a coincidence: past 30 days the penalty data a
// recompute would need is permanently gone, so recomputing would produce a
// wrong (inflated) score rather than a corrected one. If retention is ever
// lowered below this window, historical scores start silently inflating
// with no error anywhere.
export const SEAL_AFTER_DAYS = 25;

// How far back the snapshot sweep looks for periods it has not yet closed,
// and the age past which captured facts can no longer be trusted as whole.
// Must stay under the retention window for the same reason as above.
export const SNAPSHOT_LOOKBACK_DAYS = 24;

export function daysAgo(days, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

async function loadEmployee(employeeId, client = prisma) {
  const employee = await client.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true, marketId: true },
  });
  if (!employee) throw new Error(`Employee not found: ${employeeId}`);
  return employee;
}

// The previous period's baseScore, which the improvement half of the
// Consistency category is measured against.
//
// Deliberately ignores inputsComplete:false snapshots: those were computed
// after their penalty data had already been purged, so their Reliability —
// and therefore their baseScore — is structurally inflated. Comparing an
// honest period against an inflated one would show every employee
// "declining" in the engine's first weeks.
async function findPriorBase({ employeeId, periodType, periodStart, client = prisma }) {
  const prior = await client.performanceSnapshot.findFirst({
    where: {
      employeeId,
      periodType,
      periodStart: { lt: periodStart },
      inputsComplete: true,
      baseScore: { not: null },
    },
    orderBy: { periodStart: "desc" },
    select: { baseScore: true },
  });
  return prior ? { baseScore: prior.baseScore } : null;
}

/**
 * Score one period from live data. Writes nothing.
 */
export async function computePeriod({ employeeId, periodType, periodStart, periodEnd, client = prisma }) {
  const employee = await loadEmployee(employeeId, client);
  const profile = resolveProfile(employee);
  const prior = await findPriorBase({ employeeId, periodType, periodStart, client });
  const facts = await collectFacts({ employeeId, periodStart, periodEnd, prior, client });
  return { employee, profile, facts, result: scorePeriod(facts, profile) };
}

function snapshotData({ employee, profile, facts, result, periodType, periodStart, periodEnd, inputsComplete }) {
  const c = result.categories;
  return {
    employeeId: employee.id,
    marketId: employee.marketId,
    position: employee.role,
    periodType,
    periodStart,
    periodEnd,
    score: result.score,
    rawScore: result.rawScore,
    baseScore: result.baseScore,
    qualityScore: c.quality.applicable ? c.quality.points : null,
    completionScore: c.completion.applicable ? c.completion.points : null,
    attendanceScore: c.attendance.applicable ? c.attendance.points : null,
    reliabilityScore: c.reliability.applicable ? c.reliability.points : null,
    consistencyScore: c.consistency.applicable ? c.consistency.points : null,
    applicableMax: result.applicableMax,
    inputs: facts,
    metrics: { status: result.status, categories: c, ...result.metrics },
    inputsComplete,
    profileKey: profile.key,
    profileVersion: profile.version,
  };
}

/**
 * Close out one period into a snapshot.
 *
 * Idempotent by construction: the unique constraint on
 * (employeeId, periodType, periodStart) IS the lock. Two processes racing
 * the same period produce one row and one silent skip — no advisory lock
 * needed for a race the schema already prevents.
 */
export async function snapshotPeriod({ employeeId, periodType, periodStart, periodEnd, now = new Date() }) {
  const existing = await prisma.performanceSnapshot.findUnique({
    where: { employeeId_periodType_periodStart: { employeeId, periodType, periodStart } },
  });
  if (existing) return { created: false, snapshot: existing };

  const { employee, profile, facts, result } = await computePeriod({
    employeeId, periodType, periodStart, periodEnd,
  });

  // A period that ended longer ago than the retention window can no longer
  // be scored honestly — its punishmentHours are already gone.
  const inputsComplete = periodEnd >= daysAgo(SNAPSHOT_LOOKBACK_DAYS, now);

  try {
    const snapshot = await prisma.performanceSnapshot.create({
      data: snapshotData({ employee, profile, facts, result, periodType, periodStart, periodEnd, inputsComplete }),
    });
    return { created: true, snapshot };
  } catch (err) {
    if (err?.code === "P2002") {
      // Lost the race; the winner's row is the correct one.
      const winner = await prisma.performanceSnapshot.findUnique({
        where: { employeeId_periodType_periodStart: { employeeId, periodType, periodStart } },
      });
      return { created: false, snapshot: winner };
    }
    throw err;
  }
}

/**
 * Mark every CLOSED, UNSEALED period containing `date` as needing a
 * recompute. Called whenever something feeding a score changes after the
 * fact — a late review, a penalty set or cleared, a corrected import.
 *
 * A SEALED period is deliberately left alone: its source data is gone, so
 * recomputing it would invent a number rather than correct one.
 */
export async function markPeriodsStale({ employeeId, date, now = new Date() }) {
  if (!employeeId || !date) return { count: 0 };
  return prisma.performanceSnapshot.updateMany({
    where: {
      employeeId,
      periodStart: { lte: date },
      periodEnd: { gt: date },
      sealedAt: null,
    },
    data: { staleAt: now },
  });
}

/**
 * Recompute one snapshot in place.
 *
 * Uses compare-and-swap on staleAt (the same re-check pattern the break
 * sweep already uses): if a NEWER staleness marker arrives while we are
 * recomputing, the update matches nothing and the row stays stale for the
 * next pass — the newer change is never silently swallowed.
 */
export async function recomputeSnapshot({ snapshotId, actorUserId = null, now = new Date() }) {
  const snapshot = await prisma.performanceSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) return { recomputed: false, reason: "not-found" };
  if (snapshot.sealedAt) return { recomputed: false, reason: "sealed" };

  const observedStaleAt = snapshot.staleAt;
  const { employee, profile, facts, result } = await computePeriod({
    employeeId: snapshot.employeeId,
    periodType: snapshot.periodType,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
  });

  const data = snapshotData({
    employee, profile, facts, result,
    periodType: snapshot.periodType,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    // A recompute never upgrades completeness: if the data was already
    // partial when first captured, re-reading it now cannot make it whole.
    inputsComplete: snapshot.inputsComplete && snapshot.periodEnd >= daysAgo(SNAPSHOT_LOOKBACK_DAYS, now),
  });

  const updated = await prisma.performanceSnapshot.updateMany({
    where: { id: snapshotId, sealedAt: null, staleAt: observedStaleAt },
    data: { ...data, staleAt: null, computedAt: now },
  });
  if (updated.count === 0) return { recomputed: false, reason: "changed-during-recompute" };

  if (actorUserId) {
    await recordAudit({
      actorUserId,
      action: "PERFORMANCE_SNAPSHOT_RECOMPUTED",
      targetType: "PerformanceSnapshot",
      targetId: snapshotId,
      marketId: employee.marketId,
      previousValue: { score: snapshot.score, rawScore: snapshot.rawScore },
      newValue: { score: result.score, rawScore: result.rawScore },
    });
  }
  return { recomputed: true, score: result.score };
}

/**
 * The current, in-progress period — always computed live, never stored.
 */
export async function getCurrentPeriod({ employeeId, periodType = PERIOD_TYPES.MONTH, now = new Date() }) {
  const { start, end } = periodRange(periodType, now, 0);
  const { result } = await computePeriod({ employeeId, periodType, periodStart: start, periodEnd: end });
  return {
    periodType,
    periodStart: start,
    periodEnd: end,
    provisional: true,
    status: result.status,
    score: result.score,
    rawScore: result.rawScore,
    baseScore: result.baseScore,
    applicableMax: result.applicableMax,
    categories: result.categories,
    metrics: result.metrics,
    inputsComplete: true,
  };
}

/**
 * One specific period, by offset (0 = current, 1 = previous, ...).
 *
 * A closed period with no snapshot yet is computed AND persisted here —
 * the documented "periodic sweep + lazy on-read" dual pattern, so the data
 * is correct on a fresh deploy before the first tick ever fires.
 */
export async function getPeriod({ employeeId, periodType, offset = 0, now = new Date() }) {
  const { start, end } = periodRange(periodType, now, offset);
  if (end > now) return getCurrentPeriod({ employeeId, periodType, now });

  const existing = await prisma.performanceSnapshot.findUnique({
    where: { employeeId_periodType_periodStart: { employeeId, periodType, periodStart: start } },
  });
  if (existing) return existing;

  const { snapshot } = await snapshotPeriod({ employeeId, periodType, periodStart: start, periodEnd: end, now });
  return snapshot;
}

/**
 * Recent CLOSED periods, most recent first. Missing ones are filled in
 * lazily so a history request never shows a hole the sweep simply has not
 * reached yet.
 */
export async function getHistory({ employeeId, periodType, limit = 13, now = new Date() }) {
  const out = [];
  for (let offset = 1; offset <= limit; offset += 1) {
    const { end } = periodRange(periodType, now, offset);
    if (end > now) continue;
    out.push(await getPeriod({ employeeId, periodType, offset, now }));
  }
  return out;
}

/**
 * A combined 6-month or 1-year figure.
 *
 * Coverage-WEIGHTED by each month's applicableMax, never a naive mean of
 * already-rounded display scores (spec §12): a month with three working
 * days must not count the same as a full one. The curve is applied ONCE at
 * the end, to the weighted raw score — applying it per month and then
 * averaging would compress twice and understate a consistent performer.
 */
export async function getAggregate({ employeeId, months = 6, now = new Date() }) {
  const periods = closedPeriods(PERIOD_TYPES.MONTH, now, months);
  const empty = { months, covered: 0, coverage: `0/${months}`, status: "NO_DATA", score: null, rawScore: null };
  if (periods.length === 0) return empty;

  const oldestStart = periods[periods.length - 1].periodStart;
  const snapshots = await prisma.performanceSnapshot.findMany({
    where: {
      employeeId,
      periodType: PERIOD_TYPES.MONTH,
      periodStart: { gte: oldestStart },
      // A NO_DATA month contributes nothing and must not drag the average
      // down — it is absent from the coverage instead.
      rawScore: { not: null },
    },
    orderBy: { periodStart: "desc" },
    take: months,
  });
  if (snapshots.length === 0) return empty;

  let weightedRaw = 0;
  let totalWeight = 0;
  for (const s of snapshots) {
    const weight = s.applicableMax > 0 ? s.applicableMax : 0;
    weightedRaw += s.rawScore * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) {
    return { ...empty, covered: snapshots.length, coverage: `${snapshots.length}/${months}` };
  }

  const rawScore = weightedRaw / totalWeight;
  const profile = resolveProfile(await loadEmployee(employeeId));
  return {
    months,
    covered: snapshots.length,
    coverage: `${snapshots.length}/${months}`,
    status: "SCORED",
    rawScore: Math.round(rawScore * 100) / 100,
    score: applyCurve(rawScore, profile),
    // Any partial month in the window makes the whole figure partial.
    inputsComplete: snapshots.every((s) => s.inputsComplete),
  };
}

/**
 * Every scored employee in one market for one CLOSED period, ranked.
 *
 * Note this reads the snapshot's OWN marketId, which was frozen when the
 * period closed — so a market's history shows who was actually there at
 * the time, and a later transfer never rewrites which market an
 * employee's past performance belonged to.
 */
export async function listMarketPerformance({ marketId, periodType = PERIOD_TYPES.MONTH, offset = 1, now = new Date() }) {
  const { start, end } = periodRange(periodType, now, offset);
  const snapshots = await prisma.performanceSnapshot.findMany({
    where: { marketId, periodType, periodStart: start },
    orderBy: [{ score: "desc" }, { employeeId: "asc" }],
    include: { employee: { select: { id: true, name: true, employeeCode: true, role: true } } },
  });
  return { periodType, periodStart: start, periodEnd: end, marketId, employees: snapshots };
}

/**
 * The same, rolled up across every market in a zone.
 */
export async function listZonePerformance({ zoneId, periodType = PERIOD_TYPES.MONTH, offset = 1, now = new Date() }) {
  const { start, end } = periodRange(periodType, now, offset);
  const markets = await prisma.market.findMany({ where: { zoneId: Number(zoneId) }, select: { id: true } });
  const snapshots = await prisma.performanceSnapshot.findMany({
    where: { marketId: { in: markets.map((m) => m.id) }, periodType, periodStart: start },
    orderBy: [{ score: "desc" }, { employeeId: "asc" }],
    include: { employee: { select: { id: true, name: true, employeeCode: true, role: true } } },
  });
  return { periodType, periodStart: start, periodEnd: end, zoneId: Number(zoneId), employees: snapshots };
}

/**
 * One specific closed period by its exact start date, for the drill-down.
 * Returns null when nothing has been closed for that date — the caller
 * turns that into a 404 rather than inventing an empty score.
 */
export async function getPeriodByStart({ employeeId, periodType, periodStart }) {
  // Matched against the whole local DAY rather than an exact instant. A
  // period always starts at local midnight, but a caller supplies a
  // calendar date, and an exact-equality lookup makes the endpoint
  // silently timezone-dependent. There can only ever be one period of a
  // given type starting on a given day, so the range is still unambiguous.
  const dayStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return prisma.performanceSnapshot.findFirst({
    where: { employeeId, periodType, periodStart: { gte: dayStart, lt: dayEnd } },
  });
}
