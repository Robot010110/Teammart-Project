import { apiRequest } from "./apiClient";

// marketManagementService.js — talks to the Regional Manager market-
// management endpoints (overview/sections/ratings/notes/feedback/visits/
// history). Mirrors backend/src/controllers/marketManagementController.js
// one function per endpoint. Every call is market-scoped server-side
// (assertMarketAccess) regardless of what marketId is passed here.

export function getMarketOverview(marketId) {
  return apiRequest(`/markets/${marketId}/overview`);
}

export function listMarketSections(marketId) {
  return apiRequest(`/markets/${marketId}/sections`);
}

export function getMarketSectionDetail(marketId, department) {
  return apiRequest(`/markets/${marketId}/sections/${encodeURIComponent(department)}`);
}

export function getMarketHistory(marketId) {
  return apiRequest(`/markets/${marketId}/history`);
}

// Regional-Manager/Admin only (enforced server-side).
export function createMarketVisit(marketId) {
  return apiRequest(`/markets/${marketId}/visits`, { method: "POST" });
}

export function listMarketRatings(marketId) {
  return apiRequest(`/markets/${marketId}/ratings`);
}

// payload: { rating: 1-10, notes?, visitId? }
export function rateMarket(marketId, payload) {
  return apiRequest(`/markets/${marketId}/ratings`, { method: "POST", body: payload });
}

// payload: { content, category?, visitId? }
export function addMarketNote(marketId, payload) {
  return apiRequest(`/markets/${marketId}/notes`, { method: "POST", body: payload });
}

// payload: { type: "WARNING" | "RECOGNITION", title, description, category?, priority?, photoUrl?, visitId? }
export function sendMarketFeedback(marketId, payload) {
  return apiRequest(`/markets/${marketId}/feedback`, { method: "POST", body: payload });
}
