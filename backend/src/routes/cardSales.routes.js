import { Router } from "express";
import {
  submitCardSales,
  getCardSalesDay,
  listCardSalesHistory,
  deleteCardSalesReport,
  getZoneCardSalesSummary,
  sendCardSalesReminder,
} from "../controllers/cardSalesController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  submitCardSalesSchema,
  cardSalesDayQuerySchema,
  cardSalesHistoryQuerySchema,
  zoneCardSalesSummaryQuerySchema,
  sendCardSalesReminderSchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth, requireStaffRole("SUPERVISOR", "OVERLOOKING_SUPERVISOR", "REGIONAL_MANAGER", "ADMIN"));

router.post("/", requireStaffRole("SUPERVISOR", "OVERLOOKING_SUPERVISOR"), validateBody(submitCardSalesSchema), submitCardSales);
// Registered before "/day" — distinct literal paths, no shadowing risk,
// grouped here with the other Regional-Manager/Admin Market Activities
// routes.
router.get("/zone-summary", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), validateQuery(zoneCardSalesSummaryQuerySchema), getZoneCardSalesSummary);
router.post("/remind", requireStaffRole("REGIONAL_MANAGER", "ADMIN"), validateBody(sendCardSalesReminderSchema), sendCardSalesReminder);
router.get("/day", validateQuery(cardSalesDayQuerySchema), getCardSalesDay);
router.get("/history", validateQuery(cardSalesHistoryQuerySchema), listCardSalesHistory);
router.delete("/:id", deleteCardSalesReport);

export default router;
