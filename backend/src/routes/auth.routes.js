import { Router } from "express";
import { register, staffLogin, staffIdLogin, employeeLogin, cashierLogin } from "../controllers/authController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import {
  validateBody,
  staffRegisterSchema,
  staffLoginSchema,
  staffIdLoginSchema,
  employeeLoginSchema,
  cashierLoginSchema,
} from "../utils/validate.js";

const router = Router();

// Only an existing Admin can create new staff accounts — this is an
// internal management tool, not public sign-up.
router.post(
  "/register",
  requireAuth,
  requireStaffRole("ADMIN"),
  validateBody(staffRegisterSchema),
  register
);

// authLimiter — these two are the actual brute-force attack surface
// (guessing a password/employee code), so they get the tight limit.
router.post("/login", authLimiter, validateBody(staffLoginSchema), staffLogin);
router.post("/staff-id-login", authLimiter, validateBody(staffIdLoginSchema), staffIdLogin);
router.post("/employee-login", authLimiter, validateBody(employeeLoginSchema), employeeLogin);
router.post("/cashier-login", authLimiter, validateBody(cashierLoginSchema), cashierLogin);

export default router;
