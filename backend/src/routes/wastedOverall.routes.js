import { Router } from "express";
import {
  createWastedOverallReport,
  listMyWastedOverallReports,
  listWastedOverallReportsForMarket,
  reviewWastedOverallReport,
} from "../controllers/wastedOverallController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createWastedOverallReportSchema,
  listWastedOverallQuerySchema,
  reviewWastedOverallReportSchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.post("/", requireEmployeeAuth, validateBody(createWastedOverallReportSchema), createWastedOverallReport);
router.get("/", requireEmployeeAuth, listMyWastedOverallReports);

// Staff-only.
router.get(
  "/market",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateQuery(listWastedOverallQuerySchema),
  listWastedOverallReportsForMarket
);
router.post(
  "/:id/review",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(reviewWastedOverallReportSchema),
  reviewWastedOverallReport
);

export default router;
