import { Router } from "express";
import {
  listKochProducts,
  listMyKochOperations,
  createKochOperation,
} from "../controllers/kochOperationsController.js";
import { requireAuth, requireEmployeeAuth } from "../middleware/auth.js";
import { validateBody, createKochOperationSchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Employee-only (Worker and Cashier both) — role-specific validation
// happens inside createKochOperation itself, based on the authenticated
// employee's real role, not a route-level gate.
router.get("/products", requireEmployeeAuth, listKochProducts);
router.get("/", requireEmployeeAuth, listMyKochOperations);
router.post("/", requireEmployeeAuth, validateBody(createKochOperationSchema), createKochOperation);

export default router;
