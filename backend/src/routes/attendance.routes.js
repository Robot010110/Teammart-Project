import { Router } from "express";
import {
  importAttendanceRecords,
  createAttendanceAdjustment,
  getAttendanceMonth,
} from "../controllers/attendanceController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  importAttendanceRecordsSchema,
  createAttendanceAdjustmentSchema,
  attendanceMonthQuerySchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.get("/month", requireEmployeeAuth, validateQuery(attendanceMonthQuerySchema), getAttendanceMonth);

// Staff-only. No frontend caller yet (no Supervisor/import UI) — prepared
// for that module the same way Sudden Task assignment was.
router.post(
  "/import",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(importAttendanceRecordsSchema),
  importAttendanceRecords
);
router.post(
  "/adjustments",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(createAttendanceAdjustmentSchema),
  createAttendanceAdjustment
);

export default router;
