import { Router } from "express";
import { getCompanyOverview, globalSearch, getAdminReportsSummary } from "../controllers/adminController.js";
import {
  updateStaffProfile,
  changeStaffRole,
  setRegionalManagerZones,
  promoteEmployeeToStaff,
  demoteStaffToEmployee,
  resetEmployeePassword,
  resetStaffPassword,
  setEmployeeAccountStatus,
  setStaffAccountStatus,
} from "../controllers/adminAccountController.js";
import {
  startMarketVisit,
  completeMarketVisit,
  cancelMarketVisit,
  listMarketVisits,
} from "../controllers/adminVisitController.js";
import { listAuditLog } from "../controllers/adminAuditController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  adminSearchQuerySchema,
  updateStaffProfileSchema,
  changeStaffRoleSchema,
  setRmZonesSchema,
  promoteEmployeeSchema,
  demoteStaffSchema,
  resetPasswordSchema,
  setAccountStatusSchema,
  startMarketVisitSchema,
  completeMarketVisitSchema,
  cancelMarketVisitSchema,
  listMarketVisitsQuerySchema,
  listAuditLogQuerySchema,
  adminReportsSummaryQuerySchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth, requireStaffRole("ADMIN"));

router.get("/overview", getCompanyOverview);
router.get("/search", validateQuery(adminSearchQuerySchema), globalSearch);
router.get("/reports/summary", validateQuery(adminReportsSummaryQuerySchema), getAdminReportsSummary);

// Admin Phase 2 — staff (User) account management.
router.patch("/staff/:userId", validateBody(updateStaffProfileSchema), updateStaffProfile);
router.post("/staff/:userId/role", validateBody(changeStaffRoleSchema), changeStaffRole);
router.post("/staff/:userId/zones", validateBody(setRmZonesSchema), setRegionalManagerZones);
router.post("/staff/:userId/demote", validateBody(demoteStaffSchema), demoteStaffToEmployee);
router.post("/staff/:userId/reset-password", validateBody(resetPasswordSchema), resetStaffPassword);
router.post("/staff/:userId/status", validateBody(setAccountStatusSchema), setStaffAccountStatus);

// Admin Phase 2 — employee account management. Market/shift/department/
// employeeCode/username changes reuse the EXISTING PATCH /api/employees/:id
// and POST /api/employees/:id/department endpoints (already ADMIN-
// accessible, already validate uniqueness/scope) — not duplicated here.
router.post("/employees/:employeeId/promote", validateBody(promoteEmployeeSchema), promoteEmployeeToStaff);
router.post("/employees/:employeeId/reset-password", validateBody(resetPasswordSchema), resetEmployeePassword);
router.post("/employees/:employeeId/status", validateBody(setAccountStatusSchema), setEmployeeAccountStatus);

// Admin Phase 3 — Market Visits / Administrative Inspections (one shared
// MarketVisit table with Regional Manager's own unrelated grouping-visit
// rows — see adminVisitController.js's own comment).
router.post("/markets/:marketId/visits", validateBody(startMarketVisitSchema), startMarketVisit);
router.patch("/visits/:visitId/complete", validateBody(completeMarketVisitSchema), completeMarketVisit);
router.patch("/visits/:visitId/cancel", validateBody(cancelMarketVisitSchema), cancelMarketVisit);
router.get("/visits", validateQuery(listMarketVisitsQuerySchema), listMarketVisits);

// Admin Phase 3 — Audit Log (read-only; no update/delete route exists).
router.get("/audit", validateQuery(listAuditLogQuerySchema), listAuditLog);

export default router;
