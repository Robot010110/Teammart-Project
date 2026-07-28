import { Router } from "express";
import {
  getAttendanceSummary,
  listAttendanceAdjustments,
  createAttendanceRecord,
  createAttendanceAdjustment,
} from "../controllers/attendanceController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import {
  validateBody,
  createAttendanceRecordSchema,
  createAttendanceAdjustmentSchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.get("/summary", requireEmployeeAuth, getAttendanceSummary);
router.get("/adjustments", requireEmployeeAuth, listAttendanceAdjustments);

// Staff-only. No frontend caller yet (no Supervisor UI) — prepared for
// that module the same way sudden-task assignment is.
router.post(
  "/records",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(createAttendanceRecordSchema),
  createAttendanceRecord
);
router.post(
  "/adjustments",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(createAttendanceAdjustmentSchema),
  createAttendanceAdjustment
);

export default router;
