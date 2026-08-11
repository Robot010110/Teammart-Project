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

export function listMessages(conversationId, { after } = {}) {
  const params = new URLSearchParams();
  if (after) params.set("after", after);
  const query = params.toString();
  return apiRequest(`/conversations/${conversationId}/messages${query ? `?${query}` : ""}`);
}

// body may be "" for an attachment-only message. imageUrl keeps the
// pre-existing image path; attachmentType/attachmentUrl/attachmentName/
// attachmentSize/attachmentDurationSec are the new generic
// file/audio/voice path (see backend sendMessageSchema — exactly one of
// body/imageUrl/attachmentUrl must be present, enforced server-side).
export function sendMessage(
  conversationId,
  { body, imageUrl, attachmentType, attachmentUrl, attachmentName, attachmentSize, attachmentDurationSec } = {}
) {
  return apiRequest(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { body, imageUrl, attachmentType, attachmentUrl, attachmentName, attachmentSize, attachmentDurationSec },
  });
}

export function markConversationRead(conversationId) {
  return apiRequest(`/conversations/${conversationId}/read`, { method: "POST" });
}
