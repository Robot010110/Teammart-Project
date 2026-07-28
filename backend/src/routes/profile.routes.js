import { Router } from "express";
import { getProfile, updatePassword } from "../controllers/profileController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, updatePasswordSchema } from "../utils/validate.js";

const router = Router();

router.get("/", requireAuth, getProfile);
router.patch("/password", requireAuth, validateBody(updatePasswordSchema), updatePassword);

export default router;
