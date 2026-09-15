import { Router } from "express";
import { createWorkReview, getReviewQueue } from "../controllers/workReviewsController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, validateQuery, recordWorkReviewSchema, reviewQueueQuerySchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Same staff roles the five per-model review endpoints already allow.
// Market scoping is NOT done here — it depends on the reviewed row's own
// market, which is looked up fresh inside the service (a client could
// otherwise pass any targetId). workReviewService.recordReview calls
// assertMarketAccess against that fetched market.
const REVIEWER_ROLES = ["ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"];

// Fixed path registered before any /:id-shaped route — this app's standard
// ordering convention.
router.get(
  "/queue",
  requireStaffRole(...REVIEWER_ROLES),
  validateQuery(reviewQueueQuerySchema),
  getReviewQueue
);

router.post(
  "/",
  requireStaffRole(...REVIEWER_ROLES),
  validateBody(recordWorkReviewSchema),
  createWorkReview
);

export default router;
