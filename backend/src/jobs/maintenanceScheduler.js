import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma.js";
import { UPLOADS_DIR } from "../utils/fileStorage.js";
import { createNotification, createNotificationForUser } from "../utils/notifications.js";
import { getBreakNotificationCopy } from "../utils/breakNotificationCopy.js";
import { generateNightShiftTasks } from "../services/nightShiftService.js";
import { runSelfServiceBreakReminderSweep } from "../controllers/attendanceController.js";
import {
  runPerformanceSnapshotSweep,
  runPerformanceRecomputeSweep,
  runPerformanceSealSweep,
} from "../services/performance/performanceRollupService.js";

// maintenanceScheduler.js — Phase 2's answer to "improve break
// completion so it doesn't depend on a user opening a screen" and "the
// backend must periodically find expired department images". This app
// has no scheduler/job-queue infrastructure at all (checked before
// writing this — no node-cron, no bullmq, no agenda in package.json or
// anywhere in src/), so introducing one wholesale would be exactly the
// "huge infrastructure system" the spec says not to build. A plain
// `setInterval` inside the same Node process is the minimal mechanism
// that's actually appropriate here — no new dependency, no new service
// to deploy/monitor, and every sweep function below is already safe to
// call from anywhere else too (the lazy on-read paths from Phase 1 —
// breakService.withLazyCompletion, the equivalent photo check — still
// exist and still work; this just means a screen no longer has to be
// opened for either to happen).
//
// Both sweeps are read-then-update on a WHERE clause that only ever
// matches not-yet-processed rows, so calling either function twice in a
// row (this interval firing while a manual call is already in flight,
// a restart mid-sweep, whatever) is always safe — the second call
// simply finds nothing left to do.

const BREAK_SWEEP_INTERVAL_MS = 60 * 1000; // every minute — a break only needs to flip within ~a minute of its expected end, not instantly
const PHOTO_SWEEP_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes — a 16-hour retention window has no need for finer granularity
const NIGHT_SHIFT_GENERATION_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes — idempotent (createMany skipDuplicates), so a tight interval just means new/newly-eligible employees pick up tonight's tasks quickly
const ADJUSTMENT_RETENTION_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours — a 30-day retention window has no need for tighter polling
// WARNING — LOAD-BEARING VALUE. The Performance engine seals its snapshots
// at SEAL_AFTER_DAYS (25) and refuses to trust facts older than
// SNAPSHOT_LOOKBACK_DAYS (24), both in
// services/performance/performanceService.js, specifically so that a
// closed period is always frozen BEFORE the penalty data behind it is
// destroyed by runAdjustmentRetentionSweep below. Lowering this number
// below either of those makes historical performance scores silently
// inflate as penalties age out, with no error raised anywhere.
const ADJUSTMENT_RETENTION_DAYS = 30;

// Performance rollover. All three are driven by ABSENCE rather than by
// time (see performanceRollupService's own comment), so a missed tick or a
// multi-day outage self-heals on the next pass — there is no run-state to
// get out of sync.
const PERFORMANCE_SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes — a period boundary only needs closing within the hour
const PERFORMANCE_RECOMPUTE_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes — a late review should be reflected promptly
const PERFORMANCE_SEAL_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours — piggybacks the retention cadence it must stay ahead of

// ACTIVE -> COMPLETED for every break whose expectedEndTime has passed.
// Idempotent: the WHERE clause only ever matches rows still ACTIVE, so a
// row already flipped by a previous sweep (or by the lazy on-read path in
// breakService.withLazyCompletion, still in place from Phase 1) is
// simply not selected again — no double notification, no double update.
export async function runBreakCompletionSweep() {
  const now = new Date();
  const dueBreaks = await prisma.break.findMany({
    where: { status: "ACTIVE", expectedEndTime: { lte: now } },
    select: {
      id: true, expectedEndTime: true, employeeId: true, staffUserId: true,
      employee: { select: { language: true } },
      staffUser: { select: { language: true } },
    },
  });

  let completed = 0;
  for (const brk of dueBreaks) {
    try {
      // Re-check status inside the update itself (not just the findMany
      // above) so a concurrent confirm/cancel racing this sweep can't be
      // clobbered — updateMany with status: "ACTIVE" in the WHERE only
      // touches the row if it's still exactly the state we expect.
      const result = await prisma.break.updateMany({
        where: { id: brk.id, status: "ACTIVE" },
        data: { status: "COMPLETED", actualEndTime: brk.expectedEndTime },
      });
      if (result.count === 0) continue; // already handled elsewhere between the read and here

      completed += 1;
      if (brk.employeeId) {
        const copy = getBreakNotificationCopy("ENDED", brk.employee?.language ?? "ENGLISH");
        await createNotification({
          employeeId: brk.employeeId,
          type: "BREAK_COMPLETED",
          title: copy.title,
          body: copy.body,
          linkType: "BREAK",
          linkId: brk.id,
        });
      } else if (brk.staffUserId) {
        const copy = getBreakNotificationCopy("ENDED", brk.staffUser?.language ?? "ENGLISH");
        await createNotificationForUser({
          userId: brk.staffUserId,
          type: "BREAK_COMPLETED",
          title: copy.title,
          body: copy.body,
          linkType: "BREAK",
          linkId: brk.id,
        });
      }
    } catch (err) {
      // One bad row must never stop the rest of the sweep — logged, not
      // thrown, same "partial failure isolated per-item" approach as the
      // photo sweep below.
      console.error(`Break completion sweep failed for break ${brk.id}:`, err);
    }
  }
  return { checked: dueBreaks.length, completed };
}

function extractFilename(url) {
  const match = /\/api\/uploads\/([0-9a-f-]{36}\.[a-z0-9]{1,10})$/i.exec(url ?? "");
  return match ? match[1] : null;
}

// Deletes the physical file + UploadedFile row for every expired,
// not-yet-processed ActivityImage, then marks it expiredAt so it's never
// reprocessed. Every step tolerates the thing it's deleting already
// being gone (a previous partial run, manual cleanup, whatever) — see
// each .catch() below — and a failure on one image never blocks the
// rest of the sweep (spec §9: "resistant to partial failures... safe if
// the physical file is already missing... must not crash permanently").
export async function runDepartmentPhotoExpirySweep() {
  const now = new Date();
  const expired = await prisma.activityImage.findMany({
    where: { expiresAt: { lte: now }, expiredAt: null },
  });

  let processed = 0;
  for (const image of expired) {
    try {
      const filename = extractFilename(image.url);
      if (filename) {
        await unlink(path.join(UPLOADS_DIR, filename)).catch(() => {}); // already-missing file is fine
        await prisma.uploadedFile.delete({ where: { filename } }).catch(() => {}); // already-missing row is fine
      }
      // Re-checked with expiredAt: null in the WHERE, same
      // race-tolerance reasoning as the break sweep above — if something
      // else already marked this expired between the findMany and here,
      // this simply matches zero rows instead of double-processing.
      await prisma.activityImage.updateMany({
        where: { id: image.id, expiredAt: null },
        data: { expiredAt: now },
      });
      processed += 1;
    } catch (err) {
      console.error(`Photo expiry sweep failed for ActivityImage ${image.id}:`, err);
    }
  }
  return { checked: expired.length, processed };
}

// Deletes RequiredHoursAdjustment rows, and clears
// punishmentHours/punishmentReason on AttendanceRecord, once 30 days
// past the day they apply to. Both are the AUDIT/EXPLANATION side of an
// already-applied number, not the number itself in the
// RequiredHoursAdjustment case — creating one already writes the new
// requiredHours directly onto AttendanceRecord (see
// attendanceController.createRequiredHoursAdjustment's own comment), so
// deleting the audit row here never changes a day's already-computed
// required hours retroactively, only removes the "why" explanation once
// it's no longer needed. Punishment is different: punishmentHours/
// punishmentReason live directly on AttendanceRecord with no separate
// row, so "delete the penalty" after 30 days means resetting those two
// columns back to their defaults on that record — this DOES change what
// a subsequent attendance-rate calculation for that old day would show,
// which is the intended behavior here (a stale, months-old penalty flag
// is expected to age out), not an accident.
export async function runAdjustmentRetentionSweep() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ADJUSTMENT_RETENTION_DAYS);

  const deletedAdjustments = await prisma.requiredHoursAdjustment.deleteMany({
    where: { date: { lt: cutoff } },
  });

  const clearedPenalties = await prisma.attendanceRecord.updateMany({
    where: { date: { lt: cutoff }, OR: [{ punishmentHours: { gt: 0 } }, { punishmentReason: { not: null } }] },
    data: { punishmentHours: 0, punishmentReason: null },
  });

  return { adjustmentsDeleted: deletedAdjustments.count, penaltiesCleared: clearedPenalties.count };
}

let breakInterval, photoInterval, nightShiftInterval, adjustmentRetentionInterval;
let perfSnapshotInterval, perfRecomputeInterval, perfSealInterval, selfServiceBreakReminderInterval;

// Called once from index.js at startup. Kept separate from module load
// so tests can import the sweep functions directly without accidentally
// starting a background interval in the test process.
export function startMaintenanceScheduler() {
  if (breakInterval || photoInterval || nightShiftInterval || adjustmentRetentionInterval) return; // already started — never double-schedule
  breakInterval = setInterval(() => {
    runBreakCompletionSweep().catch((err) => console.error("Break completion sweep crashed:", err));
  }, BREAK_SWEEP_INTERVAL_MS);
  // Attendance + Shift Timing §7/§8 — the SEPARATE self-service break
  // (AttendanceRecord.breakStart/breakEnd, not the Break model above).
  // Same interval/idempotency shape as the sweep just above, just a
  // different table — see attendanceController.runSelfServiceBreakReminderSweep.
  selfServiceBreakReminderInterval = setInterval(() => {
    runSelfServiceBreakReminderSweep().catch((err) => console.error("Self-service break reminder sweep crashed:", err));
  }, BREAK_SWEEP_INTERVAL_MS);
  photoInterval = setInterval(() => {
    runDepartmentPhotoExpirySweep().catch((err) => console.error("Department photo expiry sweep crashed:", err));
  }, PHOTO_SWEEP_INTERVAL_MS);
  // Night Shift §9 — idempotent daily task generation, same "periodic
  // sweep + lazy on-read" dual pattern as the two sweeps above (the lazy
  // path lives in nightShiftController.getMyNightShiftDashboard).
  nightShiftInterval = setInterval(() => {
    generateNightShiftTasks().catch((err) => console.error("Night Shift task generation crashed:", err));
  }, NIGHT_SHIFT_GENERATION_INTERVAL_MS);
  adjustmentRetentionInterval = setInterval(() => {
    runAdjustmentRetentionSweep().catch((err) => console.error("Adjustment retention sweep crashed:", err));
  }, ADJUSTMENT_RETENTION_SWEEP_INTERVAL_MS);
  perfSnapshotInterval = setInterval(() => {
    runPerformanceSnapshotSweep().catch((err) => console.error("Performance snapshot sweep crashed:", err));
  }, PERFORMANCE_SNAPSHOT_INTERVAL_MS);
  perfRecomputeInterval = setInterval(() => {
    runPerformanceRecomputeSweep().catch((err) => console.error("Performance recompute sweep crashed:", err));
  }, PERFORMANCE_RECOMPUTE_INTERVAL_MS);
  perfSealInterval = setInterval(() => {
    runPerformanceSealSweep().catch((err) => console.error("Performance seal sweep crashed:", err));
  }, PERFORMANCE_SEAL_INTERVAL_MS);

  // Unref every interval — a scheduled maintenance tick should never be the
  // reason the process can't exit cleanly (e.g. during tests or a
  // graceful shutdown that's just waiting on in-flight requests).
  breakInterval.unref();
  selfServiceBreakReminderInterval.unref();
  photoInterval.unref();
  nightShiftInterval.unref();
  adjustmentRetentionInterval.unref();
  perfSnapshotInterval.unref();
  perfRecomputeInterval.unref();
  perfSealInterval.unref();
}

export function stopMaintenanceScheduler() {
  clearInterval(breakInterval);
  clearInterval(selfServiceBreakReminderInterval);
  clearInterval(photoInterval);
  clearInterval(nightShiftInterval);
  clearInterval(adjustmentRetentionInterval);
  clearInterval(perfSnapshotInterval);
  clearInterval(perfRecomputeInterval);
  clearInterval(perfSealInterval);
  breakInterval = undefined;
  selfServiceBreakReminderInterval = undefined;
  photoInterval = undefined;
  nightShiftInterval = undefined;
  adjustmentRetentionInterval = undefined;
  perfSnapshotInterval = undefined;
  perfRecomputeInterval = undefined;
  perfSealInterval = undefined;
}
