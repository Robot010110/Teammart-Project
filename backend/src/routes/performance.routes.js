import { Router } from "express";
import {
  getPerformanceSummary, getPerformanceHistory, getPerformanceAggregate,
  getPerformancePeriod, getEmployeeReviews,
  getMarketPerformance, getZonePerformance, recomputePerformance,
} from "../controllers/performanceController.js";
import {
  requireAuth, requireEmployeeAuth, requireStaffRole,
  requireOwnEmployeeOrStaff, requireOwnMarketOrElevated,
} from "../middleware/auth.js";
import {
  validateBody, validateQuery,
  performanceHistoryQuerySchema, performanceListQuerySchema,
  performanceReviewsQuerySchema, recomputePerformanceSchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Staff roles that may look at someone else's performance. Market/zone
// scoping is applied per route below — being a Supervisor is not on its
// own permission to read another market's numbers.
const MANAGEMENT_ROLES = ["ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"];

// ---------------------------------------------------------------------
// Employee self-service. requireEmployeeAuth makes these structurally
// incapable of returning anyone else's data — there is no id in the path
// to tamper with; the subject is always the token's own employeeId.
// ---------------------------------------------------------------------
router.get("/me", requireEmployeeAuth, getPerformanceSummary);
router.get("/me/history", requireEmployeeAuth, validateQuery(performanceHistoryQuerySchema), getPerformanceHistory);
router.get("/me/aggregate", requireEmployeeAuth, validateQuery(performanceHistoryQuerySchema), getPerformanceAggregate);
router.get("/me/reviews", requireEmployeeAuth, validateQuery(performanceReviewsQuerySchema), getEmployeeReviews);
router.get("/me/periods/:periodType/:periodStart", requireEmployeeAuth, getPerformancePeriod);

// ---------------------------------------------------------------------
// Management views. Registered BEFORE the /employees/:employeeId routes so
// these fixed paths are not swallowed as an employee id — this app's
// standard route-ordering convention.
// ---------------------------------------------------------------------
router.get(
  "/market",
  requireStaffRole(...MANAGEMENT_ROLES),
  requireOwnMarketOrElevated((req) => req.query.marketId),
  validateQuery(performanceListQuerySchema),
  getMarketPerformance
);

// Zone access is asserted inside the controller (assertZoneAccess), which
// is where the zoneId is actually known to be valid.
router.get(
  "/zone",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  validateQuery(performanceListQuerySchema),
  getZonePerformance
);

// The only mutating route in the feature. It accepts no score — it marks
// periods stale and re-derives them from source data.
router.post(
  "/recompute",
  requireStaffRole("ADMIN"),
  validateBody(recomputePerformanceSchema),
  recomputePerformance
);

// ---------------------------------------------------------------------
// Per-employee views.
//
// Two layers, deliberately: requireOwnEmployeeOrStaff proves "this is me,
// or I am staff", and requireAccessibleEmployee (inside the controller)
// proves a staff caller actually owns that employee's market or zone.
// The middleware alone would let any Supervisor read any employee.
// ---------------------------------------------------------------------
const ownEmployee = requireOwnEmployeeOrStaff((req) => req.params.employeeId);

router.get("/employees/:employeeId", ownEmployee, getPerformanceSummary);
router.get("/employees/:employeeId/history", ownEmployee, validateQuery(performanceHistoryQuerySchema), getPerformanceHistory);
router.get("/employees/:employeeId/aggregate", ownEmployee, validateQuery(performanceHistoryQuerySchema), getPerformanceAggregate);
router.get("/employees/:employeeId/reviews", ownEmployee, validateQuery(performanceReviewsQuerySchema), getEmployeeReviews);
router.get("/employees/:employeeId/periods/:periodType/:periodStart", ownEmployee, getPerformancePeriod);

export default router;
