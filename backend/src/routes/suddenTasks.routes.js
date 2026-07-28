import { Router } from "express";
import {
  assignSuddenTask,
  listSuddenTasks,
  getSuddenTask,
  completeSuddenTask,
} from "../controllers/suddenTasksController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createSuddenTaskSchema,
  listSuddenTasksQuerySchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.get("/", validateQuery(listSuddenTasksQuerySchema), listSuddenTasks);
router.get("/:id", getSuddenTask);

// Staff pushes an urgent task to a specific employee. No frontend caller
// yet — that's Supervisor-module work — but the endpoint is real and
// tested so that module can be built without backend changes.
router.post(
  "/assign",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(createSuddenTaskSchema),
  assignSuddenTask
);

// Employee marks their own sudden task as done.
router.patch("/:id/complete", requireEmployeeAuth, completeSuddenTask);

export default router;
