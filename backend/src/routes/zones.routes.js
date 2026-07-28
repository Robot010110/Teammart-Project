import { Router } from "express";
import {
  listZones,
  getZone,
  createZone,
  assignZoneManager,
  deleteZone,
} from "../controllers/zonesController.js";
import { requireAuth, requireStaffRole, requireOwnZoneOrElevated } from "../middleware/auth.js";
import { validateBody, createZoneSchema, assignZoneManagerSchema } from "../utils/validate.js";

const router = Router();

// Every zone route requires staff login (employees don't deal with zones).
router.use(requireAuth, requireStaffRole("ADMIN", "REGIONAL_MANAGER"));

router.get("/", listZones);

router.get("/:id", requireOwnZoneOrElevated((req) => req.params.id), getZone);

router.post("/", requireStaffRole("ADMIN"), validateBody(createZoneSchema), createZone);

router.patch(
  "/:id/manager",
  requireStaffRole("ADMIN"),
  validateBody(assignZoneManagerSchema),
  assignZoneManager
);

router.delete("/:id", requireStaffRole("ADMIN"), deleteZone);

export default router;
