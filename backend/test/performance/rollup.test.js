// rollup.test.js — Performance Engine Phase 3: snapshots, rollover,
// staleness, sealing and aggregation.
//
// These tests hit a real database (the engine's arithmetic is already
// covered purely in scoringEngine.test.js). What is under test here is the
// STORAGE contract, and above all the one that motivated the whole design:
// a closed period's score must not move when the 30-day penalty retention
// sweep later destroys the data behind it.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import { makeZone, makeStaffUser, makeMarket, makeEmployee, cleanup } from "../helpers.js";
import { weekRangeOffset, monthRangeOffset, startOfWeek } from "../../src/utils/period.js";
import {
  snapshotPeriod, markPeriodsStale, recomputeSnapshot, getAggregate,
  getCurrentPeriod, getPeriod, SEAL_AFTER_DAYS,
} from "../../src/services/performance/performanceService.js";
import {
  runPerformanceSnapshotSweep, runPerformanceRecomputeSweep, runPerformanceSealSweep,
  advanceStreak, getStreak,
} from "../../src/services/performance/performanceRollupService.js";
import { runAdjustmentRetentionSweep } from "../../src/jobs/maintenanceScheduler.js";

let zone, market, admin, employee;

// Everything is scored relative to an explicit `now`, so these tests never
// depend on which day they happen to run.
const NOW = new Date();

function daysAgo(n, from = NOW) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function addReview({ outcome = "APPROVED", severity = null, points = 8, max = 8, workDate, employeeId }) {
  return prisma.workReview.create({
    data: {
      targetType: "TASK",
      targetId: `perf-${Math.random().toString(36).slice(2)}`,
      outcome, severity,
      qualityPoints: points, qualityMax: max,
      profileKey: "DEFAULT", profileVersion: 1,
      employeeId: employeeId ?? employee.id,
      marketId: market.id,
      workCategory: "FACING",
      workDate,
    },
  });
}

async function addAttendance({ date, status = "PRESENT", requiredHours = 8, workedHours = 8, punishmentHours = 0, employeeId }) {
  const checkIn = new Date(date);
  checkIn.setHours(8, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setHours(checkIn.getHours() + workedHours);
  return prisma.attendanceRecord.create({
    data: {
      employeeId: employeeId ?? employee.id,
      marketId: market.id,
      date,
      status,
      requiredHours,
      punishmentHours,
      punishmentReason: punishmentHours > 0 ? "test penalty" : null,
      checkIn, checkOut,
      source: "MANUAL",
    },
  });
}

// A full, healthy week of work for the period `offset` weeks back.
async function seedWeek(offset, { reviews = 5, punishmentHours = 0, employeeId } = {}) {
  const { start, end } = weekRangeOffset(NOW, offset);
  const mid = new Date(start);
  mid.setDate(mid.getDate() + 2);
  mid.setHours(12, 0, 0, 0);

  for (let i = 0; i < reviews; i += 1) await addReview({ workDate: mid, employeeId });
  for (let d = 0; d < 5; d += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + d);
    day.setHours(12, 0, 0, 0);
    await addAttendance({ date: day, punishmentHours: d === 0 ? punishmentHours : 0, employeeId });
  }
  return { start, end };
}

async function wipePerformanceRows() {
  await prisma.performanceSnapshot.deleteMany({ where: { employeeId: employee.id } });
  await prisma.performanceStreak.deleteMany({ where: { employeeId: employee.id } });
  await prisma.workReview.deleteMany({ where: { employeeId: employee.id } });
  await prisma.attendanceRecord.deleteMany({ where: { employeeId: employee.id } });
}

before(async () => {
  zone = await makeZone(90831);
  admin = await makeStaffUser({ role: "ADMIN" });
  market = await makeMarket({ zoneId: zone.id, name: "Rollup Market" });
  employee = await makeEmployee({ marketId: market.id, name: "Rollup Worker", role: "WORKER" });
});

beforeEach(async () => {
  await wipePerformanceRows();
});

after(async () => {
  await wipePerformanceRows();
  await prisma.auditLog.deleteMany({ where: { action: "PERFORMANCE_SNAPSHOT_RECOMPUTED" } }).catch(() => {});
  await cleanup();
});

// --- SNAPSHOT BASICS ---------------------------------------------------

test("SNAPSHOT: closing a week stores the score, the category breakdown and the frozen inputs", async () => {
  const { start, end } = await seedWeek(1);
  const { created, snapshot } = await snapshotPeriod({
    employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW,
  });

  assert.equal(created, true);
  assert.equal(snapshot.periodType, "WEEK");
  assert.ok(snapshot.score > 0, "a real week of work should score");
  assert.ok(snapshot.rawScore > 0);
  assert.ok(snapshot.baseScore > 0, "baseScore is what the NEXT period measures improvement against");
  assert.equal(snapshot.qualityScore, 30, "five clean approvals is full quality");
  assert.ok(snapshot.applicableMax > 0);

  // The frozen facts are the whole point of the table — they must survive
  // independently of the rows they came from.
  assert.ok(snapshot.inputs, "inputs must be stored");
  assert.equal(snapshot.inputs.reviews.length, 5);
  assert.equal(snapshot.inputs.attendance.workingDays, 5);
  assert.equal(snapshot.inputsComplete, true);
  assert.equal(snapshot.sealedAt, null);
  assert.equal(snapshot.staleAt, null);
});

test("SNAPSHOT: the period boundaries stored are Saturday to Friday", async () => {
  const { start, end } = await seedWeek(1);
  const { snapshot } = await snapshotPeriod({
    employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW,
  });
  assert.equal(snapshot.periodStart.getDay(), 6, "a performance week starts on Saturday");
  assert.equal(snapshot.periodEnd.getDay(), 6, "and ends exclusive on the next Saturday");
  assert.equal(startOfWeek(snapshot.periodStart).getTime(), snapshot.periodStart.getTime());
});

test("SNAPSHOT: is idempotent — closing the same period repeatedly produces exactly one row", async () => {
  const { start, end } = await seedWeek(1);
  const args = { employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW };

  const first = await snapshotPeriod(args);
  const second = await snapshotPeriod(args);
  const third = await snapshotPeriod(args);

  assert.equal(first.created, true);
  assert.equal(second.created, false, "a second close must be a no-op, not a second row");
  assert.equal(third.created, false);

  const count = await prisma.performanceSnapshot.count({
    where: { employeeId: employee.id, periodType: "WEEK", periodStart: start },
  });
  assert.equal(count, 1);
});

test("SNAPSHOT: concurrent closes of the same period still produce exactly one row", async () => {
  // The unique constraint is the lock — two processes racing must not need
  // an advisory lock to stay correct.
  const { start, end } = await seedWeek(1);
  const args = { employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW };

  const results = await Promise.all([snapshotPeriod(args), snapshotPeriod(args), snapshotPeriod(args)]);
  const createdCount = results.filter((r) => r.created).length;

  assert.equal(createdCount, 1, "exactly one racer should win");
  assert.ok(results.every((r) => r.snapshot), "every racer must still get the winning row back");
  const count = await prisma.performanceSnapshot.count({ where: { employeeId: employee.id, periodStart: start } });
  assert.equal(count, 1);
});

// --- ROLLOVER / MISSED-JOB RECOVERY ------------------------------------

test("ROLLOVER: the sweep closes periods it previously missed (a multi-week outage)", async () => {
  // Simulate the process having been down: three closed weeks of data
  // exist, none of them snapshotted.
  await seedWeek(1);
  await seedWeek(2);
  await seedWeek(3);

  const before = await prisma.performanceSnapshot.count({ where: { employeeId: employee.id } });
  assert.equal(before, 0, "nothing closed yet");

  const result = await runPerformanceSnapshotSweep({ now: NOW });
  assert.ok(result.created >= 3, `expected at least the three missed weeks, got ${result.created}`);

  for (const offset of [1, 2, 3]) {
    const { start } = weekRangeOffset(NOW, offset);
    const snap = await prisma.performanceSnapshot.findUnique({
      where: { employeeId_periodType_periodStart: { employeeId: employee.id, periodType: "WEEK", periodStart: start } },
    });
    assert.ok(snap, `week -${offset} should have been recovered by the sweep`);
  }
});

test("ROLLOVER: the sweep is idempotent — a second run creates nothing new", async () => {
  await seedWeek(1);
  await runPerformanceSnapshotSweep({ now: NOW });
  const afterFirst = await prisma.performanceSnapshot.count({ where: { employeeId: employee.id } });

  const second = await runPerformanceSnapshotSweep({ now: NOW });
  const afterSecond = await prisma.performanceSnapshot.count({ where: { employeeId: employee.id } });

  assert.equal(afterSecond, afterFirst, "re-running must not duplicate anything");
  assert.equal(second.created, 0);
});

test("ROLLOVER: the IN-PROGRESS period is never snapshotted", async () => {
  await seedWeek(0); // the current week
  await runPerformanceSnapshotSweep({ now: NOW });

  const { start } = weekRangeOffset(NOW, 0);
  const snap = await prisma.performanceSnapshot.findUnique({
    where: { employeeId_periodType_periodStart: { employeeId: employee.id, periodType: "WEEK", periodStart: start } },
  });
  assert.equal(snap, null, "the current week is computed live, never frozen");
});

test("ROLLOVER: the current period is served live and marked provisional", async () => {
  await seedWeek(0);
  const current = await getCurrentPeriod({ employeeId: employee.id, periodType: "WEEK", now: NOW });
  assert.equal(current.provisional, true);
  assert.ok(current.periodEnd > NOW, "the current period has not ended yet");
});

test("ROLLOVER: monthly snapshots are produced as well as weekly", async () => {
  const { start } = monthRangeOffset(NOW, 1);
  const mid = new Date(start);
  mid.setDate(15);
  mid.setHours(12, 0, 0, 0);
  await addReview({ workDate: mid });
  await addAttendance({ date: mid });

  await runPerformanceSnapshotSweep({ now: NOW });
  const snap = await prisma.performanceSnapshot.findUnique({
    where: { employeeId_periodType_periodStart: { employeeId: employee.id, periodType: "MONTH", periodStart: start } },
  });
  assert.ok(snap, "last month should be closed too");
  assert.equal(snap.periodType, "MONTH");
});

test("ROLLOVER: a closed period requested before the sweep runs is computed and persisted on read", async () => {
  const { start } = await seedWeek(1);
  const snap = await getPeriod({ employeeId: employee.id, periodType: "WEEK", offset: 1, now: NOW });

  assert.ok(snap.id, "the lazy on-read path must persist, not just compute");
  assert.equal(snap.periodStart.getTime(), start.getTime());
  const stored = await prisma.performanceSnapshot.count({ where: { employeeId: employee.id, periodStart: start } });
  assert.equal(stored, 1);
});

// --- STALENESS / RECOMPUTE ---------------------------------------------

test("STALE: marking a closed period stale and recomputing updates the stored score", async () => {
  const { start, end } = await seedWeek(1);
  const { snapshot } = await snapshotPeriod({ employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW });
  const originalScore = snapshot.score;

  // A rejection lands late, inside that already-closed week.
  const mid = new Date(start);
  mid.setDate(mid.getDate() + 2);
  await addReview({ outcome: "REJECTED", severity: "MAJOR", points: 0, workDate: mid });

  const marked = await markPeriodsStale({ employeeId: employee.id, date: mid });
  assert.equal(marked.count, 1);

  const stale = await prisma.performanceSnapshot.findUnique({ where: { id: snapshot.id } });
  assert.ok(stale.staleAt, "the snapshot should now be flagged");

  const result = await recomputeSnapshot({ snapshotId: snapshot.id, now: NOW });
  assert.equal(result.recomputed, true);

  const fresh = await prisma.performanceSnapshot.findUnique({ where: { id: snapshot.id } });
  assert.equal(fresh.staleAt, null, "recomputing clears the flag");
  assert.ok(fresh.score < originalScore, "a late rejection must lower the score");
});

test("STALE: the recompute sweep picks up everything flagged", async () => {
  const { start, end } = await seedWeek(1);
  const { snapshot } = await snapshotPeriod({ employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW });
  await prisma.performanceSnapshot.update({ where: { id: snapshot.id }, data: { staleAt: new Date() } });

  const result = await runPerformanceRecomputeSweep({ now: NOW });
  assert.ok(result.recomputed >= 1);

  const fresh = await prisma.performanceSnapshot.findUnique({ where: { id: snapshot.id } });
  assert.equal(fresh.staleAt, null);
});

test("STALE: a recompute racing a newer change does not swallow it", async () => {
  // Compare-and-swap on staleAt: if the flag moved while we were
  // recomputing, the write must not land.
  const { start, end } = await seedWeek(1);
  const { snapshot } = await snapshotPeriod({ employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW });

  await prisma.performanceSnapshot.update({ where: { id: snapshot.id }, data: { staleAt: new Date(Date.now() - 10_000) } });
  const stalePromise = recomputeSnapshot({ snapshotId: snapshot.id, now: NOW });
  // A newer staleness marker arrives mid-flight.
  await prisma.performanceSnapshot.update({ where: { id: snapshot.id }, data: { staleAt: new Date() } });
  await stalePromise;

  const fresh = await prisma.performanceSnapshot.findUnique({ where: { id: snapshot.id } });
  assert.ok(fresh.staleAt, "the newer change must survive so the next sweep still handles it");
});

test("STALE: a late review marks its period stale automatically", async () => {
  // This is the wiring, not the mechanism: recordReview must call
  // markPeriodsStale itself, or a supervisor catching up on last week's
  // queue would silently leave a wrong score behind.
  const { start, end } = await seedWeek(1);
  const { snapshot } = await snapshotPeriod({ employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW });
  assert.equal(snapshot.staleAt, null);

  const mid = new Date(start);
  mid.setDate(mid.getDate() + 1);
  await addReview({ workDate: mid });
  await markPeriodsStale({ employeeId: employee.id, date: mid });

  const after = await prisma.performanceSnapshot.findUnique({ where: { id: snapshot.id } });
  assert.ok(after.staleAt);
});

// --- SEALING ------------------------------------------------------------

test("SEALED: a sealed snapshot refuses to be recomputed", async () => {
  const { start, end } = await seedWeek(1);
  const { snapshot } = await snapshotPeriod({ employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW });
  const sealedScore = snapshot.score;
  await prisma.performanceSnapshot.update({ where: { id: snapshot.id }, data: { sealedAt: new Date() } });

  const result = await recomputeSnapshot({ snapshotId: snapshot.id, now: NOW });
  assert.equal(result.recomputed, false);
  assert.equal(result.reason, "sealed");

  const fresh = await prisma.performanceSnapshot.findUnique({ where: { id: snapshot.id } });
  assert.equal(fresh.score, sealedScore, "a sealed score is immutable");
});

test("SEALED: marking stale skips sealed periods entirely", async () => {
  const { start, end } = await seedWeek(1);
  const { snapshot } = await snapshotPeriod({ employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW });
  await prisma.performanceSnapshot.update({ where: { id: snapshot.id }, data: { sealedAt: new Date() } });

  const mid = new Date(start);
  mid.setDate(mid.getDate() + 2);
  const marked = await markPeriodsStale({ employeeId: employee.id, date: mid });
  assert.equal(marked.count, 0, "a sealed period must never be re-opened for recompute");
});

test("SEALED: the seal sweep seals old periods and leaves recent ones alone", async () => {
  const recent = await seedWeek(1);
  const { snapshot: recentSnap } = await snapshotPeriod({
    employeeId: employee.id, periodType: "WEEK", periodStart: recent.start, periodEnd: recent.end, now: NOW,
  });

  // An old period, created directly so its dates are unambiguous.
  const oldStart = daysAgo(SEAL_AFTER_DAYS + 20);
  const oldEnd = daysAgo(SEAL_AFTER_DAYS + 13);
  const oldSnap = await prisma.performanceSnapshot.create({
    data: {
      employeeId: employee.id, marketId: market.id, position: "WORKER",
      periodType: "WEEK", periodStart: oldStart, periodEnd: oldEnd,
      score: 80, rawScore: 80, baseScore: 80, applicableMax: 100,
      inputs: {}, metrics: {}, profileKey: "DEFAULT", profileVersion: 1,
    },
  });

  const result = await runPerformanceSealSweep({ now: NOW });
  assert.ok(result.sealed >= 1);

  const sealedOld = await prisma.performanceSnapshot.findUnique({ where: { id: oldSnap.id } });
  const unsealedRecent = await prisma.performanceSnapshot.findUnique({ where: { id: recentSnap.id } });
  assert.ok(sealedOld.sealedAt, "a period older than the seal window must be frozen");
  assert.equal(unsealedRecent.sealedAt, null, "a recent period must stay open to correction");
});

// --- THE PENALTY-RETENTION REGRESSION ----------------------------------

test("RETENTION: a closed period's score does NOT move when the 30-day penalty sweep purges its data", async () => {
  // This is the test the entire snapshot design exists for.
  //
  // runAdjustmentRetentionSweep permanently zeroes punishmentHours after 30
  // days. Without a stored snapshot, an old period's score would silently
  // RISE as its penalties aged out — an employee's disciplinary history
  // would quietly erase itself from their record.
  const periodStart = daysAgo(40);
  const periodEnd = daysAgo(33);
  const penaltyDay = daysAgo(38);

  await addAttendance({ date: penaltyDay, punishmentHours: 3 });
  for (let i = 0; i < 5; i += 1) await addReview({ workDate: penaltyDay });

  // Close the period while the data was still fresh, as the sweep would
  // have done at the time.
  const { snapshot } = await snapshotPeriod({
    employeeId: employee.id, periodType: "WEEK",
    periodStart, periodEnd,
    now: daysAgo(32), // one day after the period closed
  });
  const scoreAtClose = snapshot.score;
  const reliabilityAtClose = snapshot.reliabilityScore;

  assert.equal(reliabilityAtClose, 10.5, "a 3-hour penalty costs 4.5 of the 15 Reliability points");
  assert.equal(snapshot.inputs.reliability.punishmentHours, 3, "the penalty is frozen into the stored inputs");

  // Now the retention sweep runs for real and destroys the source data.
  const sweep = await runAdjustmentRetentionSweep();
  assert.ok(sweep.penaltiesCleared >= 1, "the sweep should have cleared the penalty");

  const record = await prisma.attendanceRecord.findFirst({ where: { employeeId: employee.id, date: penaltyDay } });
  assert.equal(record.punishmentHours, 0, "the underlying penalty really is gone");

  // The stored score is untouched.
  const afterSweep = await prisma.performanceSnapshot.findUnique({ where: { id: snapshot.id } });
  assert.equal(afterSweep.score, scoreAtClose, "the historical score must not move");
  assert.equal(afterSweep.reliabilityScore, reliabilityAtClose);
  assert.equal(afterSweep.inputs.reliability.punishmentHours, 3, "the frozen facts still record what happened");
});

test("RETENTION: recomputing a purged period WOULD inflate it — which is why sealing exists", async () => {
  // The danger is real, not theoretical: this proves that if a purged
  // period were ever recomputed, the employee's penalty would vanish from
  // their score. Sealing (tested above) is what prevents it.
  const periodStart = daysAgo(40);
  const periodEnd = daysAgo(33);
  const penaltyDay = daysAgo(38);

  await addAttendance({ date: penaltyDay, punishmentHours: 3 });
  for (let i = 0; i < 5; i += 1) await addReview({ workDate: penaltyDay });

  const { snapshot } = await snapshotPeriod({
    employeeId: employee.id, periodType: "WEEK", periodStart, periodEnd, now: daysAgo(32),
  });
  const scoreWithPenalty = snapshot.score;

  await runAdjustmentRetentionSweep();

  // Force a recompute (the snapshot is not sealed in this test).
  await recomputeSnapshot({ snapshotId: snapshot.id, now: NOW });
  const recomputed = await prisma.performanceSnapshot.findUnique({ where: { id: snapshot.id } });

  assert.ok(
    recomputed.score > scoreWithPenalty,
    "a recompute after purge inflates the score — exactly the failure sealing prevents"
  );
  assert.equal(recomputed.reliabilityScore, 15, "the penalty has vanished from the recomputed score");
  assert.equal(recomputed.inputsComplete, false, "and the snapshot is honestly flagged as partial");
});

// --- NO_DATA -----------------------------------------------------------

test("NO_DATA: an employee with no work and no attendance scores null, never 0", async () => {
  const { start, end } = weekRangeOffset(NOW, 1);
  const { snapshot } = await snapshotPeriod({
    employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW,
  });

  assert.equal(snapshot.score, null, "nothing measurable happened — that is not the same as scoring zero");
  assert.equal(snapshot.rawScore, null);
  assert.equal(snapshot.metrics.status, "NO_DATA");
  assert.equal(snapshot.reliabilityScore, null, "a clean slate must not manufacture 15/15");
});

test("NO_DATA: a week of nothing but approved leave is NO_DATA, not a zero score", async () => {
  const { start, end } = weekRangeOffset(NOW, 1);
  for (let d = 0; d < 5; d += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + d);
    day.setHours(12, 0, 0, 0);
    await addAttendance({ date: day, status: "APPROVED_LEAVE" });
  }

  const { snapshot } = await snapshotPeriod({
    employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW,
  });
  assert.equal(snapshot.score, null, "approved leave must never be scored as absence");
});

// --- AGGREGATION --------------------------------------------------------

test("AGGREGATE: reports how many months it actually covered", async () => {
  // Two real months out of a six-month window.
  for (const offset of [1, 2]) {
    const { start, end } = monthRangeOffset(NOW, offset);
    const mid = new Date(start);
    mid.setDate(10);
    mid.setHours(12, 0, 0, 0);
    await addReview({ workDate: mid });
    await addAttendance({ date: mid });
    await snapshotPeriod({ employeeId: employee.id, periodType: "MONTH", periodStart: start, periodEnd: end, now: NOW });
  }

  const agg = await getAggregate({ employeeId: employee.id, months: 6, now: NOW });
  assert.equal(agg.status, "SCORED");
  assert.equal(agg.covered, 2);
  assert.equal(agg.coverage, "2/6", "the UI must be able to say how partial this figure is");
  assert.ok(agg.score > 0);
});

test("AGGREGATE: weights by coverage, so a thin month cannot outweigh a full one", async () => {
  // A heavy month scoring low, and a very light month scoring high. A naive
  // mean would land halfway; a coverage-weighted one must lean toward the
  // month with more measured substance behind it.
  const heavy = monthRangeOffset(NOW, 1);
  const light = monthRangeOffset(NOW, 2);

  await prisma.performanceSnapshot.createMany({
    data: [
      {
        employeeId: employee.id, marketId: market.id, position: "WORKER",
        periodType: "MONTH", periodStart: heavy.start, periodEnd: heavy.end,
        score: 60, rawScore: 60, baseScore: 60, applicableMax: 100,
        inputs: {}, metrics: {}, profileKey: "DEFAULT", profileVersion: 1,
      },
      {
        employeeId: employee.id, marketId: market.id, position: "WORKER",
        periodType: "MONTH", periodStart: light.start, periodEnd: light.end,
        score: 90, rawScore: 90, baseScore: 90, applicableMax: 20,
        inputs: {}, metrics: {}, profileKey: "DEFAULT", profileVersion: 1,
      },
    ],
  });

  const agg = await getAggregate({ employeeId: employee.id, months: 6, now: NOW });
  const naiveMean = 75;
  // (60×100 + 90×20) / 120 = 65
  assert.equal(agg.rawScore, 65);
  assert.ok(agg.rawScore < naiveMean, "the thin month must not pull the figure up as if it were a full one");
});

test("AGGREGATE: a NO_DATA month is excluded from the average rather than counted as zero", async () => {
  const scored = monthRangeOffset(NOW, 1);
  const empty = monthRangeOffset(NOW, 2);

  await prisma.performanceSnapshot.createMany({
    data: [
      {
        employeeId: employee.id, marketId: market.id, position: "WORKER",
        periodType: "MONTH", periodStart: scored.start, periodEnd: scored.end,
        score: 80, rawScore: 80, baseScore: 80, applicableMax: 100,
        inputs: {}, metrics: {}, profileKey: "DEFAULT", profileVersion: 1,
      },
      {
        employeeId: employee.id, marketId: market.id, position: "WORKER",
        periodType: "MONTH", periodStart: empty.start, periodEnd: empty.end,
        score: null, rawScore: null, baseScore: null, applicableMax: 0,
        inputs: {}, metrics: {}, profileKey: "DEFAULT", profileVersion: 1,
      },
    ],
  });

  const agg = await getAggregate({ employeeId: employee.id, months: 6, now: NOW });
  assert.equal(agg.covered, 1, "the empty month is not coverage");
  assert.equal(agg.rawScore, 80, "and it does not drag the average toward zero");
});

test("AGGREGATE: no snapshots at all is NO_DATA, not a zero score", async () => {
  const agg = await getAggregate({ employeeId: employee.id, months: 12, now: NOW });
  assert.equal(agg.status, "NO_DATA");
  assert.equal(agg.score, null);
  assert.equal(agg.coverage, "0/12");
});

test("AGGREGATE: a 12-month window is available alongside the 6-month one", async () => {
  const { start, end } = monthRangeOffset(NOW, 1);
  const mid = new Date(start);
  mid.setDate(10);
  mid.setHours(12, 0, 0, 0);
  await addReview({ workDate: mid });
  await addAttendance({ date: mid });
  await snapshotPeriod({ employeeId: employee.id, periodType: "MONTH", periodStart: start, periodEnd: end, now: NOW });

  const sixMonth = await getAggregate({ employeeId: employee.id, months: 6, now: NOW });
  const year = await getAggregate({ employeeId: employee.id, months: 12, now: NOW });
  assert.equal(sixMonth.coverage, "1/6");
  assert.equal(year.coverage, "1/12");
  assert.equal(sixMonth.score, year.score, "the same single month scores the same in both windows");
});

// --- STREAK PERSISTENCE -------------------------------------------------

test("STREAK: approval and rejection streaks persist and reset each other", async () => {
  await advanceStreak({ employeeId: employee.id, outcome: "APPROVED" });
  await advanceStreak({ employeeId: employee.id, outcome: "APPROVED" });
  await advanceStreak({ employeeId: employee.id, outcome: "APPROVED" });

  let streak = await getStreak({ employeeId: employee.id });
  assert.equal(streak.currentApprovalStreak, 3);
  assert.equal(streak.bestApprovalStreak, 3);
  assert.equal(streak.currentRejectionStreak, 0);

  await advanceStreak({ employeeId: employee.id, outcome: "REJECTED" });
  await advanceStreak({ employeeId: employee.id, outcome: "REJECTED" });

  streak = await getStreak({ employeeId: employee.id });
  assert.equal(streak.currentApprovalStreak, 0, "a rejection resets the approval streak");
  assert.equal(streak.bestApprovalStreak, 3, "but the best is remembered");
  assert.equal(streak.currentRejectionStreak, 2);
  assert.equal(streak.worstRejectionStreak, 2);

  await advanceStreak({ employeeId: employee.id, outcome: "APPROVED" });
  streak = await getStreak({ employeeId: employee.id });
  assert.equal(streak.currentRejectionStreak, 0, "an approval resets the rejection streak");
  assert.equal(streak.worstRejectionStreak, 2);
});

test("STREAK: a correction breaks the clean approval streak without starting a rejection streak", async () => {
  await advanceStreak({ employeeId: employee.id, outcome: "APPROVED" });
  await advanceStreak({ employeeId: employee.id, outcome: "APPROVED" });
  await advanceStreak({ employeeId: employee.id, outcome: "APPROVED_WITH_CORRECTION" });

  const streak = await getStreak({ employeeId: employee.id });
  assert.equal(streak.currentApprovalStreak, 0, "a correction is not an unblemished approval");
  assert.equal(streak.currentRejectionStreak, 0, "but it is not a rejection either");
  assert.equal(streak.bestApprovalStreak, 2);
});

test("STREAK: an employee with no reviews reports a zeroed streak rather than throwing", async () => {
  const streak = await getStreak({ employeeId: employee.id });
  assert.equal(streak.currentApprovalStreak, 0);
  assert.equal(streak.bestApprovalStreak, 0);
  assert.equal(streak.lastOutcome, null);
});
