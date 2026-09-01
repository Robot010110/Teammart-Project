import { Router } from "express";
import { submitTotalSales, listTotalSalesReports, reviewTotalSalesReport, deleteTotalSalesReport, getZoneSalesSummary } from "../controllers/totalSalesController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, validateQuery, submitTotalSalesSchema, listTotalSalesQuerySchema, reviewTotalSalesReportSchema, zoneSalesSummaryQuerySchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth, requireStaffRole("SUPERVISOR", "REGIONAL_MANAGER", "ADMIN"));

router.post("/", requireStaffRole("SUPERVISOR"), validateBody(submitTotalSalesSchema), submitTotalSales);
// Registered before "/" (GET) — a distinct literal path, no shadowing
// risk, but grouped here so the Market Activities summary route reads
// next to the other Regional-Manager/Admin routes it's a variant of.
router.get("/zone-summary", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), validateQuery(zoneSalesSummaryQuerySchema), getZoneSalesSummary);
router.get("/", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), validateQuery(listTotalSalesQuerySchema), listTotalSalesReports);
router.patch("/:id/review", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), validateBody(reviewTotalSalesReportSchema), reviewTotalSalesReport);
router.delete("/:id", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), deleteTotalSalesReport);

export default router;
