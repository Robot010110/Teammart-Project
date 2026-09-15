// workReviewService.js — the ONE place a supervisor's judgement of employee
// work is recorded, for all five reviewable models.
//
// Performance Engine §E. Before this existed, three controllers each did
// their own `prisma.<model>.update({ status, reviewedById, ... })` with no
// transaction, no audit row, and no shared notion of what a review was
// worth. Those endpoints still exist and behave identically from the
// outside — they now delegate here, so there is exactly one write path and
// the workflow status can never disagree with the scoring record.
//
// What a review writes, atomically:
//   1. the model's own status (+ reviewer columns, where the model has them)
//   2. the WorkReview row — the authoritative scoring record
//   3. an AuditLog row (WORK_REVIEW_RECORDED)
// and then, only after that commits, a notification to the employee.

import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, HttpError } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";
import { createNotification } from "../utils/notifications.js";
import { getReviewTarget, pendingWhereFor, WORK_TARGET_TYPES } from "./reviewTargets.js";
import { resolveProfile, scoreReview } from "./performance/scoringProfile.js";
import { advanceStreak } from "./performance/performanceRollupService.js";
import { markPeriodsStale } from "./performance/performanceService.js";

// An accepted outcome leaves the work in the APPROVED workflow state even
// when it needed correction — see WorkReview's schema comment for why the
// correction is recorded as a JUDGEMENT rather than as a new status value.
const STATUS_FOR_OUTCOME = {
  APPROVED: "APPROVED",
  APPROVED_WITH_CORRECTION: "APPROVED",
  REJECTED: "REJECTED",
};

// Severity is REQUIRED for the two outcomes whose scoring depends on it and
// must be ABSENT for a plain approval — accepting a stray severity on an
// APPROVED would silently store a point value the profile never intended.
// `allowUnspecifiedSeverity` exists for the three pre-existing endpoints
// (activity review, task approve/reject, wasted-overall review) whose
// request bodies have no severity field and whose callers — the live
// supervisor UI among them — cannot supply one. Those reviews honestly
// record severity: null rather than inventing a level the supervisor never
// chose; scoringProfile's LEGACY_DEFAULT is what scores them. A correction
// still always requires a level, because there is no endpoint that can
// produce a correction without one.
function validateOutcomeShape(outcome, severity, reason, { allowUnspecifiedSeverity }) {
  if (!STATUS_FOR_OUTCOME[outcome]) {
    throw new HttpError(400, `Unknown review outcome: ${outcome}`);
  }
  if (outcome === "APPROVED" && severity != null) {
    throw new HttpError(400, "A plain approval cannot carry a correction level");
  }
  if (outcome === "APPROVED_WITH_CORRECTION" && severity == null) {
    throw new HttpError(400, "A correction must specify a level");
  }
  if (outcome === "REJECTED" && severity == null && !allowUnspecifiedSeverity) {
    throw new HttpError(400, "A rejection must specify a level");
  }
  if (outcome === "REJECTED" && !reason?.trim()) {
    // Matches the existing behaviour the supervisor UI already enforces:
    // rejecting always required a typed reason.
    throw new HttpError(400, "A rejection must include a reason");
  }
}

// Notification text comes from the registry, per model, so each endpoint's
// existing wording is preserved exactly (see reviewTargets' own comments).
//
// This is a §I leak surface: whatever the registry produces carries the
// OUTCOME and the supervisor's free-text reason only. The severity word and
// the point value are never passed to it, so they cannot appear in a
// notification even by accident.
async function notifyReviewed(target, { employeeId, targetId, outcome, reason, row }) {
  if (!target.notification) return;
  if (target.notifyOnlyOnRejection && outcome !== "REJECTED") return;

  await createNotification({
    employeeId,
    type: "SUBMISSION_REVIEWED",
    title: target.notification.titleFor(outcome, row),
    body: target.notification.bodyFor(outcome, reason, row),
    linkType: target.notification.linkType,
    linkId: targetId,
  });
}

/**
 * Record a review decision against one piece of work.
 *
 * @param {object} args
 * @param {object} args.user       req.user — must be staff; market access is asserted here.
 * @param {string} args.targetType one of WORK_TARGET_TYPES
 * @param {string} args.targetId   the work row's id
 * @param {"APPROVED"|"APPROVED_WITH_CORRECTION"|"REJECTED"} args.outcome
 * @param {"MINOR"|"MODERATE"|"MAJOR"|null} [args.severity]
 * @param {string} [args.reason]
 * @returns {Promise<{ row: object, review: object }>} the updated work row and the review
 */
export async function recordReview({
  user,
  targetType,
  targetId,
  outcome,
  severity = null,
  reason = null,
  allowUnspecifiedSeverity = false,
}) {
  const target = getReviewTarget(targetType);
  validateOutcomeShape(outcome, severity, reason, { allowUnspecifiedSeverity });

  const row = await target.delegate(prisma).findUnique({
    where: { id: targetId },
    ...(target.include ? { include: target.include } : {}),
  });
  if (!row) throw new HttpError(404, `${target.label} not found`);

  if (target.softDeleteField && row[target.softDeleteField] != null) {
    throw new HttpError(404, `${target.label} not found`);
  }

  const employeeId = target.employeeIdOf(row);
  const marketId = target.marketIdOf(row);

  // An Activity with no employee (an unassigned-department Department
  // Closing, which belongs to the market directly) has nobody to score.
  // Refusing here is deliberate: writing a WorkReview without an employee
  // would put an unattributable row into the scoring index.
  if (!employeeId) {
    throw new HttpError(400, `This ${target.label.toLowerCase()} is not attributed to an employee and cannot be reviewed`);
  }
  if (!marketId) {
    throw new HttpError(400, `This ${target.label.toLowerCase()} has no market and cannot be reviewed`);
  }

  await assertMarketAccess(user, marketId);

  if (!target.reviewableStatuses.includes(row.status)) {
    // Primary idempotency gate — a second review attempt (double-click, or
    // two supervisors racing) lands here, not on the unique constraint.
    throw new HttpError(400, `This ${target.label.toLowerCase()} is ${String(row.status).toLowerCase()}, not pending review`);
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true },
  });
  if (!employee) throw new HttpError(400, "This work is not attributed to a known employee");

  const workCategory = target.categoryOf(row);
  const profile = resolveProfile(employee);
  const { qualityPoints, qualityMax } = scoreReview(profile, {
    targetType,
    workCategory,
    outcome,
    severity,
  });

  const now = new Date();
  const status = STATUS_FOR_OUTCOME[outcome];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const data = { status };
      if (target.writesReviewerColumns) {
        data.reviewedById = user.userId;
        data.reviewedAt = now;
        // Only a real rejection populates rejectionReason — a correction
        // note goes on the WorkReview instead, so existing screens that
        // render rejectionReason don't start showing approvals as
        // rejections.
        data.rejectionReason = outcome === "REJECTED" ? reason : null;
      }

      const updated = await target.delegate(tx).update({
        where: { id: targetId },
        data,
        // Preserves each endpoint's existing response shape — Activity has
        // always returned its images alongside the reviewed row.
        ...(target.updateInclude ? { include: target.updateInclude } : {}),
      });

      const review = await tx.workReview.create({
        data: {
          targetType,
          targetId,
          outcome,
          severity,
          reason: reason?.trim() || null,
          qualityPoints,
          qualityMax,
          profileKey: profile.key,
          profileVersion: profile.version,
          employeeId,
          marketId,
          workCategory: String(workCategory),
          workDate: target.workDateOf(row) ?? now,
          reviewedById: user.userId,
          reviewedAt: now,
          source: "SUPERVISOR",
        },
      });

      await recordAudit({
        tx,
        actorUserId: user.userId,
        action: "WORK_REVIEW_RECORDED",
        targetType,
        targetId,
        marketId,
        reason: reason?.trim() || null,
        // severity/points live here on purpose: AuditLog is ADMIN-gated, and
        // an audit trail that omits WHAT was decided would be useless.
        newValue: { outcome, severity, qualityPoints, qualityMax, employeeId },
      });

      // Streaks are advanced in the SAME transaction as the review that
      // moves them — a review that committed while its streak update did
      // not would leave the two permanently out of step, and the streak is
      // maintained incrementally so there is nothing to recompute it from.
      await advanceStreak({ employeeId, outcome, reviewedAt: now, client: tx });

      return { row: updated, review };
    });

    // Outside the transaction: a notification failing must never roll back
    // a recorded review, and createNotification uses the global client
    // anyway (it reads the recipient's delivery preferences first).
    await notifyReviewed(target, { employeeId, targetId, outcome, reason, row });

    // If this work belongs to a period that has ALREADY been snapshotted
    // (a supervisor catching up on last week's queue), that snapshot is now
    // out of date. Marking it stale lets the recompute sweep fix it;
    // a sealed period is deliberately left alone. Outside the transaction
    // because a stale flag is a hint, not part of the review's integrity.
    await markPeriodsStale({ employeeId, date: target.workDateOf(row) ?? now });

    return result;
  } catch (err) {
    // Defensive only — the status check above is the real guard. This
    // catches the narrow race where two reviews pass that check
    // concurrently; the unique constraint lets exactly one win, and the
    // loser gets the same clean 400 rather than a raw 500.
    if (err?.code === "P2002") {
      throw new HttpError(400, `This ${target.label.toLowerCase()} has already been reviewed`);
    }
    throw err;
  }
}

/**
 * "Everything awaiting my review" across all five models.
 *
 * Deliberately a union of five indexed queries rather than a maintained
 * inbox table: an inbox would need a write in five submission controllers
 * and could go stale, whereas this cannot disagree with reality. Each model
 * already has an index on status/marketId.
 */
export async function listPendingQueue({ user, marketId, types, take = 50 }) {
  await assertMarketAccess(user, marketId);
  const wanted = types?.length ? types : WORK_TARGET_TYPES;

  const perType = await Promise.all(
    wanted.map(async (targetType) => {
      const target = getReviewTarget(targetType);
      const rows = await target.delegate(prisma).findMany({
        where: pendingWhereFor(targetType, marketId),
        ...(target.include ? { include: target.include } : {}),
        take,
        // Per-model, because three of the five have no createdAt column at
        // all — see submittedAtField's own comment in the registry.
        orderBy: { [target.submittedAtField]: "desc" },
      });
      return rows.map((row) => ({
        targetType,
        targetId: row.id,
        label: target.label,
        employeeId: target.employeeIdOf(row),
        workCategory: String(target.categoryOf(row)),
        workDate: target.workDateOf(row),
        submittedAt: row[target.submittedAtField],
      }));
    })
  );

  const items = perType.flat().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const countsByType = Object.fromEntries(wanted.map((t, i) => [t, perType[i].length]));
  const trimmed = items.slice(0, take);

  // Resolve employee names in ONE query rather than joining per model —
  // five different models reach their employee five different ways, and a
  // reviewer needs to see WHO did the work, not a cuid. Without this the
  // review modal showed a raw id, which is unusable for a supervisor
  // deciding whether the work is acceptable.
  const employeeIds = [...new Set(trimmed.map((i) => i.employeeId).filter(Boolean))];
  const employees = employeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, name: true, employeeCode: true },
      })
    : [];
  const byId = new Map(employees.map((e) => [e.id, e]));

  return {
    items: trimmed.map((item) => ({
      ...item,
      employeeName: byId.get(item.employeeId)?.name ?? null,
      employeeCode: byId.get(item.employeeId)?.employeeCode ?? null,
    })),
    countsByType,
  };
}

/**
 * One employee's review history, for the Quality drill-down.
 *
 * Returns raw rows — the CALLER must serialize them through
 * performanceView.publicWorkReview, which is what strips severity and the
 * point values for an employee viewing their own history.
 */
export async function listReviewsForEmployee({ employeeId, from = null, to = null, take = 100 }) {
  const where = { employeeId };
  if (from || to) {
    where.workDate = {};
    if (from) where.workDate.gte = from;
    if (to) where.workDate.lt = to;
  }
  return prisma.workReview.findMany({
    where,
    orderBy: [{ workDate: "desc" }, { reviewedAt: "desc" }],
    take,
    include: { reviewedBy: { select: { id: true, name: true } } },
  });
}
