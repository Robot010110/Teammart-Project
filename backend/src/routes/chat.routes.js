import { Router } from "express";
import {
  listMyConversations,
  listCoworkers,
  getMarketGroup,
  getWarnings,
  getOrCreateDirect,
  getOrCreateSupervisorConversation,
  listMyStaffConversations,
  listMyRegionalManagerConversations,
  getOrCreateEmployeeConversationForSupervisor,
  getOrCreateEmployeeConversationForRegionalManager,
  createGroup,
  renameGroup,
  changeGroupPicture,
  listGroupMembers,
  addGroupMember,
  removeGroupMember,
  setGroupMemberAdmin,
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
  createGroupSchema,
  renameGroupSchema,
  changeGroupPictureSchema,
  addGroupMemberSchema,
  setGroupMemberAdminSchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Staff-only.
router.post("/warnings/broadcast", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"), postWarningBroadcast);
router.get("/staff", requireStaffRole("SUPERVISOR", "OVERLOOKING_SUPERVISOR"), listMyStaffConversations);
router.get("/rm", requireStaffRole("REGIONAL_MANAGER"), listMyRegionalManagerConversations);
router.get("/staff/employee/:employeeId", requireStaffRole("SUPERVISOR"), getOrCreateEmployeeConversationForSupervisor);
router.get("/rm/employee/:employeeId", requireStaffRole("REGIONAL_MANAGER"), getOrCreateEmployeeConversationForRegionalManager);

// Group management (spec §1/§6-8/§13). Only creating a group is gated by
// role here — every other management action (rename/picture/add/remove/
// promote) is open to any authenticated account at the route level
// because admin rights are per-group, not per-role (an employee member
// can be promoted to Group Admin too); the controller's requireGroupAdmin
// is the actual, single source of truth for all of them.
router.post(
  "/groups",
  requireStaffRole("SUPERVISOR", "ADMIN", "REGIONAL_MANAGER"),
  validateBody(createGroupSchema),
  createGroup
);
router.patch("/:id/name", validateBody(renameGroupSchema), renameGroup);
router.patch("/:id/picture", validateBody(changeGroupPictureSchema), changeGroupPicture);
router.post("/:id/members", validateBody(addGroupMemberSchema), addGroupMember);
router.delete("/:id/members/:memberId", removeGroupMember);
router.patch("/:id/members/:memberId", validateBody(setGroupMemberAdminSchema), setGroupMemberAdmin);
// Viewing the roster is open to anyone with access to the group (an
// actual member) — conversationAccessFor decides, not a role gate.
router.get("/:id/members", listGroupMembers);

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
