// workReviewsController.js — HTTP shape only; all of the real work lives in
// workReviewService (Performance Engine §D/§E).
//
// This is the generic review endpoint that covers all five reviewable
// models, including the two (ItemReport, PriceReport) that never had a
// review flow of their own. The three pre-existing per-model endpoints
// still work and now delegate to the same service, so there is exactly one
// write path regardless of which URL a client uses.

import { recordReview, listPendingQueue } from "../services/workReviewService.js";
import { WORK_TARGET_TYPES } from "../services/reviewTargets.js";

// POST /api/work-reviews — staff only. Body is validated by
// recordWorkReviewSchema (.strict()), so a client cannot smuggle in a
// point value; qualityPoints/qualityMax are derived server-side.
export async function createWorkReview(req, res, next) {
  try {
    const { targetType, targetId, outcome, severity, reason } = req.body;
    const { row, review } = await recordReview({
      user: req.user,
      targetType,
      targetId,
      outcome,
      severity: severity ?? null,
      reason: reason ?? null,
    });

    // The review is echoed back through the staff-facing shape — this
    // endpoint is staff-gated, so severity/points are legitimate here. The
    // employee-facing projection lives in Phase 4's performanceView.
    res.status(201).json({
      work: row,
      review: {
        id: review.id,
        targetType: review.targetType,
        targetId: review.targetId,
        outcome: review.outcome,
        severity: review.severity,
        reason: review.reason,
        qualityPoints: review.qualityPoints,
        qualityMax: review.qualityMax,
        workCategory: review.workCategory,
        workDate: review.workDate,
        reviewedAt: review.reviewedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/work-reviews/queue?marketId=&types=&take= — staff only.
// "Everything awaiting my review", merged across all five models.
export async function getReviewQueue(req, res, next) {
  try {
    const marketId = req.query.marketId ?? req.user.marketId;
    if (!marketId) return res.status(400).json({ error: "marketId is required" });

    const requested = req.query.types
      ? req.query.types.split(",").map((t) => t.trim()).filter(Boolean)
      : null;
    const unknown = requested?.filter((t) => !WORK_TARGET_TYPES.includes(t)) ?? [];
    if (unknown.length) {
      return res.status(400).json({ error: `Unknown work type(s): ${unknown.join(", ")}` });
    }

    const queue = await listPendingQueue({
      user: req.user,
      marketId,
      types: requested,
      take: req.query.take ?? 50,
    });
    res.json(queue);
  } catch (err) {
    next(err);
  }
}
