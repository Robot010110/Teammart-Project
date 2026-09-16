import { Router } from "express";
import {
  getCounts, listCategory,
  getDepartmentClosingMarkets, getDepartmentClosingMarket, getDepartmentClosingShift,
} from "../controllers/zoneActivitiesController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateQuery, zoneActivitiesCountsQuerySchema, zoneActivitiesCategoryQuerySchema,
  departmentClosingZoneQuerySchema, departmentClosingMarketQuerySchema,
} from "../utils/validate.js";

const router = Router();

// Zone Activities (Regional Manager) — read-only aggregation over the
// existing Activity/ItemReport/WastedOverallReport/PriceReport/
// MarketProblem models. ADMIN + REGIONAL_MANAGER only, matching every
// other zone-wide rollup endpoint in this app (listCompanyActivities,
// listZoneItemReports, listMarketProblems's ?zoneId= branch) — explicitly
// NOT open to SUPERVISOR/OVERLOOKING_SUPERVISOR, whose existing
// market-scoped activity views are unaffected by this feature entirely.
router.use(requireAuth, requireStaffRole("ADMIN", "REGIONAL_MANAGER"));

router.get("/counts", validateQuery(zoneActivitiesCountsQuerySchema), getCounts);

// Department Closing's own dedicated drill-down (Market -> Shift ->
// Department -> Photo) — registered before the generic "/:category"
// catch-all below, same "fixed paths before :param" convention this
// codebase already uses everywhere (e.g. markets.routes.js's
// /supervisors before /:id).
router.get("/department-closing/markets/:marketId/shifts/:date/:shift", getDepartmentClosingShift);
router.get(
  "/department-closing/markets/:marketId",
  validateQuery(departmentClosingMarketQuerySchema),
  getDepartmentClosingMarket
);
router.get(
  "/department-closing/markets",
  validateQuery(departmentClosingZoneQuerySchema),
  getDepartmentClosingMarkets
);

router.get("/:category", validateQuery(zoneActivitiesCategoryQuerySchema), listCategory);

export default router;
