import { Router } from "express";
import { createItemReport, listItemReports, listItemReportsForMarket, listZoneItemReports, deleteItemReport } from "../controllers/itemReportsController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createItemReportSchema,
  listItemReportsQuerySchema,
  listItemReportsMarketQuerySchema,
  listItemReportsZoneQuerySchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Staff-only market-scoped view — for Supervisor Mode's activity feed /
// employee activity history. Registered before the employee-only block
// below since it needs a different auth gate.
router.get(
  "/market",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateQuery(listItemReportsMarketQuerySchema),
  listItemReportsForMarket
);
// Zone-wide roll-up of the same reports — Regional Manager (own zones,
// derived from their token) and Admin (unscoped). Deliberately NOT open
// to SUPERVISOR: a supervisor's scope is their own market, which the
// /market route above already serves.
router.get(
  "/zone",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  validateQuery(listItemReportsZoneQuerySchema),
  listZoneItemReports
);

router.delete("/:id", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"), deleteItemReport);

// Everything else here is employee-only — the employee's own expired/
// wasted item reporting (same shape as activities.routes.js).
router.use(requireEmployeeAuth);

router.get("/", validateQuery(listItemReportsQuerySchema), listItemReports);
router.post("/", validateBody(createItemReportSchema), createItemReport);

export default router;
