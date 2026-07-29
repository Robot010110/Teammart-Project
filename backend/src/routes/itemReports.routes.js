import { Router } from "express";
import { createItemReport, listItemReports } from "../controllers/itemReportsController.js";
import { requireAuth, requireEmployeeAuth } from "../middleware/auth.js";
import { validateBody, validateQuery, createItemReportSchema, listItemReportsQuerySchema } from "../utils/validate.js";

const router = Router();

// Every route here is employee-only — this module is the employee's own
// expired/wasted item reporting, not a Supervisor review surface (same
// shape as activities.routes.js).
router.use(requireAuth, requireEmployeeAuth);

router.get("/", validateQuery(listItemReportsQuerySchema), listItemReports);
router.post("/", validateBody(createItemReportSchema), createItemReport);

export default router;
