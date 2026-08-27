import { Router } from "express";
import {
  listTaskDefinitions,
  createTaskDefinition,
  updateTaskDefinition,
  getMyNightShiftDashboard,
  listNightShiftActivityForMarket,
} from "../controllers/nightShiftController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  createNightShiftTaskDefinitionSchema,
  updateNightShiftTaskDefinitionSchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.get("/task-definitions", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"), listTaskDefinitions);
router.post("/task-definitions", requireStaffRole("ADMIN"), validateBody(createNightShiftTaskDefinitionSchema), createTaskDefinition);
router.patch("/task-definitions/:id", requireStaffRole("ADMIN"), validateBody(updateNightShiftTaskDefinitionSchema), updateTaskDefinition);

router.get("/my-dashboard", requireEmployeeAuth, getMyNightShiftDashboard);

router.get("/market/:marketId", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"), listNightShiftActivityForMarket);

export default router;
