import { Router } from "express";
import {
  listMyConversations,
  listCoworkers,
  getMarketGroup,
  getWarnings,
  getOrCreateDirect,
  getOrCreateSupervisorConversation,
  listMyStaffConversations,
  getOrCreateEmployeeConversationForSupervisor,
  listMessages,
  sendMessage,
  markConversationRead,
  postWarningBroadcast,
} from "../controllers/chatController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import { validateBody, sendMessageSchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Staff-only.
router.post("/warnings/broadcast", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"), postWarningBroadcast);
router.get("/staff", requireStaffRole("SUPERVISOR"), listMyStaffConversations);
router.get("/staff/employee/:employeeId", requireStaffRole("SUPERVISOR"), getOrCreateEmployeeConversationForSupervisor);

// Employee-only.
router.get("/", requireEmployeeAuth, listMyConversations);
router.get("/coworkers", requireEmployeeAuth, listCoworkers);
router.get("/market-group", requireEmployeeAuth, getMarketGroup);
router.get("/warnings", requireEmployeeAuth, getWarnings);
router.get("/direct/:employeeId", requireEmployeeAuth, getOrCreateDirect);
router.get("/supervisor", requireEmployeeAuth, getOrCreateSupervisorConversation);

// Shared by both account kinds — access to the specific conversation is
// checked inside the controller (conversationAccessFor), not by route-
// level role gating, since a SUPERVISOR_DIRECT conversation legitimately
// has one Employee participant and one staff participant.
router.get("/:id/messages", listMessages);
router.post("/:id/messages", validateBody(sendMessageSchema), sendMessage);
router.post("/:id/read", markConversationRead);

export default router;
