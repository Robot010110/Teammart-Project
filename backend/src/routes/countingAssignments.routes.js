import { Router } from "express";
import {
  getMyAssignment,
  createCountingAssignment,
  verifyCountingAssignment,
  listCountingAssignmentsForMarket,
} from "../controllers/countingAssignmentsController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, validateQuery, createCountingAssignmentSchema, listCountingAssignmentsQuerySchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.get("/mine", requireEmployeeAuth, getMyAssignment);

router.post(
  "/",
  requireStaffRole("SUPERVISOR", "ADMIN", "REGIONAL_MANAGER"),
  validateBody(createCountingAssignmentSchema),
  createCountingAssignment
);
router.get(
  "/market",
  requireStaffRole("SUPERVISOR", "ADMIN", "REGIONAL_MANAGER"),
  validateQuery(listCountingAssignmentsQuerySchema),
  listCountingAssignmentsForMarket
);
router.post(
  "/:id/verify",
  requireStaffRole("REGIONAL_MANAGER", "ADMIN"),
  verifyCountingAssignment
);

export default router;
