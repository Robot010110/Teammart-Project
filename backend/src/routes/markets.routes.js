import { Router } from "express";
import {
  listMarkets,
  getMarket,
  createMarket,
  updateMarket,
  assignMarketSupervisor,
  deleteMarket,
} from "../controllers/marketsController.js";
import { requireAuth, requireStaffRole, requireOwnMarketOrElevated } from "../middleware/auth.js";
import {
  validateBody,
  createMarketSchema,
  updateMarketSchema,
  assignMarketSupervisorSchema,
} from "../utils/validate.js";

const router = Router();

// Markets are staff-only (employees reach market info through /profile,
// scoped to just their own market — see profile.routes.js).
router.use(requireAuth, requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"));

router.get("/", listMarkets);

router.get("/:id", requireOwnMarketOrElevated((req) => req.params.id), getMarket);

router.post(
  "/",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  validateBody(createMarketSchema),
  createMarket
);

router.patch(
  "/:id",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(updateMarketSchema),
  updateMarket
);

router.patch(
  "/:id/supervisor",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(assignMarketSupervisorSchema),
  assignMarketSupervisor
);

router.delete(
  "/:id",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  deleteMarket
);

export default router;
