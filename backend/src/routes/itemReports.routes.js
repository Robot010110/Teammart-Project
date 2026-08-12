import { Router } from "express";
import { createItemReport, listItemReports, listItemReportsForMarket } from "../controllers/itemReportsController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createItemReportSchema,
  listItemReportsQuerySchema,
  listItemReportsMarketQuerySchema,
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

// Everything else here is employee-only — the employee's own expired/
// wasted item reporting (same shape as activities.routes.js).
router.use(requireEmployeeAuth);

router.get("/", validateQuery(listItemReportsQuerySchema), listItemReports);
router.post("/", validateBody(createItemReportSchema), createItemReport);

export default router;
