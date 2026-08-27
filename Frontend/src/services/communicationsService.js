import { apiRequest } from "./apiClient";

// communicationsService.js — talks to /api/communications. Mirrors
// backend/src/controllers/communicationsController.js one function per
// endpoint. See that file + communicationTargeting.js for what's
// actually authoritative — every function here is a thin wrapper, never
// a place that computes a recipient count or an authorization decision
// itself.

// targeting: { scopeType, zoneId?, marketId?, targetRole, targetDepartment? }
export function previewCommunication(targeting) {
  return apiRequest("/communications/preview", { method: "POST", body: targeting });
}

// payload: targeting fields + { type, category, title, message, priority?,
// deadline?, actionType?, clientRequestId? }
export function sendCommunication(payload) {
  return apiRequest("/communications", { method: "POST", body: payload });
}

export function listSentCommunications() {
  return apiRequest("/communications/sent");
}

export function getCommunicationProgress(id) {
  return apiRequest(`/communications/${id}`);
}

// --- Employee-facing ---------------------------------------------------

export function listMyCommunications() {
  return apiRequest("/communications/my");
}

// Also marks it read as a side effect (see the backend controller's own
// comment) — no separate "mark read" call needed.
export function getMyCommunication(id) {
  return apiRequest(`/communications/my/${id}`);
}

export function acknowledgeCommunication(id) {
  return apiRequest(`/communications/my/${id}/acknowledge`, { method: "PATCH" });
}

export function startCommunicationTask(id) {
  return apiRequest(`/communications/my/${id}/start`, { method: "PATCH" });
}

export function completeCommunicationTask(id, response) {
  return apiRequest(`/communications/my/${id}/complete`, { method: "PATCH", body: { response } });
}

// A random-enough client-side id so a double-tap/retry of Send can never
// create two Communication rows (see createCommunicationSchema.clientRequestId
// and sendCommunication's own comment on the backend). Not a security
// boundary — the backend's unique constraint is — just what makes retries
// idempotent.
export function newClientRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
