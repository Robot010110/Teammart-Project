// performanceView.js — the ONE place a performance record is turned into
// an API response.
//
// Performance Engine §I. This file exists to enforce a single rule:
//
//   An employee must never see the supervisor's internal correction
//   scoring — not the severity level, and not the point value.
//
// The rule is enforced HERE, at the API boundary, rather than in React,
// because hiding a field in a component leaves it sitting in the JSON for
// anyone who opens DevTools. Nothing in the performance paths may ever do
// `res.json(row)` on a raw Prisma result; everything goes through these
// two functions.
//
// ---------------------------------------------------------------------
// A known, accepted limit, recorded here so nobody later mistakes it for
// an oversight:
//
// The three correction levels map 1:1 onto three point values. An employee
// is entitled to see their own category score (the whole system is
// required to be explainable), and a category score is derived from those
// points. So for an employee whose period contains a SINGLE reviewed item,
// the displayed Quality score is in principle invertible back to the
// fraction that produced it.
//
// What is actually defensible, and what this file therefore does:
//   * never state the severity in words,
//   * never expose the per-item point value or the raw point totals,
//   * never expose the pre-curve score or the profile internals that
//     would turn an inference into a certainty.
// Fully closing the inference would mean not showing employees their own
// score at all, which contradicts the explainability requirement. The
// product decision (see the plan's §I) is that the severity LABEL stays
// management-only.
// ---------------------------------------------------------------------

// Fields that must never reach an employee-facing response, in any shape.
// Used by the tests as the authoritative list, so adding a new internal
// field without considering visibility fails loudly rather than silently
// leaking.
export const MANAGEMENT_ONLY_FIELDS = [
  "severity",
  "qualityPoints",
  "qualityMax",
  "earnedQualityPoints",
  "possibleQualityPoints",
  "rawScore",
  "baseScore",
  "profileKey",
  "profileVersion",
];

function isStaff(viewer) {
  return viewer?.kind === "staff";
}

// The employee-safe view of one scored category: what it was worth, what
// they got, and the plain-language counts behind it — never the internal
// point arithmetic.
function publicCategory(category) {
  if (!category) return null;
  const detail = category.detail ?? {};
  const safeDetail = {};

  // Whitelist, never a blocklist: a new detail field added to the engine
  // later is hidden by default rather than exposed by accident.
  const EMPLOYEE_SAFE_DETAIL = [
    "reviewedItems", "approved", "corrected", "rejected",
    "assigned", "excused", "eligibleAssigned", "completed", "completionRate",
    "timelinessApplies", "completedWithDueDate", "completedOnTime", "onTimeRate",
    "workingDays", "absentDays", "incompleteDays", "lateDays", "earlyLeaveDays",
    "presence", "punctuality", "hoursApplies", "workedHours", "requiredHours", "hoursFulfilment",
    // An employee is entitled to see the penalties counting against them —
    // they are the subject of the discipline, and a deduction they cannot
    // see is a deduction they cannot dispute.
    "punishmentHours", "penaltyEventCount", "integrityEvents",
    "penaltyDeduction", "repeatSurcharge", "integrityDeduction", "totalDeduction",
    "consistencyIndex", "consistencyPoints", "correctionCapped",
    "improvementApplies", "improvementPoints", "delta", "sustainedExcellence",
    "currentApprovalStreak", "bestApprovalStreak",
    "currentRejectionStreak", "worstRejectionStreak",
    "reason",
  ];
  for (const key of EMPLOYEE_SAFE_DETAIL) {
    if (detail[key] !== undefined) safeDetail[key] = detail[key];
  }

  return {
    points: category.points,
    max: category.max,
    applicable: category.applicable,
    detail: safeDetail,
  };
}

function publicCategories(categories, viewer) {
  if (!categories) return null;
  const out = {};
  for (const [key, value] of Object.entries(categories)) {
    out[key] = isStaff(viewer) ? value : publicCategory(value);
  }
  return out;
}

/**
 * Serialize a snapshot (or a live provisional period) for one viewer.
 *
 * Staff get the full record including raw/base scores and the frozen
 * inputs. Employees get their score, their category breakdown, and nothing
 * that would let them reconstruct the supervisor's internal scoring.
 */
export function publicSnapshot(snapshot, { viewer }) {
  if (!snapshot) return null;

  const base = {
    periodType: snapshot.periodType,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    // A live period carries provisional:true; a stored snapshot does not.
    provisional: snapshot.provisional ?? false,
    status: snapshot.status ?? snapshot.metrics?.status ?? (snapshot.score == null ? "NO_DATA" : "SCORED"),
    score: snapshot.score,
    scores: {
      quality: snapshot.qualityScore ?? snapshot.categories?.quality?.points ?? null,
      completion: snapshot.completionScore ?? snapshot.categories?.completion?.points ?? null,
      attendance: snapshot.attendanceScore ?? snapshot.categories?.attendance?.points ?? null,
      reliability: snapshot.reliabilityScore ?? snapshot.categories?.reliability?.points ?? null,
      consistency: snapshot.consistencyScore ?? snapshot.categories?.consistency?.points ?? null,
    },
    applicableMax: snapshot.applicableMax,
    // Employees are told when a historical figure is only partial, so a
    // low-confidence number is never presented as comparable.
    inputsComplete: snapshot.inputsComplete ?? true,
  };

  const categories = publicCategories(snapshot.categories ?? snapshot.metrics?.categories, viewer);
  if (categories) base.categories = categories;

  if (!isStaff(viewer)) return base;

  // Management view — the pre-curve score, the profile that produced it,
  // and the frozen facts, all of which are needed to explain or dispute a
  // score and none of which an employee may see.
  return {
    ...base,
    id: snapshot.id,
    employeeId: snapshot.employeeId,
    marketId: snapshot.marketId,
    rawScore: snapshot.rawScore,
    baseScore: snapshot.baseScore,
    profileKey: snapshot.profileKey,
    profileVersion: snapshot.profileVersion,
    computedAt: snapshot.computedAt,
    staleAt: snapshot.staleAt,
    sealedAt: snapshot.sealedAt,
    inputs: snapshot.inputs,
    metrics: snapshot.metrics,
  };
}

/**
 * Serialize one WorkReview for one viewer.
 *
 * The employee sees WHAT was decided and WHY in the supervisor's own
 * words. They do not see how severely it was graded internally.
 */
export function publicWorkReview(review, { viewer }) {
  if (!review) return null;

  const base = {
    id: review.id,
    targetType: review.targetType,
    targetId: review.targetId,
    outcome: review.outcome,
    reason: review.reason,
    workCategory: review.workCategory,
    workDate: review.workDate,
    reviewedAt: review.reviewedAt,
    reviewerName: review.reviewedBy?.name ?? null,
  };

  if (!isStaff(viewer)) return base;

  return {
    ...base,
    severity: review.severity,
    qualityPoints: review.qualityPoints,
    qualityMax: review.qualityMax,
    profileKey: review.profileKey,
    profileVersion: review.profileVersion,
    reviewedById: review.reviewedById,
    source: review.source,
    employeeId: review.employeeId,
    marketId: review.marketId,
  };
}

/**
 * The employee-facing streak summary. Streaks are deliberately visible to
 * the employee — they are motivational and contain no internal scoring
 * (severity never affects streak structure, which is precisely what makes
 * them safe to show).
 */
export function publicStreak(streak) {
  if (!streak) return null;
  return {
    currentApprovalStreak: streak.currentApprovalStreak,
    bestApprovalStreak: streak.bestApprovalStreak,
    currentRejectionStreak: streak.currentRejectionStreak,
    worstRejectionStreak: streak.worstRejectionStreak,
    lastReviewAt: streak.lastReviewAt ?? null,
  };
}

/**
 * The aggregate (6-month / 1-year) figure. rawScore is management-only for
 * the same reason it is on a snapshot.
 */
export function publicAggregate(aggregate, { viewer }) {
  if (!aggregate) return null;
  const base = {
    months: aggregate.months,
    covered: aggregate.covered,
    coverage: aggregate.coverage,
    status: aggregate.status,
    score: aggregate.score,
    inputsComplete: aggregate.inputsComplete ?? true,
  };
  return isStaff(viewer) ? { ...base, rawScore: aggregate.rawScore } : base;
}
