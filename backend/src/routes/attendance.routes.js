import { Router } from "express";
import multer from "multer";
import {
  importAttendanceRecords,
  createRequiredHoursAdjustment,
  getAttendanceMonth,
  getPerformanceHistory,
  getExtraHoursBalance,
  setPunishmentHours,
  exportAttendanceReport,
} from "../controllers/attendanceController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createRequiredHoursAdjustmentSchema,
  setPunishmentHoursSchema,
  attendanceMonthQuerySchema,
  attendanceReportQuerySchema,
} from "../utils/validate.js";

// Memory storage — the file is parsed (utils/attendanceExcel.js) and
// discarded, never written to disk. 5MB is generous for a market's
// monthly attendance export; matches the ~1MB body-size discipline
// already applied to JSON requests (app.js) for the same reason: an
// explicit, intentional limit rather than an implicit default.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.use(requireAuth);

router.get("/month", requireEmployeeAuth, validateQuery(attendanceMonthQuerySchema), getAttendanceMonth);
router.get("/performance-history", requireEmployeeAuth, getPerformanceHistory);
router.get("/extra-hours-balance", requireEmployeeAuth, getExtraHoursBalance);

// Staff-only. No frontend caller yet (no Supervisor/import UI) — prepared
// for that module the same way Sudden Task assignment was.
router.post(
  "/import",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  upload.single("file"),
  importAttendanceRecords
);
router.post(
  "/required-hours-adjustments",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(createRequiredHoursAdjustmentSchema),
  createRequiredHoursAdjustment
);
router.post(
  "/punishment-hours",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(setPunishmentHoursSchema),
  setPunishmentHours
);
router.get(
  "/report/export",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateQuery(attendanceReportQuerySchema),
  exportAttendanceReport
);

export default router;
