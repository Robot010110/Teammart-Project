import { Router } from "express";
import {
  assignSuddenTask,
  listSuddenTasks,
  getSuddenTask,
  startSuddenTask,
  completeSuddenTask,
} from "../controllers/suddenTasksController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createSuddenTaskSchema,
  listSuddenTasksQuerySchema,
  completeSuddenTaskSchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.get("/", validateQuery(listSuddenTasksQuerySchema), listSuddenTasks);
router.get("/:id", getSuddenTask);

// Staff pushes an urgent task to a specific employee.
router.post(
  "/assign",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(createSuddenTaskSchema),
  assignSuddenTask
);

// My Tasks redesign — employee starts their own sudden task
// (ASSIGNED -> IN_PROGRESS), then marks it done (IN_PROGRESS -> COMPLETED
// only, see completeSuddenTask's own comment).
router.patch("/:id/start", requireEmployeeAuth, startSuddenTask);
router.patch("/:id/complete", requireEmployeeAuth, validateBody(completeSuddenTaskSchema), completeSuddenTask);

export default router;
