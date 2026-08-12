import { Router } from "express";
import {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  addActivityImage,
  deleteActivityImage,
  getPerformanceSummary,
  getActivityPerformanceHistory,
  listActivitiesForMarket,
} from "../controllers/activitiesController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createActivitySchema,
  updateActivitySchema,
  addActivityImageSchema,
  listActivitiesQuerySchema,
  listActivitiesMarketQuerySchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Staff-only market-scoped view — for Supervisor Mode. Registered before
// the employee-only gate below since it needs a different auth guard.
router.get(
  "/market",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateQuery(listActivitiesMarketQuerySchema),
  listActivitiesForMarket
);

// Everything else here is employee-only — the employee's own daily
// activity log, not a Supervisor review surface.
router.use(requireEmployeeAuth);

router.get("/", validateQuery(listActivitiesQuerySchema), listActivities);
router.post("/", validateBody(createActivitySchema), createActivity);

// Registered before /:id so these fixed paths aren't swallowed as an id.
router.get("/performance", getPerformanceSummary);
router.get("/performance-history", getActivityPerformanceHistory);

router.get("/:id", getActivity);
router.patch("/:id", validateBody(updateActivitySchema), updateActivity);
router.delete("/:id", deleteActivity);

router.post("/:id/images", validateBody(addActivityImageSchema), addActivityImage);
router.delete("/:id/images/:imageId", deleteActivityImage);

export default router;
