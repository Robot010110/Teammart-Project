import { Router } from "express";
import { submitTotalSales, listTotalSalesReports } from "../controllers/totalSalesController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, validateQuery, submitTotalSalesSchema, listTotalSalesQuerySchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth, requireStaffRole("SUPERVISOR", "REGIONAL_MANAGER", "ADMIN"));

router.post("/", requireStaffRole("SUPERVISOR"), validateBody(submitTotalSalesSchema), submitTotalSales);
router.get("/", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), validateQuery(listTotalSalesQuerySchema), listTotalSalesReports);

export default router;
