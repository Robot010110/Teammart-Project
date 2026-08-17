import { Router } from "express";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Any authenticated account (Employee or staff) can read their own
// notification feed — recipientWhere() in the controller picks the
// right column, and every write path already scopes the recipient
// correctly (see utils/notifications.js).
router.use(requireAuth);

router.get("/", listMyNotifications);
router.patch("/:id/read", markNotificationRead);
router.patch("/read-all", markAllNotificationsRead);

export default router;
