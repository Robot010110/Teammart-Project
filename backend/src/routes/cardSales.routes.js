import { Router } from "express";
import { submitCardSales, getCardSalesDay, listCardSalesHistory } from "../controllers/cardSalesController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  submitCardSalesSchema,
  cardSalesDayQuerySchema,
  cardSalesHistoryQuerySchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth, requireStaffRole("SUPERVISOR", "OVERLOOKING_SUPERVISOR", "REGIONAL_MANAGER", "ADMIN"));

router.post("/", requireStaffRole("SUPERVISOR", "OVERLOOKING_SUPERVISOR"), validateBody(submitCardSalesSchema), submitCardSales);
router.get("/day", validateQuery(cardSalesDayQuerySchema), getCardSalesDay);
router.get("/history", validateQuery(cardSalesHistoryQuerySchema), listCardSalesHistory);

export default router;
