import { Router } from "express";
import {
  createPriceReport,
  listPriceReports,
  listPriceReportsForMarket,
  deletePriceReport,
} from "../controllers/priceReportsController.js";
import { requireAuth, requireEmployeeAuth, requireEmployeeRole, requireStaffRole } from "../middleware/auth.js";
import { validateBody, validateQuery, createPriceReportSchema, listPriceReportsQuerySchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Cashier-only, backend-gated like Cleaning — a Worker submitting a price
// report would be a real bug, not just a hidden UI path.
router.get("/", requireEmployeeAuth, requireEmployeeRole("CASHIER"), listPriceReports);
router.post("/", requireEmployeeAuth, requireEmployeeRole("CASHIER"), validateBody(createPriceReportSchema), createPriceReport);

// Staff-side view, scoped to a market they can access. No frontend caller
// yet (no Supervisor screen exists) — prepared for that module the same
// way Sudden Task assignment and Attendance import were.
router.get(
  "/market",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateQuery(listPriceReportsQuerySchema),
  listPriceReportsForMarket
);
router.delete("/:id", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"), deletePriceReport);

export default router;
