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
  listMyAdminConversations,
  getOrCreateEmployeeConversationForSupervisor,
  getOrCreateEmployeeConversationForRegionalManager,
  listAuthorizedStaffContacts,
  getOrCreateStaffContact,
  listImportantContacts,
  addImportantContact,
  reorderImportantContact,
  removeImportantContact,
  organizedConversations,
  createGroup,
  renameGroup,
  deleteGroup,
  changeGroupPicture,
  listGroupMembers,
  addGroupMember,
  removeGroupMember,
  setGroupMemberAdmin,
  listMessages,
  getMessageSeenBy,
  listConversationMedia,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  markConversationRead,
  setConversationPreference,
  searchConversations,
  postWarningBroadcast,
  getZoneGroup,
  getZoneAnnouncements,
  postZoneAnnouncement,
  listMentionCandidates,
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
  addImportantContactSchema,
  reorderImportantContactSchema,
  postZoneAnnouncementSchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Staff-only.
router.post("/warnings/broadcast", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"), postWarningBroadcast);
// Production Chat §8 — only the zone's own Regional Manager (checked via
// assertZoneAccess inside the controller) or Admin may post; a Supervisor
// is a zone MEMBER (read/general-chat) but never a zone announcement
// publisher, unlike the market-level Warnings channel above.
router.post(
  "/zone-announcements/broadcast",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  validateBody(postZoneAnnouncementSchema),
  postZoneAnnouncement
);
router.get("/staff", requireStaffRole("SUPERVISOR", "OVERLOOKING_SUPERVISOR"), listMyStaffConversations);
router.get("/rm", requireStaffRole("REGIONAL_MANAGER"), listMyRegionalManagerConversations);
router.get("/admin", requireStaffRole("ADMIN"), listMyAdminConversations);
router.get("/staff/employee/:employeeId", requireStaffRole("SUPERVISOR"), getOrCreateEmployeeConversationForSupervisor);
router.get("/rm/employee/:employeeId", requireStaffRole("REGIONAL_MANAGER"), getOrCreateEmployeeConversationForRegionalManager);

// Important People / STAFF_DIRECT (Phase 3 §3-4) — staff-only.
router.get("/staff-contacts", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"), listAuthorizedStaffContacts);
router.get("/staff-contacts/:userId", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"), getOrCreateStaffContact);
router.get("/important-people", requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"), listImportantContacts);
router.post(
  "/important-people",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"),
  validateBody(addImportantContactSchema),
  addImportantContact
);
router.patch(
  "/important-people/:id",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"),
  validateBody(reorderImportantContactSchema),
  reorderImportantContact
);
router.delete(
  "/important-people/:id",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"),
  removeImportantContact
);

// Production Chat §6-8 — General Zone / Zone Announcements, shared by any
// account kind with real zone membership (checked inside the controller
// via isZoneMember — an Employee, that market's Supervisor/Overlooking, the
// zone's Regional Manager(s), or Admin).
router.get("/zone/:zoneId/group", getZoneGroup);
router.get("/zone/:zoneId/announcements", getZoneAnnouncements);

// Chat organization aggregator (Phase 3 §1-5) — Important People/Groups/
// Individuals/Unread, shared by both account kinds; conversationAccessFor-
// style role branching happens inside the controller, not here.
router.get("/organized", organizedConversations);

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
router.delete("/:id", deleteGroup);
router.patch("/:id/picture", validateBody(changeGroupPictureSchema), changeGroupPicture);
router.post("/:id/members", validateBody(addGroupMemberSchema), addGroupMember);
router.delete("/:id/members/:memberId", removeGroupMember);
router.patch("/:id/members/:memberId", validateBody(setGroupMemberAdminSchema), setGroupMemberAdmin);
// Viewing the roster is open to anyone with access to the group (an
// actual member) — conversationAccessFor decides, not a role gate.
router.get("/:id/members", listGroupMembers);
// Group Information's real Media/Voice/Files browser — access is the
// same conversationAccessFor check as everything else on this
// conversation, not a group-admin restriction (any real member can
// browse what's already been shared).
router.get("/:id/media", listConversationMedia);

// Employee-only.
router.get("/", requireEmployeeAuth, listMyConversations);
router.get("/coworkers", requireEmployeeAuth, listCoworkers);
router.get("/market-group", requireEmployeeAuth, getMarketGroup);
router.get("/warnings", requireEmployeeAuth, getWarnings);
router.get("/direct/:employeeId", requireEmployeeAuth, getOrCreateDirect);
router.get("/supervisor", requireEmployeeAuth, getOrCreateSupervisorConversation);
router.get("/search", requireEmployeeAuth, searchConversations);
// Shared by both account kinds (Phase 3) — access is checked inside the
// controller via conversationAccessFor, same as messages/read below.
router.patch("/:id/preference", validateBody(conversationPreferenceSchema), setConversationPreference);

// Shared by both account kinds — access to the specific conversation (and,
// for edit/delete, sender ownership of the specific message) is checked
// inside the controller, not by route-level role gating, since a
// SUPERVISOR_DIRECT conversation legitimately has one Employee
// participant and one staff participant.
router.get("/:id/messages", listMessages);
router.get("/:id/mention-candidates", listMentionCandidates);
router.post("/:id/messages", validateBody(sendMessageSchema), sendMessage);
router.patch("/:id/messages/:messageId", validateBody(editMessageSchema), editMessage);
router.delete("/:id/messages/:messageId", deleteMessage);
router.post("/:id/messages/:messageId/reactions", validateBody(reactToMessageSchema), reactToMessage);
router.post("/:id/read", markConversationRead);
router.get("/:id/messages/:messageId/seen-by", getMessageSeenBy);

export default router;
