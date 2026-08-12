import { apiRequest } from "./apiClient";

// wastedOverallService.js — talks to /api/wasted-overall. Mirrors
// backend/src/controllers/wastedOverallController.js one function per
// endpoint the Worker UI actually calls — the staff review queue has no
// frontend caller yet (no Supervisor screen exists anywhere in this app).

// payload: { item, quantityKg, photoUrl?, notes? }
export function createWastedOverallReport(payload) {
  return apiRequest("/wasted-overall", { method: "POST", body: payload });
}

export function listMyWastedOverallReports() {
  return apiRequest("/wasted-overall");
}

// --- Staff-only (Supervisor Mode) ---
export function listWastedOverallReportsForMarket({ marketId, status } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiRequest(`/wasted-overall/market${query ? `?${query}` : ""}`);
}
