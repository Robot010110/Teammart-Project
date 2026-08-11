import { Router } from "express";
import { getProfile, updatePassword, updateMyProfile } from "../controllers/profileController.js";
import { requireAuth, requireEmployeeAuth } from "../middleware/auth.js";
import { validateBody, updatePasswordSchema, updateMyProfileSchema } from "../utils/validate.js";

const router = Router();

router.get("/", requireAuth, getProfile);
router.patch("/", requireAuth, requireEmployeeAuth, validateBody(updateMyProfileSchema), updateMyProfile);
router.patch("/password", requireAuth, validateBody(updatePasswordSchema), updatePassword);

export default router;
