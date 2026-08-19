import { Router } from "express";
import multer from "multer";
import {
  importAttendanceRecords,
  createRequiredHoursAdjustment,
  getAttendanceMonth,
  getEmployeeAttendanceMonth,
  getPerformanceHistory,
  getExtraHoursBalance,
  getEmployeeExtraHoursBalance,
  setPunishmentHours,
  exportAttendanceReport,
  submitExtraHours,
  listMyAttendanceAdjustmentRequests,
  listAttendanceAdjustmentRequestsForMarket,
  reviewAttendanceAdjustmentRequest,
  getAttendanceHistory,
} from "../controllers/attendanceController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createRequiredHoursAdjustmentSchema,
  setPunishmentHoursSchema,
  attendanceMonthQuerySchema,
  attendanceReportQuerySchema,
  submitExtraHoursSchema,
  reviewAttendanceAdjustmentSchema,
  listAttendanceAdjustmentsQuerySchema,
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

// Staff-only, Supervisor Mode's Employee Attendance screen — an arbitrary
// employee's month/balance instead of the caller's own.
router.get(
  "/employee/:employeeId/month",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateQuery(attendanceMonthQuerySchema),
  getEmployeeAttendanceMonth
);
router.get(
  "/employee/:employeeId/extra-hours-balance",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  getEmployeeExtraHoursBalance
);

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

// Extra-hours self-submission (spec §10-14) — employee-only submit/list/
// history; staff-only market review list + approve/reject. Kept under
// this same /attendance router (not a separate module) since it's an
// attendance concept end-to-end, same "extend rather than duplicate"
// call as everything else in this router.
router.post("/extra-hours", requireEmployeeAuth, validateBody(submitExtraHoursSchema), submitExtraHours);
router.get("/extra-hours", requireEmployeeAuth, listMyAttendanceAdjustmentRequests);
router.get("/history", requireEmployeeAuth, getAttendanceHistory);
router.get(
  "/extra-hours/market",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateQuery(listAttendanceAdjustmentsQuerySchema),
  listAttendanceAdjustmentRequestsForMarket
);
router.post(
  "/extra-hours/:id/review",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(reviewAttendanceAdjustmentSchema),
  reviewAttendanceAdjustmentRequest
);

export default router;
