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
} from "../controllers/activitiesController.js";
import { requireAuth, requireEmployeeAuth } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createActivitySchema,
  updateActivitySchema,
  addActivityImageSchema,
  listActivitiesQuerySchema,
} from "../utils/validate.js";

const router = Router();

// Every activity route is employee-only — this module is just the
// employee's own daily activity log, not a Supervisor review surface.
router.use(requireAuth, requireEmployeeAuth);

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
