// scoringEngine.js — the pure heart of the Performance system.
//
// HARD RULE: this module must never import prisma, or anything that does.
// It takes a plain `facts` object and a profile, and returns a score. That
// is what makes the whole scoring model unit-testable without a database,
// and what lets a stored snapshot's frozen `inputs` be replayed through a
// changed formula years later.
//
// Everything here is deterministic: same facts + same profile => same
// numbers, every time. No clock reads, no randomness, no I/O.
//
// ---------------------------------------------------------------------
// The shape of `facts` (all fields optional; absent means "no data", which
// is different from zero):
//
//   reviews: [{ outcome, severity, qualityPoints, qualityMax }]
//       Chronological, oldest first. qualityPoints/qualityMax are FROZEN
//       values copied off WorkReview rows — the engine never recomputes
//       them, so changing the profile cannot rewrite what past work scored.
//
//   completion: { assigned, cancelled, assignedOnNonWorkingDays,
//                 completed, completedWithDueDate, completedOnTime }
//
//   attendance: { workingDays, absentDays, incompleteDays, lateDays,
//                 earlyLeaveDays, workedHours, requiredHours }
//
//   reliability: { punishmentHours, penaltyEventCount }
//
//   prior: { baseScore } | null   — the previous period's baseScore.
// ---------------------------------------------------------------------

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// 2dp everywhere a number is stored or displayed. Floating-point sums like
// 0.1+0.2 must not surface as 0.30000000000000004 in a score breakdown the
// employee is expected to trust.
const round2 = (value) => Math.round(value * 100) / 100;

const ACCEPTING_OUTCOMES = new Set(["APPROVED", "APPROVED_WITH_CORRECTION"]);

function category(points, max, applicable, detail = {}) {
  return { points: applicable ? round2(points) : 0, max: applicable ? max : 0, applicable, detail };
}

// --- Quality /30 -------------------------------------------------------
// Purely the weighted review outcomes. Repeated-mistake behaviour lives in
// Reliability and is deliberately NOT also counted here — scoring one event
// in two categories would make the total unexplainable.
export function scoreQuality(facts, profile) {
  const reviews = facts.reviews ?? [];
  if (reviews.length === 0) {
    return category(0, profile.categoryMax.quality, false, { reviewedItems: 0 });
  }

  const earned = reviews.reduce((sum, r) => sum + r.qualityPoints, 0);
  const possible = reviews.reduce((sum, r) => sum + r.qualityMax, 0);
  // A period of items that were all somehow worth zero would divide by
  // zero; treat it as no measurable quality rather than 0/30.
  if (possible <= 0) {
    return category(0, profile.categoryMax.quality, false, { reviewedItems: reviews.length });
  }

  const ratio = earned / possible;
  return category(profile.categoryMax.quality * ratio, profile.categoryMax.quality, true, {
    reviewedItems: reviews.length,
    earnedQualityPoints: round2(earned),
    possibleQualityPoints: round2(possible),
    ratio: round2(ratio),
    approved: reviews.filter((r) => r.outcome === "APPROVED").length,
    corrected: reviews.filter((r) => r.outcome === "APPROVED_WITH_CORRECTION").length,
    rejected: reviews.filter((r) => r.outcome === "REJECTED").length,
  });
}

// --- Completion & Productivity /25 -------------------------------------
// Never a naive completed/assigned: cancelled work and work assigned on a
// day the employee was legitimately off are removed from the denominator
// first, so an employee is never punished for a management decision or for
// approved leave (spec §5).
export function scoreCompletion(facts, profile) {
  const c = facts.completion;
  const max = profile.categoryMax.completion;
  if (!c) return category(0, max, false, {});

  const assigned = c.assigned ?? 0;
  const excused = (c.cancelled ?? 0) + (c.assignedOnNonWorkingDays ?? 0);
  const eligibleAssigned = Math.max(0, assigned - excused);

  if (eligibleAssigned === 0) {
    return category(0, max, false, { assigned, excused, eligibleAssigned: 0 });
  }

  // Completion can exceed 1 only if the fact-gatherer double-counts; clamp
  // defensively so a bug upstream can never manufacture bonus points.
  const completionRate = clamp((c.completed ?? 0) / eligibleAssigned, 0, 1);
  const completionPoints = profile.completionSplit.completion * completionRate;

  // Timeliness only applies when something in the period actually had a
  // deadline. With no due dates there is nothing to be late for, so its
  // points leave the category max rather than being awarded or withheld.
  const withDueDate = c.completedWithDueDate ?? 0;
  const timelinessApplies = withDueDate > 0;
  const onTimeRate = timelinessApplies ? clamp((c.completedOnTime ?? 0) / withDueDate, 0, 1) : 0;
  const timelinessPoints = timelinessApplies ? profile.completionSplit.timeliness * onTimeRate : 0;

  const categoryMax = profile.completionSplit.completion + (timelinessApplies ? profile.completionSplit.timeliness : 0);

  return category(completionPoints + timelinessPoints, categoryMax, true, {
    assigned,
    excused,
    eligibleAssigned,
    completed: c.completed ?? 0,
    completionRate: round2(completionRate),
    timelinessApplies,
    completedWithDueDate: withDueDate,
    completedOnTime: c.completedOnTime ?? 0,
    onTimeRate: timelinessApplies ? round2(onTimeRate) : null,
  });
}

// --- Attendance & Time /20 ---------------------------------------------
export function scoreAttendance(facts, profile) {
  const a = facts.attendance;
  const max = profile.categoryMax.attendance;
  if (!a) return category(0, max, false, {});

  const workingDays = a.workingDays ?? 0;
  // A period that was entirely days off / approved leave has no attendance
  // to judge. Scoring it 0/20 would punish someone for approved leave.
  if (workingDays <= 0) {
    return category(0, max, false, { workingDays: 0 });
  }

  const absent = a.absentDays ?? 0;
  const incomplete = a.incompleteDays ?? 0;
  const late = a.lateDays ?? 0;
  const earlyLeave = a.earlyLeaveDays ?? 0;

  const presence = clamp(
    (workingDays - absent - profile.attendanceWeights.incompleteDay * incomplete) / workingDays,
    0,
    1
  );
  const punctuality = clamp(
    1 - (late + profile.attendanceWeights.earlyLeaveDay * earlyLeave) / workingDays,
    0,
    1
  );

  // The min(…, 1) here is the rule that stops extra hours manufacturing
  // performance (spec §6): working beyond the requirement can never push
  // this sub-score, or the category, above its maximum.
  const requiredHours = a.requiredHours ?? 0;
  const hoursApplies = requiredHours > 0;
  const hoursFulfilment = hoursApplies ? clamp((a.workedHours ?? 0) / requiredHours, 0, 1) : 0;

  const points =
    profile.attendanceSplit.presence * presence +
    profile.attendanceSplit.punctuality * punctuality +
    (hoursApplies ? profile.attendanceSplit.hours * hoursFulfilment : 0);

  const categoryMax =
    profile.attendanceSplit.presence +
    profile.attendanceSplit.punctuality +
    (hoursApplies ? profile.attendanceSplit.hours : 0);

  return category(points, categoryMax, true, {
    workingDays,
    absentDays: absent,
    incompleteDays: incomplete,
    lateDays: late,
    earlyLeaveDays: earlyLeave,
    presence: round2(presence),
    punctuality: round2(punctuality),
    hoursApplies,
    workedHours: round2(a.workedHours ?? 0),
    requiredHours: round2(requiredHours),
    hoursFulfilment: hoursApplies ? round2(hoursFulfilment) : null,
  });
}

// --- Reliability & Discipline /15 --------------------------------------
// Starts at full marks and only ever deducts. Floored at 0 — never negative.
//
// `applicable` is decided by the caller (scorePeriod), not here: a clean
// record must not be able to manufacture a perfect score out of a period
// where the employee did nothing at all.
export function scoreReliability(facts, profile) {
  const r = facts.reliability ?? {};
  const max = profile.categoryMax.reliability;
  const cfg = profile.reliability;

  const punishmentHours = r.punishmentHours ?? 0;
  const eventCount = r.penaltyEventCount ?? 0;
  const integrityEvents = (facts.reviews ?? []).filter(
    (x) => x.outcome === "REJECTED" && x.severity === cfg.integritySeverity
  ).length;

  const penaltyDeduction = cfg.perPunishmentHour * punishmentHours;
  const repeatSurcharge = cfg.repeatEventSurcharge * Math.max(0, eventCount - 1);
  const integrityDeduction = cfg.perIntegrityEvent * integrityEvents;
  const totalDeduction = penaltyDeduction + repeatSurcharge + integrityDeduction;

  return category(Math.max(0, max - totalDeduction), max, true, {
    punishmentHours: round2(punishmentHours),
    penaltyEventCount: eventCount,
    integrityEvents,
    penaltyDeduction: round2(penaltyDeduction),
    repeatSurcharge: round2(repeatSurcharge),
    integrityDeduction: round2(integrityDeduction),
    totalDeduction: round2(Math.min(totalDeduction, max)),
  });
}

// --- Streaks ------------------------------------------------------------
// Runs of consecutive outcomes. Three tracks, because they answer three
// different questions (spec §8):
//
//   acceptance — APPROVED or CORRECTION continue; REJECTED breaks.
//                Drives the consistency index.
//   clean      — only a plain APPROVED continues; a correction breaks it.
//                Drives the perfection gate and the displayed streak.
//   rejection  — REJECTED continues; anything else breaks.
//                Drives the negative drag.
function runLengths(reviews, belongsToRun) {
  const runs = [];
  let current = 0;
  for (const review of reviews) {
    if (belongsToRun(review)) {
      current += 1;
    } else if (current > 0) {
      runs.push(current);
      current = 0;
    }
  }
  if (current > 0) runs.push(current);
  return runs;
}

// The trailing run — "current streak" only counts if the sequence ENDS in it.
function trailingRun(reviews, belongsToRun) {
  let count = 0;
  for (let i = reviews.length - 1; i >= 0; i -= 1) {
    if (!belongsToRun(reviews[i])) break;
    count += 1;
  }
  return count;
}

export function computeStreaks(reviews = []) {
  const isAccepted = (r) => ACCEPTING_OUTCOMES.has(r.outcome);
  const isClean = (r) => r.outcome === "APPROVED";
  const isRejected = (r) => r.outcome === "REJECTED";

  const acceptanceRuns = runLengths(reviews, isAccepted);
  const cleanRuns = runLengths(reviews, isClean);
  const rejectionRuns = runLengths(reviews, isRejected);

  return {
    acceptanceRuns,
    cleanRuns,
    rejectionRuns,
    // "Approval streak" shown to users is the CLEAN track: an approval with
    // a correction is an acceptance, but it is not an unblemished approval.
    currentApprovalStreak: trailingRun(reviews, isClean),
    bestApprovalStreak: cleanRuns.length ? Math.max(...cleanRuns) : 0,
    currentRejectionStreak: trailingRun(reviews, isRejected),
    worstRejectionStreak: rejectionRuns.length ? Math.max(...rejectionRuns) : 0,
  };
}

// Sum of squared run lengths over n², so a long unbroken run is worth far
// more than the same number of successes scattered. This is the single
// formula that makes ✅✅✅❌❌ rank above ✅✅❌✅❌.
function runIndex(runs, n) {
  if (n <= 0) return 0;
  return runs.reduce((sum, len) => sum + len * len, 0) / (n * n);
}

// --- Consistency & Improvement /10 -------------------------------------
export function scoreConsistency(facts, profile, baseScore) {
  const reviews = facts.reviews ?? [];
  const cfg = profile.consistency;
  const max = profile.categoryMax.consistency;

  const hasReviews = reviews.length > 0;
  const prior = facts.prior;
  const hasPrior = prior != null && typeof prior.baseScore === "number";

  // Neither half measurable => the category drops out entirely rather than
  // scoring 0 (a brand-new employee has not been inconsistent).
  if (!hasReviews && !hasPrior) {
    return category(0, max, false, { reason: "no reviews and no prior period" });
  }

  const streaks = computeStreaks(reviews);
  const n = reviews.length;

  let consistencyPoints = 0;
  let consistencyIndex = null;
  let correctionCapped = false;
  if (hasReviews) {
    const acceptanceIndex = runIndex(streaks.acceptanceRuns, n);
    const rejectionDrag = runIndex(streaks.rejectionRuns, n);
    consistencyIndex = clamp(acceptanceIndex - cfg.rejectionDragWeight * rejectionDrag, 0, 1);
    consistencyPoints = cfg.consistencyMax * consistencyIndex;

    // A correction keeps the acceptance streak alive but costs the last
    // point of consistency — so a period containing any correction cannot
    // reach 10/10, and therefore cannot reach a raw 100.
    const hadCorrection = reviews.some((r) => r.outcome === "APPROVED_WITH_CORRECTION");
    if (hadCorrection && consistencyPoints > cfg.correctionCap) {
      consistencyPoints = cfg.correctionCap;
      correctionCapped = true;
    }
  }

  let improvementPoints = 0;
  let delta = null;
  let sustained = false;
  if (hasPrior) {
    delta = baseScore - prior.baseScore;
    if (prior.baseScore >= profile.sustainedExcellenceBase && baseScore >= prior.baseScore) {
      // Nothing left to improve on — sustaining near-perfection earns full
      // credit, without which 100 would be permanently unreachable.
      improvementPoints = cfg.improvementMax;
      sustained = true;
    } else {
      improvementPoints = profile.improvementBands.find((band) => delta >= band.minDelta).points;
    }
  }

  const categoryMax = (hasReviews ? cfg.consistencyMax : 0) + (hasPrior ? cfg.improvementMax : 0);

  return category(consistencyPoints + improvementPoints, categoryMax, true, {
    reviewedItems: n,
    consistencyIndex: consistencyIndex == null ? null : round2(consistencyIndex),
    consistencyPoints: round2(consistencyPoints),
    correctionCapped,
    improvementApplies: hasPrior,
    improvementPoints: round2(improvementPoints),
    delta: delta == null ? null : round2(delta),
    sustainedExcellence: sustained,
    ...streaks,
  });
}

// --- The curve (spec §11) ----------------------------------------------
// Below the threshold the score is untouched; above it, the same raw gain
// buys progressively less displayed score. Continuous at the threshold and
// exactly 100 at 100, so a perfect raw score still shows as a perfect 100.
export function applyCurve(raw, profile) {
  const { threshold, exponent } = profile.curve;
  if (raw <= threshold) return round2(raw);
  const span = 100 - threshold;
  return round2(threshold + span * Math.pow((raw - threshold) / span, exponent));
}

// Renormalize whichever categories actually applied. A category that did
// not apply contributes neither points nor maximum, so an employee is never
// scored against something that could not be measured for them.
function renormalize(categories) {
  const applicable = categories.filter((c) => c.applicable);
  const points = applicable.reduce((sum, c) => sum + c.points, 0);
  const max = applicable.reduce((sum, c) => sum + c.max, 0);
  return { points: round2(points), max: round2(max), score: max > 0 ? (points / max) * 100 : null };
}

/**
 * Score one period.
 *
 * @returns {{
 *   status: "SCORED"|"NO_DATA",
 *   score: number|null, rawScore: number|null, baseScore: number|null,
 *   applicableMax: number,
 *   categories: object, metrics: object
 * }}
 */
export function scorePeriod(facts, profile) {
  const quality = scoreQuality(facts, profile);
  const completion = scoreCompletion(facts, profile);
  const attendance = scoreAttendance(facts, profile);

  // Reliability starts at full marks and only deducts, so on its own it
  // would let a period in which the employee did nothing at all score a
  // perfect 100. It therefore only counts when there is something else to
  // measure — otherwise the period is genuinely NO_DATA.
  const hasSubstantiveData = quality.applicable || completion.applicable || attendance.applicable;
  const reliabilityRaw = scoreReliability(facts, profile);
  const reliability = hasSubstantiveData
    ? reliabilityRaw
    : category(0, profile.categoryMax.reliability, false, {
        ...reliabilityRaw.detail,
        reason: "no reviewed work or attendance in this period",
      });

  // baseScore = the four objective categories, renormalized to 100. This is
  // what improvement is measured against; using the full raw score would be
  // circular, since improvement is itself part of it.
  const base = renormalize([quality, completion, attendance, reliability]);

  const consistency = hasSubstantiveData
    ? scoreConsistency(facts, profile, base.score ?? 0)
    : category(0, profile.categoryMax.consistency, false, { reason: "no substantive data" });

  const categories = { quality, completion, attendance, reliability, consistency };
  const all = renormalize([quality, completion, attendance, reliability, consistency]);

  if (all.score == null) {
    return {
      status: "NO_DATA",
      score: null,
      rawScore: null,
      baseScore: null,
      applicableMax: 0,
      categories,
      metrics: { reviewedItems: (facts.reviews ?? []).length },
    };
  }

  const rawScore = round2(all.score);
  let finalScore = applyCurve(rawScore, profile);

  // Anti-gaming volume gate: too little reviewed work to justify a top
  // score, however flawless it was. Applied AFTER the curve so it is a hard
  // ceiling on what is displayed.
  const reviewedItems = (facts.reviews ?? []).length;
  const volumeCapped = reviewedItems < profile.volumeGate.minReviewedItems;
  if (volumeCapped) finalScore = Math.min(finalScore, profile.volumeGate.cappedFinal);

  return {
    status: "SCORED",
    score: round2(finalScore),
    rawScore,
    baseScore: base.score == null ? null : round2(base.score),
    applicableMax: all.max,
    categories,
    metrics: {
      reviewedItems,
      volumeCapped,
      earnedPoints: all.points,
      profileKey: profile.key,
      profileVersion: profile.version,
    },
  };
}
