import { Router } from "express";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationsController.js";
import { requireAuth, requireEmployeeAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireEmployeeAuth);

router.get("/", listMyNotifications);
router.patch("/:id/read", markNotificationRead);
router.patch("/read-all", markAllNotificationsRead);

export default router;
