import { Router } from "express";
import {
  listActivities,
  getActivity,
  createActivity,
  createDepartmentClosingForEmployee,
  createDepartmentClosingForUnassignedDepartment,
  updateActivity,
  deleteActivity,
  addActivityImage,
  replaceActivityImage,
  deleteActivityImage,
  getPerformanceSummary,
  getActivityPerformanceHistory,
  listActivitiesForMarket,
  listCompanyActivities,
  reviewActivity,
} from "../controllers/activitiesController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createActivitySchema,
  staffCreateDepartmentClosingSchema,
  staffCreateDepartmentClosingForUnassignedSchema,
  updateActivitySchema,
  addActivityImageSchema,
  replaceActivityImageSchema,
  listActivitiesQuerySchema,
  listActivitiesMarketQuerySchema,
  reviewActivitySchema,
  companyActivitiesQuerySchema,
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

// Admin Phase 1 §17 — company-wide, no market scoping for ADMIN. Market
// Activities §5 reuses this same route for REGIONAL_MANAGER too, scoped
// to their own zone(s) inside the controller (see its own comment).
router.get("/company", requireStaffRole("ADMIN", "REGIONAL_MANAGER"), validateQuery(companyActivitiesQuerySchema), listCompanyActivities);

// Staff-only approve/reject — also registered before the employee-only
// gate below. Market scoping happens inside reviewActivity itself
// (against the activity's own employee), not here.
router.post(
  "/:id/review",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(reviewActivitySchema),
  reviewActivity
);

// Staff-only: "authorized supervisor" submitting a Department Closing on
// an employee's behalf (spec §12) — also registered before the
// employee-only gate below. Market/employee scoping happens inside
// createDepartmentClosingForEmployee itself (requireAccessibleEmployee).
router.post(
  "/department-closing/:employeeId",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"),
  validateBody(staffCreateDepartmentClosingSchema),
  createDepartmentClosingForEmployee
);

// Phase 2 §15-16: a genuinely UNASSIGNED department — no employee to
// target at all, so this is market-scoped instead of employee-scoped.
router.post(
  "/department-closing/market/:marketId",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"),
  validateBody(staffCreateDepartmentClosingForUnassignedSchema),
  createDepartmentClosingForUnassignedDepartment
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
router.patch("/:id/images/:imageId", validateBody(replaceActivityImageSchema), replaceActivityImage);
router.delete("/:id/images/:imageId", deleteActivityImage);

export default router;
