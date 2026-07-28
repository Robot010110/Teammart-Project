import { Router } from "express";
import { tasksReport, employeeSummaryReport } from "../controllers/reportsController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";

const router = Router();

// Reports are a staff tool — an employee gets their own numbers through
// the dashboard endpoint / their own profile, not a report screen.
router.get("/tasks", requireAuth, requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"), tasksReport);

// Employee summary is allowed for the employee themself too (see the
// ownership check inside the controller).
router.get("/employees/:id/summary", requireAuth, employeeSummaryReport);

export default router;
