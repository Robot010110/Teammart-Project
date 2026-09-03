import { Router } from "express";
import {
  createLeaveRequest,
  listMyLeaveRequests,
  listLeaveRequestsForMarket,
  approveLeaveRequest,
  rejectLeaveRequest,
  getOffDayQuota,
} from "../controllers/leaveRequestsController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createLeaveRequestSchema,
  reviewLeaveRequestSchema,
  listLeaveRequestsQuerySchema,
  leaveQuotaQuerySchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.get("/", requireEmployeeAuth, listMyLeaveRequests);
router.post("/", requireEmployeeAuth, validateBody(createLeaveRequestSchema), createLeaveRequest);

// Attendance calendar's Choose Off Type sheet — real weekly/monthly
// usage for the date the employee tapped, so an already-exhausted
// option shows as disabled before they try it.
router.get("/quota", requireEmployeeAuth, validateQuery(leaveQuotaQuerySchema), getOffDayQuota);

// Staff-side review queue + approve/reject. No frontend caller yet (no
// Supervisor screen exists) — prepared for that module the same way
// Sudden Task assignment and attendance import were.
router.get(
  "/market",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateQuery(listLeaveRequestsQuerySchema),
  listLeaveRequestsForMarket
);
router.patch(
  "/:id/approve",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(reviewLeaveRequestSchema),
  approveLeaveRequest
);
router.patch(
  "/:id/reject",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(reviewLeaveRequestSchema),
  rejectLeaveRequest
);

export default router;
