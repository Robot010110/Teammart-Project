import { Router } from "express";
import {
  createWastedOverallReport,
  listMyWastedOverallReports,
  listWastedOverallReportsForMarket,
} from "../controllers/wastedOverallController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, validateQuery, createWastedOverallReportSchema, listWastedOverallQuerySchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.post("/", requireEmployeeAuth, validateBody(createWastedOverallReportSchema), createWastedOverallReport);
router.get("/", requireEmployeeAuth, listMyWastedOverallReports);

// Staff-only. No frontend caller yet (no Supervisor review screen exists
// anywhere in this app) — same "backend-ready" pattern as every other
// staff-only endpoint here.
router.get(
  "/market",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateQuery(listWastedOverallQuerySchema),
  listWastedOverallReportsForMarket
);

export default router;
