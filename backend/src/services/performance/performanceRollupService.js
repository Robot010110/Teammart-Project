// performanceRollupService.js — the three background sweeps that keep
// snapshots current, and the streak counters that ride along with reviews.
//
// Performance Engine §C. This app has no cron library and no job queue, so
// these follow the pattern already established by nightShiftService: plain
// exported async functions containing the logic, scheduled by
// maintenanceScheduler with setInterval, and callable directly from tests
// without starting any interval.
//
// The property that makes all of this safe is that every sweep is DRIVEN BY
// ABSENCE, not by time: each asks "which closed periods have no snapshot
// yet" / "which snapshots are marked stale", never "did I already run
// today". There is no run-state anywhere, so a missed tick, a multi-day
// outage or a cold start all self-heal on the next pass — the same
// self-healing property as createMany({ skipDuplicates: true }).

import { prisma } from "../../lib/prisma.js";
import { closedPeriods, PERIOD_TYPES } from "../../utils/period.js";
import { snapshotPeriod, recomputeSnapshot, SEAL_AFTER_DAYS, SNAPSHOT_LOOKBACK_DAYS, daysAgo } from "./performanceService.js";

// Only employees are scored at launch (spec §15 / the role-scope decision):
// penalty, required-hours and attendance-rate rules apply to Employee rows
// only, never to staff, so a Supervisor has no data for 45 of the 100
// points. The architecture leaves per-role profiles open; this is simply
// who is in scope today.
const SCORABLE_ACCOUNT_STATUSES = ["ACTIVE"];

/**
 * Close out every period that has ended and has no snapshot yet.
 *
 * Bounded deliberately: the driving question is "periods missing
 * snapshots", which is empty on the overwhelming majority of ticks. The
 * naive alternative — recompute everyone every tick — would be a genuine
 * production load problem at a 30-minute cadence.
 */
export async function runPerformanceSnapshotSweep({ now = new Date(), lookbackDays = SNAPSHOT_LOOKBACK_DAYS } = {}) {
  const weekPeriods = closedPeriods(PERIOD_TYPES.WEEK, now, Math.ceil(lookbackDays / 7) + 1);
  const monthPeriods = closedPeriods(PERIOD_TYPES.MONTH, now, 2);
  const cutoff = daysAgo(lookbackDays, now);
  const wanted = [...weekPeriods, ...monthPeriods].filter((p) => p.periodEnd >= cutoff);
  if (wanted.length === 0) return { created: 0, skipped: 0, failed: 0 };

  const employees = await prisma.employee.findMany({
    where: { accountStatus: { in: SCORABLE_ACCOUNT_STATUSES } },
    select: { id: true },
  });

  // One query for everything already closed in this window, so the sweep
  // does not issue a lookup per employee per period.
  const existing = await prisma.performanceSnapshot.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      periodStart: { gte: wanted.reduce((min, p) => (p.periodStart < min ? p.periodStart : min), wanted[0].periodStart) },
    },
    select: { employeeId: true, periodType: true, periodStart: true },
  });
  const have = new Set(existing.map((s) => `${s.employeeId}|${s.periodType}|${s.periodStart.getTime()}`));

  let created = 0, skipped = 0, failed = 0;
  for (const employee of employees) {
    for (const period of wanted) {
      if (have.has(`${employee.id}|${period.periodType}|${period.periodStart.getTime()}`)) {
        skipped += 1;
        continue;
      }
      try {
        const result = await snapshotPeriod({
          employeeId: employee.id,
          periodType: period.periodType,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          now,
        });
        if (result.created) created += 1;
        else skipped += 1;
      } catch (err) {
        // Per-employee isolation, same as the existing sweeps: one bad row
        // must never stop the rest of the company being scored.
        failed += 1;
        console.error(`Performance snapshot failed for employee ${employee.id}:`, err);
      }
    }
  }
  return { created, skipped, failed };
}

/**
 * Recompute snapshots marked stale by a late review, penalty or import fix.
 */
export async function runPerformanceRecomputeSweep({ now = new Date(), take = 200 } = {}) {
  const stale = await prisma.performanceSnapshot.findMany({
    where: { staleAt: { not: null }, sealedAt: null },
    orderBy: { staleAt: "asc" },
    take,
    select: { id: true },
  });

  let recomputed = 0, skipped = 0, failed = 0;
  for (const { id } of stale) {
    try {
      const result = await recomputeSnapshot({ snapshotId: id, now });
      if (result.recomputed) recomputed += 1;
      else skipped += 1;
    } catch (err) {
      failed += 1;
      console.error(`Performance recompute failed for snapshot ${id}:`, err);
    }
  }
  return { recomputed, skipped, failed };
}

/**
 * Seal snapshots whose period ended longer ago than SEAL_AFTER_DAYS.
 *
 * Sealing happens INSIDE the 30-day penalty retention window on purpose —
 * see SEAL_AFTER_DAYS' own comment. A sealed snapshot is immutable; a late
 * change to one is recorded as an audit row and refused, because the data
 * needed to recompute it honestly no longer exists.
 */
export async function runPerformanceSealSweep({ now = new Date() } = {}) {
  const cutoff = daysAgo(SEAL_AFTER_DAYS, now);
  const result = await prisma.performanceSnapshot.updateMany({
    where: { sealedAt: null, periodEnd: { lt: cutoff } },
    data: { sealedAt: now, staleAt: null },
  });
  return { sealed: result.count };
}

// ---------------------------------------------------------------------
// Streak persistence
// ---------------------------------------------------------------------

// A streak belongs to the employee's TIMELINE, not to a calendar bucket —
// an approval run spanning a week boundary is still one run. So it is
// advanced incrementally as each review lands (O(1)) rather than
// recomputed by scanning history.
//
// Three tracks, matching the engine's own definitions:
//   clean      only a plain APPROVED continues it (this is the streak
//              users are shown — a correction is an acceptance, but not an
//              unblemished approval)
//   rejection  only REJECTED continues it
//   acceptance implicit: anything that is not a rejection
export async function advanceStreak({ employeeId, outcome, reviewedAt = new Date(), client = prisma }) {
  const existing = await client.performanceStreak.findUnique({ where: { employeeId } });

  const prevApproval = existing?.currentApprovalStreak ?? 0;
  const prevRejection = existing?.currentRejectionStreak ?? 0;
  const bestApproval = existing?.bestApprovalStreak ?? 0;
  const worstRejection = existing?.worstRejectionStreak ?? 0;

  const isClean = outcome === "APPROVED";
  const isRejected = outcome === "REJECTED";

  const currentApprovalStreak = isClean ? prevApproval + 1 : 0;
  const currentRejectionStreak = isRejected ? prevRejection + 1 : 0;

  const data = {
    currentApprovalStreak,
    currentRejectionStreak,
    bestApprovalStreak: Math.max(bestApproval, currentApprovalStreak),
    worstRejectionStreak: Math.max(worstRejection, currentRejectionStreak),
    lastOutcome: outcome,
    lastReviewAt: reviewedAt,
  };

  return client.performanceStreak.upsert({
    where: { employeeId },
    create: { employeeId, ...data },
    update: data,
  });
}

export async function getStreak({ employeeId, client = prisma }) {
  const streak = await client.performanceStreak.findUnique({ where: { employeeId } });
  return (
    streak ?? {
      employeeId,
      currentApprovalStreak: 0,
      bestApprovalStreak: 0,
      currentRejectionStreak: 0,
      worstRejectionStreak: 0,
      lastOutcome: null,
      lastReviewAt: null,
    }
  );
}
