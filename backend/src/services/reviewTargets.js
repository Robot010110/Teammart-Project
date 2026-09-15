// reviewTargets.js — the one description of "a thing a supervisor reviews",
// covering all five reviewable models.
//
// Performance Engine §A. Three separate consumers iterate this registry:
//   1. workReviewService.recordReview  — the single review write path
//   2. the cross-model pending queue   — "everything awaiting my review"
//   3. the historical backfill script  — legacy status -> WorkReview
//
// Adding a sixth reviewable model later is one entry here, not a change to
// three call sites. That is the entire reason this file exists.
//
// The five models genuinely differ in shape — different status enums,
// different date fields, different ways of reaching the owning market, and
// two of them (ItemReport/PriceReport) have no reviewer columns at all —
// so every one of those differences is expressed once, here, as data.

export const WORK_TARGET_TYPES = [
  "ACTIVITY",
  "TASK",
  "ITEM_REPORT",
  "PRICE_REPORT",
  "WASTED_OVERALL",
];

// Prisma's error for "row not found" vs. our own 404 shape is handled by the
// caller; these helpers only describe the model.
export const REVIEW_TARGETS = {
  ACTIVITY: {
    label: "Activity",
    // The Prisma delegate, taken off whichever client is passed in — so the
    // same entry works against `prisma` and against a `tx` inside a
    // transaction.
    delegate: (client) => client.activity,
    // Only these statuses may be reviewed. Everything else (already
    // reviewed, still a draft) is refused with a 400 by the service.
    reviewableStatuses: ["PENDING"],
    // Activity.employeeId is nullable — an unassigned-department Department
    // Closing has marketId set directly and no employee (see its own schema
    // comment). Such a row has no one to score, so it is not reviewable
    // through this path; the service rejects it explicitly rather than
    // writing a WorkReview with a null employeeId.
    include: { employee: { select: { id: true, marketId: true } } },
    employeeIdOf: (row) => row.employeeId,
    marketIdOf: (row) => row.marketId ?? row.employee?.marketId ?? null,
    // operationalDate wins for Night Shift rows, whose work legitimately
    // belongs to the previous calendar day (see nightShiftService's
    // operationalDateFor).
    workDateOf: (row) => row.operationalDate ?? row.date ?? row.createdAt,
    // The column to sort the pending queue by. Named per model because
    // three of the five have no createdAt at all (verified against the
    // schema) — sorting them by a field that doesn't exist throws.
    submittedAtField: "createdAt",
    categoryOf: (row) => row.category,
    // These three models carry reviewer columns that the rest of the app
    // already reads; they stay in sync with WorkReview via one transaction.
    writesReviewerColumns: true,
    // reviewActivity has always returned the activity WITH its images;
    // TodayActivityFeed renders them straight from that response, so the
    // shape has to survive the move behind workReviewService.
    updateInclude: { images: true },
    // Wording reproduced verbatim from the endpoint this replaced, so a
    // supervisor approving an activity produces the identical notification
    // it did before. The correction case is the only new sentence.
    notification: {
      linkType: "ACTIVITY",
      titleFor: (outcome) => (outcome === "REJECTED" ? "Activity Rejected" : "Activity Approved"),
      bodyFor: (outcome, reason, row) => {
        const label = String(row.category).toLowerCase().replace(/_/g, " ");
        return defaultBody(outcome, reason, `${label} activity`);
      },
    },
  },

  TASK: {
    label: "Task",
    delegate: (client) => client.task,
    reviewableStatuses: ["PENDING"],
    include: undefined,
    employeeIdOf: (row) => row.employeeId,
    marketIdOf: (row) => row.marketId,
    workDateOf: (row) => row.submittedAt ?? row.createdAt,
    submittedAtField: "submittedAt",
    categoryOf: (row) => row.type,
    writesReviewerColumns: true,
    // DELIBERATELY null: approveTask/rejectTask have never sent the employee
    // a notification, and Phase 1's contract is that these endpoints behave
    // exactly as they did. Starting to notify here would be a new,
    // unrequested behaviour change shipped under a refactor. Worth revisiting
    // as its own decision once the Task review UI exists.
    notification: null,
  },

  WASTED_OVERALL: {
    label: "Wasted Overall report",
    delegate: (client) => client.wastedOverallReport,
    reviewableStatuses: ["PENDING"],
    include: undefined,
    employeeIdOf: (row) => row.employeeId,
    marketIdOf: (row) => row.marketId,
    workDateOf: (row) => row.reportedAt,
    submittedAtField: "reportedAt",
    // This model has no per-row category — every row is the same kind of
    // work, so the target type IS the category.
    categoryOf: () => "WASTED_OVERALL",
    writesReviewerColumns: true,
    // Wording reproduced verbatim from reviewWastedOverallReport.
    notification: {
      linkType: "WASTED_OVERALL",
      titleFor: (outcome) => (outcome === "REJECTED" ? "Waste Report Rejected" : "Waste Report Approved"),
      bodyFor: (outcome, reason) => defaultBody(outcome, reason, "Wasted Overall report"),
    },
  },

  // ItemReport and PriceReport have NO reviewedById/reviewedAt/
  // rejectionReason columns — their `status` has sat at PENDING for the
  // life of the app because nothing ever wrote it. Rather than adding four
  // columns to each for data only the engine reads, the WorkReview row IS
  // their reviewer record; only `status` is written back, so the existing
  // PENDING-count UI finally means something.
  ITEM_REPORT: {
    label: "Expired/Wasted item report",
    delegate: (client) => client.itemReport,
    reviewableStatuses: ["PENDING"],
    include: undefined,
    employeeIdOf: (row) => row.employeeId,
    marketIdOf: (row) => row.marketId,
    workDateOf: (row) => row.reportedAt,
    submittedAtField: "reportedAt",
    categoryOf: () => "ITEM_REPORT",
    writesReviewerColumns: false,
    // Soft-deleted rows must never be reviewable or scorable — otherwise
    // deleting a report silently moves an employee's score.
    softDeleteField: "deletedAt",
    // These two models had no review flow at all, so there is no existing
    // behaviour to preserve — but an approval here is routine bookkeeping an
    // employee does not need pinged about, and five reviewable models all
    // notifying on every approval would multiply notification volume
    // several-fold. Only a rejection, which the employee must act on, is
    // worth a notification.
    notifyOnlyOnRejection: true,
    notification: {
      linkType: "ITEM_REPORT",
      titleFor: () => "Item Report Rejected",
      bodyFor: (outcome, reason) => defaultBody(outcome, reason, "item report"),
    },
  },

  PRICE_REPORT: {
    label: "Price report",
    delegate: (client) => client.priceReport,
    reviewableStatuses: ["PENDING"],
    include: undefined,
    employeeIdOf: (row) => row.employeeId,
    marketIdOf: (row) => row.marketId,
    workDateOf: (row) => row.reportedAt,
    submittedAtField: "reportedAt",
    categoryOf: () => "PRICE_REPORT",
    writesReviewerColumns: false,
    softDeleteField: "deletedAt",
    // Same reasoning as ITEM_REPORT above.
    notifyOnlyOnRejection: true,
    notification: {
      linkType: "PRICE_REPORT",
      titleFor: () => "Price Report Rejected",
      bodyFor: (outcome, reason) => defaultBody(outcome, reason, "price report"),
    },
  },
};

// Shared default wording, used by the models that had no notification text
// of their own to preserve.
function defaultBody(outcome, reason, noun) {
  const trimmed = reason?.trim();
  if (outcome === "REJECTED") {
    return trimmed ? `Your ${noun} was rejected: ${trimmed}` : `Your ${noun} was rejected.`;
  }
  if (outcome === "APPROVED_WITH_CORRECTION") {
    return trimmed
      ? `Your ${noun} was approved with a correction: ${trimmed}`
      : `Your ${noun} was approved with a correction.`;
  }
  return `Your ${noun} was approved.`;
}

export function getReviewTarget(targetType) {
  const target = REVIEW_TARGETS[targetType];
  if (!target) throw new Error(`Unknown work target type: ${targetType}`);
  return target;
}

// The `where` clause that finds rows still awaiting review for a model,
// scoped to one market. Kept here (rather than in the queue controller) so
// the "what counts as pending" rule lives with the rest of the model's
// description.
export function pendingWhereFor(targetType, marketId) {
  const target = getReviewTarget(targetType);
  const where = {
    status: { in: target.reviewableStatuses },
    ...(target.softDeleteField ? { [target.softDeleteField]: null } : {}),
  };

  // Activity reaches its market either directly or through its employee
  // (see marketIdOf) — the same OR idiom the activity list endpoints
  // already use for this model.
  if (targetType === "ACTIVITY") {
    where.OR = [{ marketId }, { employee: { marketId } }];
  } else {
    where.marketId = marketId;
  }
  return where;
}
