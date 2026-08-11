import { Router } from "express";
import {
  listMyConversations,
  listCoworkers,
  getMarketGroup,
  getWarnings,
  getOrCreateDirect,
  listMessages,
  sendMessage,
  markConversationRead,
  postWarningBroadcast,
} from "../controllers/chatController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, sendMessageSchema } from "../utils/validate.js";

const router = Router();

// Staff-only broadcast — mounted before the employee-only gate below.
router.post(
  "/warnings/broadcast",
  requireAuth,
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  postWarningBroadcast
);

router.use(requireAuth, requireEmployeeAuth);

router.get("/", listMyConversations);
router.get("/coworkers", listCoworkers);
router.get("/market-group", getMarketGroup);
router.get("/warnings", getWarnings);
router.get("/direct/:employeeId", getOrCreateDirect);
router.get("/:id/messages", listMessages);
router.post("/:id/messages", validateBody(sendMessageSchema), sendMessage);
router.post("/:id/read", markConversationRead);

export default router;
