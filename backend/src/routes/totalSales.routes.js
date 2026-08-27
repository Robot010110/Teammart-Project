import { Router } from "express";
import { submitTotalSales, listTotalSalesReports, reviewTotalSalesReport, deleteTotalSalesReport } from "../controllers/totalSalesController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, validateQuery, submitTotalSalesSchema, listTotalSalesQuerySchema, reviewTotalSalesReportSchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth, requireStaffRole("SUPERVISOR", "REGIONAL_MANAGER", "ADMIN"));

router.post("/", requireStaffRole("SUPERVISOR"), validateBody(submitTotalSalesSchema), submitTotalSales);
router.get("/", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), validateQuery(listTotalSalesQuerySchema), listTotalSalesReports);
router.patch("/:id/review", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), validateBody(reviewTotalSalesReportSchema), reviewTotalSalesReport);
router.delete("/:id", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), deleteTotalSalesReport);

export default router;
