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
  deleteMyExtraHoursRequest,
  deleteMyRequiredHoursAdjustment,
  deleteMyPunishment,
  listMyAttendanceAdjustmentRequests,
  listAttendanceAdjustmentRequestsForMarket,
  reviewAttendanceAdjustmentRequest,
  getAttendanceHistory,
  confirmStillWorking,
  checkIn,
  checkOut,
  getTodayAttendance,
  startBreak,
  endBreak,
  getMyStaffAttendanceMonth,
  previewBreakExport,
  listCompanyAttendance,
} from "../controllers/attendanceController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createRequiredHoursAdjustmentSchema,
  setPunishmentHoursSchema,
  attendanceMonthQuerySchema,
  attendanceReportQuerySchema,
  staffAttendanceMonthQuerySchema,
  submitExtraHoursSchema,
  reviewAttendanceAdjustmentSchema,
  listAttendanceAdjustmentsQuerySchema,
  confirmStillWorkingSchema,
  companyAttendanceQuerySchema,
} from "../utils/validate.js";

// Memory storage — the file is parsed (utils/attendanceExcel.js) and
// discarded, never written to disk. 5MB is generous for a market's
// monthly attendance export; matches the ~1MB body-size discipline
// already applied to JSON requests (app.js) for the same reason: an
// explicit, intentional limit rather than an implicit default.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.use(requireAuth);

// Cross-role live attendance (Phase 1) — Employee/Cashier AND Supervisor/
// Overlooking share these two endpoints and the underlying
// AttendanceRecord table; no role gate here beyond requireAuth because
// the exact allowed-kinds check (and the resulting ownership) lives in
// attendanceController.attendanceOwnerFromUser — see its own comment for
// why Admin/Regional Manager are excluded there instead of here.
router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.get("/today", getTodayAttendance);
// Self-service break, tied directly to AttendanceRecord.breakStart/
// breakEnd (see attendanceController.startBreak's own comment for why
// this is deliberately a different mechanism from the fingerprint-
// triggered Break model/breaksController.js — the timing rule and the
// action-shape here don't match that flow at all).
router.post("/break-start", startBreak);
router.post("/break-end", endBreak);
// Supervisor/Overlooking's own attendance history — never accepts a
// target id (always req.user.userId inside the controller), so this
// can't be used to reach another market's attendance by editing a query
// param.
router.get("/me/month", validateQuery(staffAttendanceMonthQuerySchema), getMyStaffAttendanceMonth);

router.get("/month", requireEmployeeAuth, validateQuery(attendanceMonthQuerySchema), getAttendanceMonth);
// Admin Phase 1 §16 — company-wide, no market/zone scoping.
router.get("/company", requireStaffRole("ADMIN"), validateQuery(companyAttendanceQuerySchema), listCompanyAttendance);
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

// The Excel EXPORT (outbound) integration boundary's own verification
// endpoint — see services/excelExportAdapter.js's own comment.
router.get("/break-export-preview", requireStaffRole("ADMIN"), previewBreakExport);

// Extra-hours self-submission (spec §10-14) — employee-only submit/list/
// history; staff-only market review list + approve/reject. Kept under
// this same /attendance router (not a separate module) since it's an
// attendance concept end-to-end, same "extend rather than duplicate"
// call as everything else in this router.
router.post("/extra-hours", requireEmployeeAuth, validateBody(submitExtraHoursSchema), submitExtraHours);
router.get("/extra-hours", requireEmployeeAuth, listMyAttendanceAdjustmentRequests);
router.delete("/extra-hours/:id", requireEmployeeAuth, deleteMyExtraHoursRequest);
// Repair Pass follow-up — an employee dismissing their own, already-old
// (see attendanceController's MANUAL_CLEAR_AFTER_DAYS) Required Hours
// Adjustment / Penalty from their own Attendance screen.
router.delete("/required-hours-adjustments/:id", requireEmployeeAuth, deleteMyRequiredHoursAdjustment);
router.delete("/:id/punishment", requireEmployeeAuth, deleteMyPunishment);
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

// Missing-checkout confirmation (spec §7 — "Are you still working?").
router.post("/still-working", requireEmployeeAuth, validateBody(confirmStillWorkingSchema), confirmStillWorking);

export default router;
