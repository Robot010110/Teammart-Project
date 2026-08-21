import { Router } from "express";
import { getProfile, updatePassword, updateMyProfile } from "../controllers/profileController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, updatePasswordSchema, updateMyProfileSchema } from "../utils/validate.js";

const router = Router();

router.get("/", requireAuth, getProfile);
// Open to both account kinds now — a Supervisor/Overlooking changes
// their own loginId ("User ID", spec §7) through the same route an
// employee uses for their own photo/WhatsApp/User ID. Ownership is
// enforced inside updateMyProfile (always the caller's own row), not by
// gating account kind at the route level.
router.patch("/", requireAuth, validateBody(updateMyProfileSchema), updateMyProfile);
router.patch("/password", requireAuth, validateBody(updatePasswordSchema), updatePassword);

export default router;
