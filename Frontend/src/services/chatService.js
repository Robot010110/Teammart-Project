import { apiRequest } from "./apiClient";

// chatService.js — talks to /api/conversations (market-scoped Chat: one
// Market Group, one Warnings channel, and any number of Direct 1:1
// conversations). Mirrors backend/src/controllers/chatController.js one
// function per endpoint, same convention as every other service file.

export function listMyConversations() {
  return apiRequest(`/conversations`);
}

export function listCoworkers() {
  return apiRequest(`/conversations/coworkers`);
}

export function getMarketGroup() {
  return apiRequest(`/conversations/market-group`);
}

export function getWarnings() {
  return apiRequest(`/conversations/warnings`);
}

export function getOrCreateDirect(employeeId) {
  return apiRequest(`/conversations/direct/${employeeId}`);
}

// Production Chat §6-8 — General Zone / Zone Announcements. Any account
// (employee or staff) with real zone membership may open either; only the
// zone's own Regional Manager or Admin may broadcast (see
// postZoneAnnouncement below).
export function getZoneGroup(zoneId) {
  return apiRequest(`/conversations/zone/${zoneId}/group`);
}

export function getZoneAnnouncements(zoneId) {
  return apiRequest(`/conversations/zone/${zoneId}/announcements`);
}

export function postZoneAnnouncement(zoneId, body) {
  return apiRequest("/conversations/zone-announcements/broadcast", { method: "POST", body: { zoneId, body } });
}

// Production Chat §14-15 — @ mention autocomplete, scoped to this
// conversation's real membership (never a raw employee-directory dump).
export function listMentionCandidates(conversationId, q = "") {
  const params = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiRequest(`/conversations/${conversationId}/mention-candidates${params}`);
}

// Employee-only: the conversation with the employee's own market
// Supervisor (also auto-included in listMyConversations()).
export function getOrCreateSupervisorConversation() {
  return apiRequest(`/conversations/supervisor`);
}

// Returns { messages, theirLastReadAt }. `after` = incremental poll delta;
// `before` = paging backward through history (load-older-on-scroll-up);
// `search` = substring match on body within this one conversation.
export function listMessages(conversationId, { after, before, search } = {}) {
  const params = new URLSearchParams();
  if (after) params.set("after", after);
  if (before) params.set("before", before);
  if (search) params.set("search", search);
  const query = params.toString();
  return apiRequest(`/conversations/${conversationId}/messages${query ? `?${query}` : ""}`);
}

// body may be "" for an attachment-only message. imageUrl keeps the
// pre-existing image path; attachmentType/attachmentUrl/attachmentName/
// attachmentSize/attachmentDurationSec are the new generic
// file/audio/voice path (see backend sendMessageSchema — exactly one of
// body/imageUrl/attachmentUrl/forwardMessageId must be present, enforced
// server-side). replyToId, if set, must reference a message already in
// this conversation (re-checked server-side). forwardMessageId (spec §5)
// forwards an existing message the caller has access to — the server
// re-verifies that access and copies the source's content itself, so the
// client never needs to (and can't) supply the forwarded body directly.
export function sendMessage(
  conversationId,
  { body, imageUrl, attachmentType, attachmentUrl, attachmentName, attachmentSize, attachmentDurationSec, replyToId, forwardMessageId, mentions } = {}
) {
  return apiRequest(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { body, imageUrl, attachmentType, attachmentUrl, attachmentName, attachmentSize, attachmentDurationSec, replyToId, forwardMessageId, mentions },
  });
}

// Forwards an existing message into another conversation the caller is
// also a member of (spec §5) — a thin, explicitly-named wrapper around
// sendMessage's forwardMessageId so call sites read clearly.
export function forwardMessage(destinationConversationId, sourceMessageId) {
  return sendMessage(destinationConversationId, { body: "", forwardMessageId: sourceMessageId });
}

// Sender-only, text messages only (no attachment) — enforced server-side.
export function editMessage(conversationId, messageId, body, mentions) {
  return apiRequest(`/conversations/${conversationId}/messages/${messageId}`, { method: "PATCH", body: { body, mentions } });
}

// Sender-only. Soft delete — the row is kept, content is blanked.
export function deleteMessage(conversationId, messageId) {
  return apiRequest(`/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE" });
}

// Toggles: reacting with the same emoji again removes it, a different
// emoji replaces it. Returns the message's full current reaction list.
// `recognition: true` requests a Management Recognition reaction — the
// backend re-checks the actor's role and the target message's sender
// itself; this flag is only ever offered in the UI when both are already
// true, and rejected outright server-side otherwise (see
// chatController.reactToMessage).
export function reactToMessage(conversationId, messageId, emoji, recognition = false) {
  return apiRequest(`/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: "POST",
    body: { emoji, recognition },
  });
}

export function markConversationRead(conversationId) {
  return apiRequest(`/conversations/${conversationId}/read`, { method: "POST" });
}

// listConversationMedia — Group Information's real Media/Voice/Files
// browser. Returns { images, voice, files }, each a real array derived
// from actual Message rows (see chatController.listConversationMedia's
// own comment for why there's no "videos" key — this schema doesn't
// support a video attachment type).
export function listConversationMedia(conversationId) {
  return apiRequest(`/conversations/${conversationId}/media`);
}

// getMessageSeenBy — real per-message "Seen by" reader list for a group
// conversation (see chatController.getMessageSeenBy's own comment).
// Returns { count, readers: [{ kind, id, name, readAt }] }.
export function getMessageSeenBy(conversationId, messageId) {
  return apiRequest(`/conversations/${conversationId}/messages/${messageId}/seen-by`);
}

// Employee-only. Any subset of { pinned, muted }.
export function setConversationPreference(conversationId, prefs) {
  return apiRequest(`/conversations/${conversationId}/preference`, { method: "PATCH", body: prefs });
}

// Employee-only. Backend-side message search across this employee's own
// conversations — never loads full history into the browser just to
// filter it.
export function searchMessages(q) {
  const params = new URLSearchParams({ q });
  return apiRequest(`/conversations/search?${params.toString()}`);
}

// --- Staff-only (Supervisor Mode) ---
// Fire-and-forget: a Supervisor can broadcast into a market's Warnings
// channel but can't read it back (no staff GET path exists yet) —
// Supervisor Mode's Chat tab keeps its own local view of what it sent
// for that reason, see SupervisorChatTab.jsx.
export function postWarningBroadcast(marketId, body) {
  return apiRequest("/conversations/warnings/broadcast", { method: "POST", body: { marketId, body } });
}

// listMyStaffConversations/getOrCreateEmployeeConversationForSupervisor —
// the real, backend-persisted counterpart to the employee's own
// listMyConversations/getOrCreateDirect, for a Supervisor's Chat tab
// (SUPERVISOR_DIRECT with each employee, real Market Group/Warnings
// previews). Restricted server-side to the market's actual Supervisor
// account (see chatController.js).
export function listMyStaffConversations() {
  return apiRequest(`/conversations/staff`);
}

export function getOrCreateEmployeeConversationForSupervisor(employeeId) {
  return apiRequest(`/conversations/staff/employee/${employeeId}`);
}

// Regional-Manager-only. Opening this does NOT unlock it — see the
// backend's own comment: only the RM's first real message does that.
export function getOrCreateEmployeeConversationForRegionalManager(employeeId) {
  return apiRequest(`/conversations/rm/employee/${employeeId}`);
}

// Regional-Manager-only: their own conversation list (deliberately does
// NOT auto-include every market's Market Group/Warnings — see
// chatController.listMyRegionalManagerConversations's own comment on
// spec §12).
export function listMyRegionalManagerConversations() {
  return apiRequest(`/conversations/rm`);
}

// Admin-only (Phase 3.5): every CUSTOM_GROUP the Admin is an explicit
// member of, plus every STAFF_DIRECT conversation they've opened. Admin
// has no employee-1:1 conversation type in this app (see
// chatController.listMyAdminConversations).
export function listMyAdminConversations() {
  return apiRequest(`/conversations/admin`);
}

// Group conversations (spec §1/§6-13). Creating one is Supervisor/Admin/
// Regional-Manager only (re-enforced server-side); every other
// management action (rename/picture/add/remove/promote) is admin-only
// per-group, NOT per-role — see chatController.js's own comment on why
// "being a Supervisor" no longer implies control over every group.
// listGroupMembers is the one exception open to any member at all,
// admin or not.
//
// payload: { name, marketId?, zoneId?, memberEmployeeIds?, memberStaffUserIds? }
// — exactly one of marketId/zoneId scopes the group.
export function createGroup(payload) {
  return apiRequest(`/conversations/groups`, { method: "POST", body: payload });
}

export function renameGroup(conversationId, name) {
  return apiRequest(`/conversations/${conversationId}/name`, { method: "PATCH", body: { name } });
}

// deleteGroup — real, permanent delete of a Custom Group (messages,
// reactions, mentions, members all removed with it). Group-admin only,
// enforced server-side.
export function deleteGroup(conversationId) {
  return apiRequest(`/conversations/${conversationId}`, { method: "DELETE" });
}

// pictureUrl is a prepareImageForUpload() data URL, or null to clear it.
export function changeGroupPicture(conversationId, pictureUrl) {
  return apiRequest(`/conversations/${conversationId}/picture`, { method: "PATCH", body: { pictureUrl } });
}

export function listGroupMembers(conversationId) {
  return apiRequest(`/conversations/${conversationId}/members`);
}

// Provide exactly one of { employeeId } or { userId }.
export function addGroupMember(conversationId, member) {
  return apiRequest(`/conversations/${conversationId}/members`, { method: "POST", body: member });
}

// `memberId` is the ConversationMember row's own id (from
// listGroupMembers), not an employeeId/userId — one route shape works
// for either kind of member.
export function setGroupMemberAdmin(conversationId, memberId, isAdmin) {
  return apiRequest(`/conversations/${conversationId}/members/${memberId}`, { method: "PATCH", body: { isAdmin } });
}

// `memberId` is the ConversationMember row's own id, same as setGroupMemberAdmin.
export function removeGroupMember(conversationId, memberId) {
  return apiRequest(`/conversations/${conversationId}/members/${memberId}`, { method: "DELETE" });
}

// --- Phase 3: Chat organization (Important People / Groups / Individuals
// / Unread) ---

// Staff-only. Backend-filtered list of staff accounts this caller may
// start a real 1:1 with (see chatController.authorizedStaffContactsFor) —
// never every staff account in the company.
export function listAuthorizedStaffContacts() {
  return apiRequest(`/conversations/staff-contacts`);
}

// Staff-only. Get-or-create a STAFF_DIRECT conversation with another
// staff account — the target must be one of listAuthorizedStaffContacts()'s
// own results (re-checked server-side either way).
export function getOrCreateStaffContact(userId) {
  return apiRequest(`/conversations/staff-contacts/${userId}`);
}

// Staff-only. Important People — purely organizational (a favorite),
// never a permission grant on its own; the target must already be an
// authorized contact (staff-contacts or an accessible employee).
export function listImportantContacts() {
  return apiRequest(`/conversations/important-people`);
}

// Provide exactly one of { contactUserId } or { contactEmployeeId }.
export function addImportantContact({ contactUserId, contactEmployeeId, priority } = {}) {
  return apiRequest(`/conversations/important-people`, { method: "POST", body: { contactUserId, contactEmployeeId, priority } });
}

export function reorderImportantContact(id, priority) {
  return apiRequest(`/conversations/important-people/${id}`, { method: "PATCH", body: { priority } });
}

export function removeImportantContact(id) {
  return apiRequest(`/conversations/important-people/${id}`, { method: "DELETE" });
}

// The single aggregator behind the Chat page's four views. Works for
// both an Employee and a staff token — importantPeople is always [] for
// an Employee caller (see chatController.organizedConversations).
export function getOrganizedConversations() {
  return apiRequest(`/conversations/organized`);
}
