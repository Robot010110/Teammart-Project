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
  editMessage,
  deleteMessage,
  reactToMessage,
  markConversationRead,
  setConversationPreference,
  searchConversations,
  postWarningBroadcast,
} from "../controllers/chatController.js";
import { requireAuth, requireEmployeeAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  sendMessageSchema,
  editMessageSchema,
  reactToMessageSchema,
  conversationPreferenceSchema,
} from "../utils/validate.js";

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
router.get("/search", requireEmployeeAuth, searchConversations);
router.patch("/:id/preference", requireEmployeeAuth, validateBody(conversationPreferenceSchema), setConversationPreference);

// Shared by both account kinds — access to the specific conversation (and,
// for edit/delete, sender ownership of the specific message) is checked
// inside the controller, not by route-level role gating, since a
// SUPERVISOR_DIRECT conversation legitimately has one Employee
// participant and one staff participant.
router.get("/:id/messages", listMessages);
router.post("/:id/messages", validateBody(sendMessageSchema), sendMessage);
router.patch("/:id/messages/:messageId", validateBody(editMessageSchema), editMessage);
router.delete("/:id/messages/:messageId", deleteMessage);
router.post("/:id/messages/:messageId/reactions", validateBody(reactToMessageSchema), reactToMessage);
router.post("/:id/read", markConversationRead);

export default router;
