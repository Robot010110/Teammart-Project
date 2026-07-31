import { Router } from "express";
import { getTodayCleaningLog, submitCleaningLog } from "../controllers/cashierCleaningController.js";
import { requireAuth, requireEmployeeAuth, requireEmployeeRole } from "../middleware/auth.js";
import { validateBody, submitCleaningLogSchema } from "../utils/validate.js";

const router = Router();

// Cashier-only, and backend-gated (not just hidden in the UI) — a Worker
// hitting this would be a real bug, not a UI nicety, since the model has
// no meaning for a Worker account.
router.use(requireAuth, requireEmployeeAuth, requireEmployeeRole("CASHIER"));

router.get("/today", getTodayCleaningLog);
router.post("/", validateBody(submitCleaningLogSchema), submitCleaningLog);

export default router;
