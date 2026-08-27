import { Router } from "express";
import {
  createBreak,
  getMyBreak,
  confirmBreak,
  cancelBreak,
  listBreaksForMarket,
} from "../controllers/breaksController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, validateQuery, createBreakSchema, cancelBreakSchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// ADMIN-only controlled test/manual creation — see
// breaksController.createBreak's own comment on why this isn't a
// general self-service endpoint.
router.post("/", requireStaffRole("ADMIN"), validateBody(createBreakSchema), createBreak);

// Cross-role — Employee/Cashier AND Supervisor/Overlooking; the allowed-
// kinds check and ownership both live in the controller (same pattern as
// attendance check-in/out), not a role gate here.
router.get("/me", getMyBreak);
router.patch("/:id/confirm", confirmBreak);
router.patch("/:id/cancel", validateBody(cancelBreakSchema), cancelBreak);

// Staff-only market visibility.
router.get(
  "/market",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"),
  listBreaksForMarket
);

export default router;
