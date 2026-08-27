import { Router } from "express";
import { receiveFingerprintEvent } from "../controllers/fingerprintController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, fingerprintEventSchema } from "../utils/validate.js";

const router = Router();

// ADMIN-only — see fingerprintController.js's own comment on why this
// is a controlled test boundary, not a live hardware connection.
router.post(
  "/",
  requireAuth,
  requireStaffRole("ADMIN"),
  validateBody(fingerprintEventSchema),
  receiveFingerprintEvent
);

export default router;
