import { Router } from "express";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employeesController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, createEmployeeSchema, updateEmployeeSchema } from "../utils/validate.js";

const router = Router();

// GET /:id also allows an Employee to fetch their OWN record, so auth is
// just requireAuth here; per-route ownership is checked inside the
// controllers (they need the employee's marketId first to check it).
router.get("/", requireAuth, requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"), listEmployees);
router.get("/:id", requireAuth, getEmployee);

router.post(
  "/",
  requireAuth,
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(createEmployeeSchema),
  createEmployee
);

router.patch(
  "/:id",
  requireAuth,
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(updateEmployeeSchema),
  updateEmployee
);

router.delete(
  "/:id",
  requireAuth,
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  deleteEmployee
);

export default router;
