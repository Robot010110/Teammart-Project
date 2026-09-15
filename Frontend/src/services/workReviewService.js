import { apiRequest } from "./apiClient";

// workReviewService.js — the Supervisor's review actions.
//
// The request body carries a DECISION (outcome + how severe + why), never
// a score. The point value each decision is worth is derived server-side
// from the scoring profile; the API rejects any attempt to send one, so
// there is deliberately no way to express a score from this file.

// Everything in this market still waiting to be judged, merged across all
// five reviewable work types.
export function getReviewQueue({ marketId, types, take } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (types?.length) params.set("types", types.join(","));
  if (take) params.set("take", take);
  const qs = params.toString();
  return apiRequest(`/work-reviews/queue${qs ? `?${qs}` : ""}`);
}

/**
 * Record a review decision.
 *
 * @param {object} decision
 * @param {"ACTIVITY"|"TASK"|"ITEM_REPORT"|"PRICE_REPORT"|"WASTED_OVERALL"} decision.targetType
 * @param {string} decision.targetId
 * @param {"APPROVED"|"APPROVED_WITH_CORRECTION"|"REJECTED"} decision.outcome
 * @param {"MINOR"|"MODERATE"|"MAJOR"|null} [decision.severity]
 * @param {string} [decision.reason]
 */
export function submitWorkReview({ targetType, targetId, outcome, severity, reason }) {
  return apiRequest("/work-reviews", {
    method: "POST",
    body: {
      targetType,
      targetId,
      outcome,
      // Omitted entirely rather than sent as null for a plain approval —
      // the API rejects a severity on an APPROVED outcome.
      ...(severity ? { severity } : {}),
      ...(reason ? { reason } : {}),
    },
  });
}
