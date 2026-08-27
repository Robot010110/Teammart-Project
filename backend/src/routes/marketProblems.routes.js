import { Router } from "express";
import {
  listMarketProblems,
  createMarketProblem,
  updateMarketProblemStatus,
  deleteMarketProblem,
} from "../controllers/marketProblemsController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createMarketProblemSchema,
  updateMarketProblemStatusSchema,
  listMarketProblemsQuerySchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);
router.use(requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"));

router.get("/", validateQuery(listMarketProblemsQuerySchema), listMarketProblems);
router.post("/", validateBody(createMarketProblemSchema), createMarketProblem);
router.patch("/:id/status", validateBody(updateMarketProblemStatusSchema), updateMarketProblemStatus);
router.delete("/:id", deleteMarketProblem);

export default router;
