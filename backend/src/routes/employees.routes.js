import { Router } from "express";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  assignDepartment,
  getDepartmentHistory,
  addAdditionalDepartment,
  removeAdditionalDepartment,
} from "../controllers/employeesController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, createEmployeeSchema, updateEmployeeSchema, assignDepartmentSchema, additionalDepartmentSchema } from "../utils/validate.js";

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

// Department assignment — staff-only, no employee-facing write path at
// all (spec §3: employees must not be able to modify their own
// department). No frontend caller yet (no Supervisor screen exists).
router.post(
  "/:id/department",
  requireAuth,
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(assignDepartmentSchema),
  assignDepartment
);
router.get(
  "/:id/department-history",
  requireAuth,
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  getDepartmentHistory
);

// Night Shift §3-4 — additional (non-MAIN) department responsibilities.
router.post(
  "/:id/additional-departments",
  requireAuth,
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(additionalDepartmentSchema),
  addAdditionalDepartment
);
router.delete(
  "/:id/additional-departments/:department",
  requireAuth,
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  removeAdditionalDepartment
);

export default router;
