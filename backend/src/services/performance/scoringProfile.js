// scoringProfile.js — every tunable number the Performance engine uses,
// in ONE place, versioned.
//
// Two rules make this file load-bearing rather than a bag of constants:
//
//  1. Every WorkReview row stores the profileKey + profileVersion that
//     produced its qualityPoints, and stores the POINTS themselves. So
//     changing a weight here never silently rewrites what past work was
//     worth — old rows keep their frozen numbers, new rows use the new
//     ones, and the version on each row says which rules applied.
//     Bump PROFILE_VERSION whenever any number below changes.
//
//  2. resolveProfile() is keyed by the employee's role. Today every role
//     resolves to DEFAULT — role-specific scoring is explicitly NOT being
//     invented ahead of a real requirement (spec §15). This function is the
//     single extension point when it is.
//
// Phase 1 defines only what recording a review needs (weights + outcome
// scoring). The category maxima, attendance/reliability coefficients and
// the final curve arrive with the scoring engine in Phase 2.

export const PROFILE_VERSION = 1;

// How much a single reviewed item of each kind is worth, before the
// supervisor's judgement is applied. There is no weight/difficulty column
// anywhere in the database (checked — no work model has one), so this
// mapping is the only place difficulty is expressed.
//
// Weight 8 is the canonical case the spec's own example uses ("if an
// activity is worth 8 quality points, Approve = 8/8"), so the correction
// ladder below reproduces its 8 / 6 / 4 / 2 exactly.
const ACTIVITY_CATEGORY_WEIGHTS = {
  // Evidence-heavy, supervisor-visible work.
  NIGHT_SHIFT_TASK: 8,
  DEPARTMENT_CLOSING: 8,
};
const DEFAULT_ACTIVITY_WEIGHT = 6;

const TARGET_TYPE_WEIGHTS = {
  // Assigned work: someone explicitly asked for it, so failing it matters
  // more than failing something self-initiated.
  TASK: 8,
  WASTED_OVERALL: 5,
  ITEM_REPORT: 4,
  PRICE_REPORT: 4,
};

// Fraction of the item's weight awarded per outcome.
//
// The gap between the worst correction (0.25) and the best rejection (0.15)
// is deliberate and required: spec §3 says rejection must never be
// equivalent to approval-with-correction. A corrected item was still
// accepted work; a rejected one was not.
// A plain APPROVED never carries a severity, so it is a flat fraction
// rather than a severity table.
const APPROVED_FRACTION = 1.0;

const OUTCOME_FRACTIONS = {
  APPROVED_WITH_CORRECTION: {
    MINOR: 0.75,    // 6/8
    MODERATE: 0.5,  // 4/8
    MAJOR: 0.25,    // 2/8
  },
  REJECTED: {
    MINOR: 0.15,    // a small failure — redo expected
    MODERATE: 0.05, // a serious failure
    MAJOR: 0.0,     // unusable or falsified submission
  },
};

// Historical rows backfilled from a pre-existing APPROVED/REJECTED status
// have no severity, because the concept did not exist when they were
// judged. Rather than an inline `?? something` at the call site, the
// fallback is named and documented here: a legacy approval was a full
// approval; a legacy rejection is scored as the middle ("serious") band,
// since treating every old rejection as either trivial or falsified would
// both be inventions.
const LEGACY_DEFAULT = {
  APPROVED_WITH_CORRECTION: 0.5,
  REJECTED: 0.05,
};

// --- Phase 2: category structure -------------------------------------
//
// The five category maxima sum to exactly 100. Nothing in the engine
// assumes that (it always renormalizes by whichever categories applied),
// but a profile whose maxima don't sum to 100 would make a "raw score out
// of 100" a lie in the ordinary case, so it is asserted at load.
const CATEGORY_MAX = {
  quality: 30,
  completion: 25,
  attendance: 20,
  reliability: 15,
  consistency: 10,
};

// Completion & Productivity splits into completion rate and timeliness.
// Timeliness drops out (and its points with it) when nothing in the period
// had a due date — Task had no dueAt column at all until Phase 0, so this
// is the common case, not an edge case.
const COMPLETION_SPLIT = { completion: 18, timeliness: 7 };

// Attendance & Time. hoursFulfilment is CAPPED at 1 — that cap is the
// mechanism that stops extra hours manufacturing performance (spec §6).
const ATTENDANCE_SPLIT = { presence: 10, punctuality: 6, hours: 4 };
// An incomplete day (checked in, never checked out) costs half a day of
// presence; an early departure costs half a day of punctuality. Neither is
// as severe as a full absence, but neither is a clean day.
const ATTENDANCE_WEIGHTS = { incompleteDay: 0.5, earlyLeaveDay: 0.5 };

// Reliability & Discipline. Deductions from a full 15, floored at 0.
//
// Severity is derived from punishmentHours — a real stored quantity —
// rather than an invented band table, so the app's actual penalty model
// drives the score. A 3-hour penalty therefore costs 1.5 × 3 = 4.5 points
// without anything anywhere having to special-case "3 hours".
const RELIABILITY = {
  perPunishmentHour: 1.5,
  // Repeated violations hurt more than one larger one: two 1h penalties
  // cost 3.0 + 1.5 = 4.5, where a single 2h penalty costs 3.0.
  repeatEventSurcharge: 1.5,
  // A rejection severe enough to be "invalid/falsified" is a discipline
  // event, not just poor work — spec §7's falsification bullet.
  perIntegrityEvent: 2.0,
  integritySeverity: "MAJOR",
};

// Consistency & Improvement.
const CONSISTENCY = {
  consistencyMax: 6,
  improvementMax: 4,
  // Consecutive rejections drag harder than scattered ones; 0.5 keeps the
  // drag meaningful without letting it dominate the positive signal.
  rejectionDragWeight: 0.5,
  // A correction keeps the ACCEPTANCE streak alive but breaks the CLEAN
  // streak, so a period containing any correction cannot reach full
  // consistency. This is one of the mechanisms that makes 100 rare.
  correctionCap: 5,
};

// Improvement bands, evaluated top-down on
// delta = baseScore(this period) − baseScore(previous period).
//
// baseScore is the four OBJECTIVE categories (quality, completion,
// attendance, reliability) renormalized to 100 — deliberately NOT the full
// raw score, because improvement lives inside the consistency category and
// measuring it against a number that contains itself is circular. Signed
// off as a plan deviation before implementation.
const IMPROVEMENT_BANDS = [
  { minDelta: 8, points: 4 },
  { minDelta: 4, points: 3 },
  { minDelta: 1, points: 2 },
  { minDelta: -1, points: 1.5 }, // stable — not punished
  { minDelta: -4, points: 1 },
  { minDelta: -Infinity, points: 0 },
];
// An employee already at/above this baseScore has no room left to improve;
// sustaining it counts as full improvement credit. Without this rule a
// perfect performer is permanently capped at the "stable" band and 100
// becomes unreachable rather than merely rare.
const SUSTAINED_EXCELLENCE_BASE = 95;

// Anti-gaming: a single flawless item must not produce a perfect score.
// Below this many reviewed items the FINAL (post-curve) score is capped.
const VOLUME_GATE = { minReviewedItems: 5, cappedFinal: 92 };

// The nonlinear top-end transform (spec §11). Verified to hit the stated
// targets exactly: 80→80, 90→87.07, 95→92.99, 99→98.52, 100→100.
const CURVE = { threshold: 80, exponent: 1.5 };

export const DEFAULT_PROFILE = {
  key: "DEFAULT",
  version: PROFILE_VERSION,
  activityCategoryWeights: ACTIVITY_CATEGORY_WEIGHTS,
  defaultActivityWeight: DEFAULT_ACTIVITY_WEIGHT,
  targetTypeWeights: TARGET_TYPE_WEIGHTS,
  approvedFraction: APPROVED_FRACTION,
  outcomeFractions: OUTCOME_FRACTIONS,
  legacyDefault: LEGACY_DEFAULT,
  categoryMax: CATEGORY_MAX,
  completionSplit: COMPLETION_SPLIT,
  attendanceSplit: ATTENDANCE_SPLIT,
  attendanceWeights: ATTENDANCE_WEIGHTS,
  reliability: RELIABILITY,
  consistency: CONSISTENCY,
  improvementBands: IMPROVEMENT_BANDS,
  sustainedExcellenceBase: SUSTAINED_EXCELLENCE_BASE,
  volumeGate: VOLUME_GATE,
  curve: CURVE,
};

// Fail loudly at import time rather than silently producing scores out of
// a denominator nobody intended.
const CATEGORY_TOTAL = Object.values(CATEGORY_MAX).reduce((a, b) => a + b, 0);
if (CATEGORY_TOTAL !== 100) {
  throw new Error(`Scoring profile category maxima must sum to 100, got ${CATEGORY_TOTAL}`);
}
if (COMPLETION_SPLIT.completion + COMPLETION_SPLIT.timeliness !== CATEGORY_MAX.completion) {
  throw new Error("completionSplit must sum to the completion category max");
}
const ATTENDANCE_TOTAL = ATTENDANCE_SPLIT.presence + ATTENDANCE_SPLIT.punctuality + ATTENDANCE_SPLIT.hours;
if (ATTENDANCE_TOTAL !== CATEGORY_MAX.attendance) {
  throw new Error("attendanceSplit must sum to the attendance category max");
}
if (CONSISTENCY.consistencyMax + CONSISTENCY.improvementMax !== CATEGORY_MAX.consistency) {
  throw new Error("consistency split must sum to the consistency category max");
}

const PROFILES = { DEFAULT: DEFAULT_PROFILE };

// The per-role extension point. `employee` is passed whole (not just a
// role string) so a future profile can key off position/department/market
// without changing every call site.
export function resolveProfile(employee) {
  const key = PROFILES[employee?.role] ? employee.role : "DEFAULT";
  return PROFILES[key];
}

// What one reviewed item of this kind is worth. `workCategory` only
// matters for ACTIVITY, where the category genuinely varies the effort;
// every other target type has a single weight.
export function weightFor(profile, targetType, workCategory) {
  if (targetType === "ACTIVITY") {
    return profile.activityCategoryWeights[workCategory] ?? profile.defaultActivityWeight;
  }
  return profile.targetTypeWeights[targetType] ?? profile.defaultActivityWeight;
}

// The authoritative severity -> points mapping. This is the function the
// spec's "hidden supervisor scoring" rule exists to protect: its OUTPUT
// must never reach an employee-facing response.
//
// Returns { qualityPoints, qualityMax } — both frozen onto the WorkReview
// row at review time.
export function scoreReview(profile, { targetType, workCategory, outcome, severity }) {
  const qualityMax = weightFor(profile, targetType, workCategory);

  // Three cases, in order of specificity:
  //   1. APPROVED — never has a severity, always full credit.
  //   2. A severity was given — the normal path, use the severity table.
  //   3. No severity on a correction/rejection — only possible for a
  //      BACKFILL row synthesized from a legacy status, so use the named
  //      legacy fallback rather than guessing.
  let fraction;
  if (outcome === "APPROVED") {
    fraction = profile.approvedFraction;
  } else if (severity != null) {
    fraction = profile.outcomeFractions[outcome]?.[severity];
  } else {
    fraction = profile.legacyDefault[outcome];
  }

  if (fraction == null) {
    // An outcome/severity combination the profile has no entry for is a
    // programming error, not a runtime condition to paper over — scoring it
    // as 0 would silently punish an employee for our bug.
    throw new Error(`No scoring fraction for outcome=${outcome} severity=${severity}`);
  }

  // Rounded to 2dp so a float like 0.15 * 7 never stores 1.0499999999999998
  // and make a stored score look arbitrary in the drill-down.
  return { qualityPoints: Math.round(qualityMax * fraction * 100) / 100, qualityMax };
}
