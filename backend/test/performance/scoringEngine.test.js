// scoringEngine.test.js — Performance Engine Phase 2.
//
// Pure unit tests: no server, no database, no fixtures. The engine takes
// facts in and returns a score, so every rule in the spec can be asserted
// directly on the arithmetic rather than inferred from an API response.
//
// These tests are the specification. If a formula changes, one of these
// must change with it, deliberately.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scorePeriod, scoreQuality, scoreCompletion, scoreAttendance,
  scoreReliability, scoreConsistency, computeStreaks, applyCurve,
} from "../../src/services/performance/scoringEngine.js";
import { DEFAULT_PROFILE as P } from "../../src/services/performance/scoringProfile.js";

// --- fixture helpers ---------------------------------------------------

// A reviewed item worth 8 quality points — the spec's canonical example.
const approved = (max = 8) => ({ outcome: "APPROVED", severity: null, qualityPoints: max, qualityMax: max });
const corrected = (severity, points, max = 8) => ({ outcome: "APPROVED_WITH_CORRECTION", severity, qualityPoints: points, qualityMax: max });
const rejected = (severity, points, max = 8) => ({ outcome: "REJECTED", severity, qualityPoints: points, qualityMax: max });

// Turns "AAARR" into a review sequence: A=approved, C=corrected, R=rejected.
function seq(pattern) {
  return [...pattern].map((ch) => {
    if (ch === "A") return approved();
    if (ch === "C") return corrected("MINOR", 6);
    return rejected("MODERATE", 0.4);
  });
}

// A flawless period: 5 approved items (clears the volume gate), every
// assignment completed on time, spotless attendance, no penalties, and a
// prior period at the sustained-excellence level.
function perfectFacts() {
  return {
    reviews: [approved(), approved(), approved(), approved(), approved()],
    completion: { assigned: 5, cancelled: 0, assignedOnNonWorkingDays: 0, completed: 5, completedWithDueDate: 5, completedOnTime: 5 },
    attendance: { workingDays: 6, absentDays: 0, incompleteDays: 0, lateDays: 0, earlyLeaveDays: 0, workedHours: 48, requiredHours: 48 },
    reliability: { punishmentHours: 0, penaltyEventCount: 0 },
    prior: { baseScore: 100 },
  };
}

// ======================================================================
// QUALITY /30
// ======================================================================

test("QUALITY: all approved scores the full 30/30", () => {
  const q = scoreQuality({ reviews: [approved(), approved()] }, P);
  assert.equal(q.applicable, true);
  assert.equal(q.points, 30);
  assert.equal(q.max, 30);
});

test("QUALITY: the 6/4/2-of-8 correction ladder is exactly as specified", () => {
  // Spec §3: "If an activity is worth 8 quality points: Minor → 6/8,
  // Moderate → 4/8, Major → 2/8."
  const ladder = [["MINOR", 6], ["MODERATE", 4], ["MAJOR", 2]];
  for (const [severity, points] of ladder) {
    const q = scoreQuality({ reviews: [corrected(severity, points)] }, P);
    assert.equal(q.points, 30 * (points / 8), `${severity} correction should score ${points}/8 of the category`);
  }
});

test("QUALITY: every rejection scores strictly below the WORST correction", () => {
  // Spec §3: "Do not make rejection equivalent to approval-with-correction."
  const worstCorrection = scoreQuality({ reviews: [corrected("MAJOR", 2)] }, P).points;
  const rejections = [["MINOR", 1.2], ["MODERATE", 0.4], ["MAJOR", 0]];
  for (const [severity, points] of rejections) {
    const q = scoreQuality({ reviews: [rejected(severity, points)] }, P);
    assert.ok(q.points < worstCorrection, `rejection/${severity} (${q.points}) must be below the worst correction (${worstCorrection})`);
  }
  // ...and an invalid/falsified submission earns nothing at all.
  assert.equal(scoreQuality({ reviews: [rejected("MAJOR", 0)] }, P).points, 0);
});

test("QUALITY: mixed weights are summed, not averaged as percentages", () => {
  // A weight-8 approval and a weight-4 rejection: 8 of 12 possible points.
  const q = scoreQuality({ reviews: [approved(8), rejected("MAJOR", 0, 4)] }, P);
  assert.equal(q.detail.earnedQualityPoints, 8);
  assert.equal(q.detail.possibleQualityPoints, 12);
  assert.equal(q.points, 20); // 30 × 8/12
});

test("QUALITY: no reviewed work makes the category non-applicable, not zero", () => {
  const q = scoreQuality({ reviews: [] }, P);
  assert.equal(q.applicable, false);
  assert.equal(q.max, 0, "a non-applicable category contributes no maximum");
});

// ======================================================================
// COMPLETION & PRODUCTIVITY /25
// ======================================================================

test("COMPLETION: cancelled and non-working-day assignments leave the denominator", () => {
  // Spec §5: an employee must never be punished for cancelled work or for
  // work assigned while they were legitimately off.
  const c = scoreCompletion({
    completion: { assigned: 10, cancelled: 3, assignedOnNonWorkingDays: 2, completed: 5, completedWithDueDate: 0, completedOnTime: 0 },
  }, P);
  assert.equal(c.detail.eligibleAssigned, 5, "10 assigned − 3 cancelled − 2 on days off");
  assert.equal(c.detail.completionRate, 1, "completing all 5 eligible is a perfect rate");
  assert.equal(c.points, 18);
});

test("COMPLETION: timeliness drops out entirely when nothing had a due date", () => {
  const noDueDates = scoreCompletion({
    completion: { assigned: 4, completed: 4, completedWithDueDate: 0, completedOnTime: 0 },
  }, P);
  assert.equal(noDueDates.detail.timelinessApplies, false);
  assert.equal(noDueDates.max, 18, "the 7 timeliness points leave the category max");
  assert.equal(noDueDates.points, 18, "and are neither awarded nor withheld");

  const withDueDates = scoreCompletion({
    completion: { assigned: 4, completed: 4, completedWithDueDate: 4, completedOnTime: 4 },
  }, P);
  assert.equal(withDueDates.max, 25);
  assert.equal(withDueDates.points, 25);
});

test("COMPLETION: half the eligible work done scores half the completion points", () => {
  const c = scoreCompletion({
    completion: { assigned: 4, completed: 2, completedWithDueDate: 2, completedOnTime: 1 },
  }, P);
  assert.equal(c.detail.completionRate, 0.5);
  assert.equal(c.points, 18 * 0.5 + 7 * 0.5);
});

test("COMPLETION: a period where every assignment was cancelled is non-applicable", () => {
  const c = scoreCompletion({ completion: { assigned: 3, cancelled: 3, completed: 0 } }, P);
  assert.equal(c.applicable, false, "nothing was genuinely expected, so there is nothing to score");
});

// ======================================================================
// ATTENDANCE & TIME /20
// ======================================================================

test("ATTENDANCE: a spotless period scores the full 20/20", () => {
  const a = scoreAttendance({
    attendance: { workingDays: 6, absentDays: 0, incompleteDays: 0, lateDays: 0, earlyLeaveDays: 0, workedHours: 48, requiredHours: 48 },
  }, P);
  assert.equal(a.points, 20);
});

test("ATTENDANCE: extra hours can NEVER push the category above its maximum", () => {
  // Spec §6: extra work hours must not manufacture performance.
  const doubleHours = scoreAttendance({
    attendance: { workingDays: 6, absentDays: 0, incompleteDays: 0, lateDays: 0, earlyLeaveDays: 0, workedHours: 96, requiredHours: 48 },
  }, P);
  assert.equal(doubleHours.points, 20, "working double the required hours earns exactly the same 20");
  assert.equal(doubleHours.detail.hoursFulfilment, 1, "fulfilment is capped at 1");
});

test("ATTENDANCE: absence, lateness, early leave and missing checkouts each cost", () => {
  const base = { workingDays: 10, absentDays: 0, incompleteDays: 0, lateDays: 0, earlyLeaveDays: 0, workedHours: 80, requiredHours: 80 };
  const perfect = scoreAttendance({ attendance: base }, P).points;

  const oneAbsent = scoreAttendance({ attendance: { ...base, absentDays: 1 } }, P);
  assert.equal(oneAbsent.detail.presence, 0.9);
  assert.ok(oneAbsent.points < perfect);

  // An incomplete day (checked in, never out) costs half a day of presence.
  const oneIncomplete = scoreAttendance({ attendance: { ...base, incompleteDays: 1 } }, P);
  assert.equal(oneIncomplete.detail.presence, 0.95);

  const oneLate = scoreAttendance({ attendance: { ...base, lateDays: 1 } }, P);
  assert.equal(oneLate.detail.punctuality, 0.9);

  // An early departure is half as costly as arriving late.
  const oneEarly = scoreAttendance({ attendance: { ...base, earlyLeaveDays: 1 } }, P);
  assert.equal(oneEarly.detail.punctuality, 0.95);
});

test("ATTENDANCE: a period of nothing but approved leave is non-applicable, never 0/20", () => {
  // An employee on approved leave for a whole week must not be scored as
  // though they were absent without leave.
  const a = scoreAttendance({ attendance: { workingDays: 0, absentDays: 0 } }, P);
  assert.equal(a.applicable, false);
  assert.equal(a.max, 0);
});

test("ATTENDANCE: punctuality is floored at 0, never negative", () => {
  const a = scoreAttendance({
    attendance: { workingDays: 2, lateDays: 5, earlyLeaveDays: 5, absentDays: 0, incompleteDays: 0, workedHours: 16, requiredHours: 16 },
  }, P);
  assert.equal(a.detail.punctuality, 0);
  assert.ok(a.points >= 0);
});

// ======================================================================
// RELIABILITY & DISCIPLINE /15
// ======================================================================

test("RELIABILITY: a clean record scores the full 15/15", () => {
  const r = scoreReliability({ reliability: { punishmentHours: 0, penaltyEventCount: 0 }, reviews: [] }, P);
  assert.equal(r.points, 15);
});

test("RELIABILITY: the 3-hour penalty costs exactly 4.5 points", () => {
  // Derived from the real stored quantity (1.5 × 3 hours), not an invented
  // severity band — spec §7's "3-hour penalty → meaningful deduction".
  const r = scoreReliability({ reliability: { punishmentHours: 3, penaltyEventCount: 1 }, reviews: [] }, P);
  assert.equal(r.detail.penaltyDeduction, 4.5);
  assert.equal(r.points, 10.5);
});

test("RELIABILITY: the documented penalty ladder holds exactly", () => {
  const ladder = [
    { hours: 0, events: 0, expected: 15, label: "no issue" },
    { hours: 1, events: 1, expected: 13.5, label: "minor penalty (1h)" },
    { hours: 2, events: 2, expected: 10.5, label: "two separate 1h penalties (3.0 + 1.5 repeat)" },
    { hours: 3, events: 1, expected: 10.5, label: "one 3-hour penalty" },
    { hours: 10, events: 1, expected: 0, label: "serious case, 10h cumulative" },
  ];
  for (const { hours, events, expected, label } of ladder) {
    const r = scoreReliability({ reliability: { punishmentHours: hours, penaltyEventCount: events }, reviews: [] }, P);
    assert.equal(r.points, expected, label);
  }
});

test("RELIABILITY: repeated violations cost more than one larger one of the same size", () => {
  const twoSeparate = scoreReliability({ reliability: { punishmentHours: 2, penaltyEventCount: 2 }, reviews: [] }, P).points;
  const oneCombined = scoreReliability({ reliability: { punishmentHours: 2, penaltyEventCount: 1 }, reviews: [] }, P).points;
  assert.ok(twoSeparate < oneCombined, "two 1h events must cost more than a single 2h event");
  assert.equal(oneCombined - twoSeparate, 1.5, "the difference is exactly one repeat surcharge");
});

test("RELIABILITY: a falsified submission is a discipline event, not just bad work", () => {
  // Spec §7: falsification / fake evidence / manipulation.
  const clean = scoreReliability({ reliability: {}, reviews: [rejected("MODERATE", 0.4)] }, P);
  assert.equal(clean.points, 15, "an ordinary rejection costs Quality, not Reliability");

  const falsified = scoreReliability({ reliability: {}, reviews: [rejected("MAJOR", 0)] }, P);
  assert.equal(falsified.detail.integrityEvents, 1);
  assert.equal(falsified.points, 13, "an invalid/falsified submission deducts 2.0");
});

test("RELIABILITY: is floored at 0 and NEVER negative", () => {
  // Spec §7: "Never allow Reliability to become negative."
  const r = scoreReliability({
    reliability: { punishmentHours: 100, penaltyEventCount: 20 },
    reviews: [rejected("MAJOR", 0), rejected("MAJOR", 0)],
  }, P);
  assert.equal(r.points, 0);
  assert.ok(r.points >= 0);
});

// ======================================================================
// STREAK MATHEMATICS (spec §8)
// ======================================================================

test("STREAKS: consecutive success beats the same split scattered", () => {
  // THE headline requirement. Both sequences are 3 approved / 2 rejected.
  const consecutive = scoreConsistency({ reviews: seq("AAARR") }, P, 90);
  const scattered = scoreConsistency({ reviews: seq("AARAR") }, P, 90);

  assert.equal(consecutive.detail.consistencyIndex, 0.28);
  assert.equal(scattered.detail.consistencyIndex, 0.16);
  assert.ok(
    consecutive.detail.consistencyPoints > scattered.detail.consistencyPoints,
    "✅✅✅❌❌ must be more consistent than ✅✅❌✅❌ despite an identical 3/2 split"
  );
});

test("STREAKS: consecutive rejection drags harder than isolated rejections", () => {
  const together = scoreConsistency({ reviews: seq("AAAARR") }, P, 90).detail;
  const apart = scoreConsistency({ reviews: seq("ARAARA") }, P, 90).detail;
  assert.ok(together.consistencyIndex > apart.consistencyIndex);
  // The drag term itself is larger when the rejections are adjacent.
  const dragTogether = scoreConsistency({ reviews: seq("RR") }, P, 90).detail;
  const dragApart = scoreConsistency({ reviews: seq("RAR") }, P, 90).detail;
  assert.ok(dragTogether.worstRejectionStreak > dragApart.worstRejectionStreak);
});

test("STREAKS: a flawless run scores 1.0 and an all-rejected run scores 0.0, never negative", () => {
  assert.equal(scoreConsistency({ reviews: seq("AAAAA") }, P, 90).detail.consistencyIndex, 1);
  assert.equal(scoreConsistency({ reviews: seq("RRRRR") }, P, 90).detail.consistencyIndex, 0);
});

test("STREAKS: a rejection resets the approval streak; an approval resets the rejection streak", () => {
  const afterRejection = computeStreaks(seq("AAAR"));
  assert.equal(afterRejection.currentApprovalStreak, 0, "a rejection breaks the approval streak");
  assert.equal(afterRejection.currentRejectionStreak, 1);
  assert.equal(afterRejection.bestApprovalStreak, 3, "but the best streak is remembered");

  const afterApproval = computeStreaks(seq("RRA"));
  assert.equal(afterApproval.currentRejectionStreak, 0, "an approval breaks the rejection streak");
  assert.equal(afterApproval.currentApprovalStreak, 1);
  assert.equal(afterApproval.worstRejectionStreak, 2);
});

test("STREAKS: a correction keeps the ACCEPTANCE streak but breaks the CLEAN streak", () => {
  // The spec asks this question directly: does Approve-with-Correction
  // break a perfect approval streak?
  const s = computeStreaks(seq("AACAA"));
  assert.equal(s.currentApprovalStreak, 2, "the clean streak restarts after the correction");
  assert.equal(s.bestApprovalStreak, 2);
  assert.equal(s.currentRejectionStreak, 0, "a correction is NOT a rejection");
  assert.deepEqual(s.acceptanceRuns, [5], "all five were accepted, so the acceptance run is unbroken");
});

test("STREAKS: corrections keep a high consistency index but cap the points below full", () => {
  const allCorrected = scoreConsistency({ reviews: seq("CCCCC") }, P, 90);
  assert.equal(allCorrected.detail.consistencyIndex, 1, "every item was accepted, so the run is unbroken");
  assert.equal(allCorrected.detail.correctionCapped, true);
  assert.equal(allCorrected.detail.consistencyPoints, 5, "but a corrected period cannot reach the full 6");
});

test("STREAKS: streaks cannot dominate — consistency is bounded by 6 of 100 points", () => {
  const best = scoreConsistency({ reviews: seq("AAAAAAAAAA") }, P, 90);
  assert.equal(best.detail.consistencyPoints, 6);
  assert.ok(P.consistency.consistencyMax <= 6);
});

// ======================================================================
// IMPROVEMENT (spec §9)
// ======================================================================

test("IMPROVEMENT: a steadily improving employee earns real credit; a declining one does not", () => {
  // Spec §9's own examples: 70 → 76 → 82 → 88 versus 92 → 85 → 77 → 70.
  const improving = scoreConsistency({ reviews: seq("AAAAA"), prior: { baseScore: 82 } }, P, 88);
  const declining = scoreConsistency({ reviews: seq("AAAAA"), prior: { baseScore: 77 } }, P, 70);

  assert.equal(improving.detail.delta, 6);
  assert.equal(improving.detail.improvementPoints, 3, "+6 lands in the +4..+8 band");
  assert.equal(declining.detail.delta, -7);
  assert.equal(declining.detail.improvementPoints, 0, "a 7-point decline earns nothing");
  assert.ok(improving.points > declining.points);
});

test("IMPROVEMENT: the bands are exactly as specified", () => {
  const bands = [
    [10, 4], [8, 4], [6, 3], [4, 3], [2, 2], [1, 2],
    [0, 1.5], [-0.5, 1.5], [-2, 1], [-4, 1], [-5, 0], [-20, 0],
  ];
  for (const [delta, expected] of bands) {
    const prior = 50;
    const c = scoreConsistency({ reviews: seq("AAAAA"), prior: { baseScore: prior } }, P, prior + delta);
    assert.equal(c.detail.improvementPoints, expected, `delta ${delta} should score ${expected}`);
  }
});

test("IMPROVEMENT: sustaining near-perfection earns full credit — otherwise 100 is unreachable", () => {
  // A perfect performer has no room to improve. Without this rule they are
  // permanently stuck in the "stable" band and can never score 100.
  const sustained = scoreConsistency({ reviews: seq("AAAAA"), prior: { baseScore: 100 } }, P, 100);
  assert.equal(sustained.detail.delta, 0);
  assert.equal(sustained.detail.sustainedExcellence, true);
  assert.equal(sustained.detail.improvementPoints, 4);

  // But slipping from excellence does NOT get the free pass.
  const slipped = scoreConsistency({ reviews: seq("AAAAA"), prior: { baseScore: 100 } }, P, 96);
  assert.equal(slipped.detail.sustainedExcellence, false);
  assert.ok(slipped.detail.improvementPoints < 4);
});

test("IMPROVEMENT: a first-ever period has no baseline, so improvement is not scored", () => {
  const first = scoreConsistency({ reviews: seq("AAAAA"), prior: null }, P, 90);
  assert.equal(first.detail.improvementApplies, false);
  assert.equal(first.max, P.consistency.consistencyMax, "only the consistency half counts toward the max");
});

// ======================================================================
// THE CURVE (spec §11)
// ======================================================================

test("CURVE: hits every stated target exactly", () => {
  const expected = [
    [0, 0], [50, 50], [70, 70], [80, 80],
    [85, 82.5], [90, 87.07], [95, 92.99], [99, 98.52], [100, 100],
  ];
  for (const [raw, final] of expected) {
    assert.equal(applyCurve(raw, P), final, `raw ${raw} should display ${final}`);
  }
});

test("CURVE: is continuous at the threshold and strictly increasing", () => {
  assert.equal(applyCurve(80, P), 80);
  assert.ok(Math.abs(applyCurve(80.001, P) - 80) < 0.01, "no jump at the boundary");
  let previous = -1;
  for (let raw = 0; raw <= 100; raw += 0.5) {
    const value = applyCurve(raw, P);
    assert.ok(value > previous, `curve must increase at raw ${raw}`);
    previous = value;
  }
});

test("CURVE: high displayed scores demand a materially higher raw score", () => {
  // Displaying 95 requires a raw ~96.5; displaying 100 requires exactly 100.
  assert.ok(applyCurve(96, P) < 95, "raw 96 is not yet a displayed 95");
  assert.ok(applyCurve(97, P) > 95);
  assert.ok(applyCurve(99.9, P) < 100, "anything short of a perfect raw cannot display 100");
  assert.equal(applyCurve(100, P), 100);
});

// ======================================================================
// RENORMALIZATION & THE VOLUME GATE
// ======================================================================

test("RENORMALIZE: a non-applicable category leaves both the numerator and the denominator", () => {
  // No assignments at all: Completion drops out and the remaining
  // categories are scored out of 75, not 100.
  const facts = perfectFacts();
  delete facts.completion;
  const result = scorePeriod(facts, P);

  assert.equal(result.categories.completion.applicable, false);
  assert.equal(result.applicableMax, 75, "30 + 20 + 15 + 10, with completion's 25 removed");
  assert.equal(result.rawScore, 100, "a perfect record is still perfect when measured on what applied");
});

test("RENORMALIZE: a period with no work and no attendance is NO_DATA, not a perfect score", () => {
  // Reliability alone starts at 15/15, so without this rule an employee who
  // did nothing at all would score a flawless 100.
  const result = scorePeriod({ reviews: [], reliability: { punishmentHours: 0 }, prior: null }, P);
  assert.equal(result.status, "NO_DATA");
  assert.equal(result.score, null);
  assert.equal(result.categories.reliability.applicable, false, "a clean slate must not manufacture a score");
});

test("VOLUME GATE: a flawless but tiny period is capped at 92", () => {
  const facts = perfectFacts();
  facts.reviews = [approved()]; // one perfect item
  facts.completion = { assigned: 1, completed: 1, completedWithDueDate: 1, completedOnTime: 1 };
  const result = scorePeriod(facts, P);

  assert.equal(result.rawScore, 100, "the work itself was perfect");
  assert.equal(result.metrics.volumeCapped, true);
  assert.equal(result.score, 92, "but one item cannot buy a top score");
});

test("VOLUME GATE: enough reviewed work removes the cap", () => {
  const result = scorePeriod(perfectFacts(), P);
  assert.equal(result.metrics.volumeCapped, false);
  assert.equal(result.score, 100);
});

// ======================================================================
// THE 100-POINT PROOF (spec §10)
// ======================================================================

test("100 PROOF: a genuinely perfect period scores exactly 100", () => {
  const result = scorePeriod(perfectFacts(), P);
  assert.equal(result.status, "SCORED");
  assert.equal(result.rawScore, 100);
  assert.equal(result.score, 100);

  // Every category at its maximum — this is what 100 costs.
  assert.equal(result.categories.quality.points, 30);
  assert.equal(result.categories.completion.points, 25);
  assert.equal(result.categories.attendance.points, 20);
  assert.equal(result.categories.reliability.points, 15);
  assert.equal(result.categories.consistency.points, 10);
});

test("100 PROOF: ANY single adverse event makes 100 impossible for that period", () => {
  // Spec §10: "A meaningful penalty, rejection, attendance violation, or
  // quality problem should make a perfect 100 impossible for that period."
  const mutations = {
    "one MINOR correction": (f) => { f.reviews[0] = corrected("MINOR", 6); },
    "one MODERATE correction": (f) => { f.reviews[0] = corrected("MODERATE", 4); },
    "one MAJOR correction": (f) => { f.reviews[0] = corrected("MAJOR", 2); },
    "one MINOR rejection": (f) => { f.reviews[0] = rejected("MINOR", 1.2); },
    "one MODERATE rejection": (f) => { f.reviews[0] = rejected("MODERATE", 0.4); },
    "one falsified submission": (f) => { f.reviews[0] = rejected("MAJOR", 0); },
    "one late arrival": (f) => { f.attendance.lateDays = 1; },
    "one absence": (f) => { f.attendance.absentDays = 1; },
    "one early departure": (f) => { f.attendance.earlyLeaveDays = 1; },
    "one missing checkout": (f) => { f.attendance.incompleteDays = 1; },
    "six minutes short of required hours": (f) => { f.attendance.workedHours = 47.9; },
    "the smallest possible penalty (0.1h)": (f) => { f.reliability = { punishmentHours: 0.1, penaltyEventCount: 1 }; },
    "one unfinished assignment": (f) => { f.completion.completed = 4; },
    "one assignment completed late": (f) => { f.completion.completedOnTime = 4; },
    "a decline from the previous period": (f) => { f.prior = { baseScore: 100 }; f.attendance.absentDays = 1; },
  };

  for (const [label, mutate] of Object.entries(mutations)) {
    const facts = perfectFacts();
    mutate(facts);
    const result = scorePeriod(facts, P);
    assert.ok(
      result.score < 100,
      `${label} must make 100 unreachable, but scored ${result.score}`
    );
  }
});

test("100 PROOF: 100 remains genuinely achievable, not merely theoretical", () => {
  // The proof above is only meaningful if a real, attainable record still
  // reaches 100 — a scale where 100 is impossible would pass it trivially.
  const bigPerfectPeriod = {
    reviews: Array.from({ length: 20 }, () => approved()),
    completion: { assigned: 20, cancelled: 2, assignedOnNonWorkingDays: 1, completed: 17, completedWithDueDate: 17, completedOnTime: 17 },
    attendance: { workingDays: 26, absentDays: 0, incompleteDays: 0, lateDays: 0, earlyLeaveDays: 0, workedHours: 210, requiredHours: 208 },
    reliability: { punishmentHours: 0, penaltyEventCount: 0 },
    prior: { baseScore: 97 },
  };
  const result = scorePeriod(bigPerfectPeriod, P);
  assert.equal(result.score, 100, "a full month of flawless work with legitimate cancellations still reaches 100");
});

// ======================================================================
// DETERMINISM & PURITY
// ======================================================================

test("ENGINE: is deterministic — identical facts always produce identical output", () => {
  const a = scorePeriod(perfectFacts(), P);
  const b = scorePeriod(perfectFacts(), P);
  assert.deepEqual(a, b);
});

test("ENGINE: does not mutate the facts it is given", () => {
  const facts = perfectFacts();
  const snapshot = JSON.parse(JSON.stringify(facts));
  scorePeriod(facts, P);
  assert.deepEqual(JSON.parse(JSON.stringify(facts)), snapshot);
});

test("ENGINE: a realistic mixed period lands in a believable range and explains itself", () => {
  const result = scorePeriod({
    reviews: [approved(), approved(), corrected("MINOR", 6), approved(), rejected("MODERATE", 0.4), approved()],
    completion: { assigned: 8, cancelled: 1, assignedOnNonWorkingDays: 0, completed: 6, completedWithDueDate: 6, completedOnTime: 5 },
    attendance: { workingDays: 6, absentDays: 0, incompleteDays: 0, lateDays: 1, earlyLeaveDays: 0, workedHours: 47, requiredHours: 48 },
    reliability: { punishmentHours: 1, penaltyEventCount: 1 },
    prior: { baseScore: 80 },
  }, P);

  assert.equal(result.status, "SCORED");
  assert.ok(result.score > 60 && result.score < 95, `expected a believable mid-range score, got ${result.score}`);
  // Every category must be explainable — this is what the drill-down renders.
  for (const key of ["quality", "completion", "attendance", "reliability", "consistency"]) {
    assert.ok(result.categories[key].applicable, `${key} should apply in a normal period`);
    assert.ok(result.categories[key].points <= result.categories[key].max);
  }
  assert.equal(result.categories.reliability.points, 13.5, "a 1-hour penalty costs 1.5");
});
