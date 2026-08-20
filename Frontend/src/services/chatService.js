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
  { body, imageUrl, attachmentType, attachmentUrl, attachmentName, attachmentSize, attachmentDurationSec, replyToId, forwardMessageId } = {}
) {
  return apiRequest(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { body, imageUrl, attachmentType, attachmentUrl, attachmentName, attachmentSize, attachmentDurationSec, replyToId, forwardMessageId },
  });
}

// Forwards an existing message into another conversation the caller is
// also a member of (spec §5) — a thin, explicitly-named wrapper around
// sendMessage's forwardMessageId so call sites read clearly.
export function forwardMessage(destinationConversationId, sourceMessageId) {
  return sendMessage(destinationConversationId, { body: "", forwardMessageId: sourceMessageId });
}

// Sender-only, text messages only (no attachment) — enforced server-side.
export function editMessage(conversationId, messageId, body) {
  return apiRequest(`/conversations/${conversationId}/messages/${messageId}`, { method: "PATCH", body: { body } });
}

// Sender-only. Soft delete — the row is kept, content is blanked.
export function deleteMessage(conversationId, messageId) {
  return apiRequest(`/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE" });
}

// Toggles: reacting with the same emoji again removes it, a different
// emoji replaces it. Returns the message's full current reaction list.
export function reactToMessage(conversationId, messageId, emoji) {
  return apiRequest(`/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: "POST",
    body: { emoji },
  });
}

export function markConversationRead(conversationId) {
  return apiRequest(`/conversations/${conversationId}/read`, { method: "POST" });
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

// Group conversations (spec §6-8) — Supervisor/Admin/Regional-Manager
// only, re-enforced server-side (requireGroupManagerRole), not just
// gated by what this frontend shows. listGroupMembers is the one
// exception: any authorized member (staff or employee) can view the
// roster, not just a manager, so it's also called from the employee
// Chat tab's group header.
export function createGroup(name, memberEmployeeIds) {
  return apiRequest(`/conversations/groups`, { method: "POST", body: { name, memberEmployeeIds } });
}

export function renameGroup(conversationId, name) {
  return apiRequest(`/conversations/${conversationId}/name`, { method: "PATCH", body: { name } });
}

export function listGroupMembers(conversationId) {
  return apiRequest(`/conversations/${conversationId}/members`);
}

export function addGroupMember(conversationId, employeeId) {
  return apiRequest(`/conversations/${conversationId}/members`, { method: "POST", body: { employeeId } });
}

export function removeGroupMember(conversationId, employeeId) {
  return apiRequest(`/conversations/${conversationId}/members/${employeeId}`, { method: "DELETE" });
}
