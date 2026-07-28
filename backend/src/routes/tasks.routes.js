import { Router } from "express";
import {
  submitTask,
  assignTask,
  submitAssignedTask,
  listTasks,
  getTask,
  approveTask,
  rejectTask,
} from "../controllers/tasksController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  submitTaskSchema,
  assignTaskSchema,
  rejectTaskSchema,
  listTasksQuerySchema,
} from "../utils/validate.js";
import { z } from "zod";

const router = Router();

router.use(requireAuth);

router.get("/", validateQuery(listTasksQuerySchema), listTasks);
router.get("/:id", getTask);

// Employee submits their own completed activity.
router.post("/", requireEmployeeAuth, validateBody(submitTaskSchema), submitTask);

// Employee marks a previously-assigned task as done.
router.patch(
  "/:id/submit",
  requireEmployeeAuth,
  validateBody(
    z.object({
      notes: z.string().max(1000).optional(),
      beforePhotoUrl: z.string().url().optional(),
      afterPhotoUrl: z.string().url().optional(),
    })
  ),
  submitAssignedTask
);

// Staff proactively assigns a task to an employee.
router.post(
  "/assign",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(assignTaskSchema),
  assignTask
);

router.patch("/:id/approve", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"), approveTask);
router.patch(
  "/:id/reject",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(rejectTaskSchema),
  rejectTask
);

export default router;
