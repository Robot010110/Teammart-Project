import { apiRequest } from "./apiClient";

// marketProblemsService.js — talks to /api/market-problems (Repair Pass
// §4). Real backend replacement for the previous mock data
// (data/supervisorMockData.js's listMarketProblems/createMarketProblem/
// updateMarketProblemStatus) — same function names/shapes on this side
// so ReportsProblemsSection.jsx's own logic barely had to change, just
// what it calls.

export function listMarketProblems(marketId, view = "active") {
  return apiRequest(`/market-problems?marketId=${encodeURIComponent(marketId)}&view=${view}`);
}

export function createMarketProblem({ marketId: _marketId, problemType, location, description, photoUrl }) {
  return apiRequest("/market-problems", { method: "POST", body: { problemType, location, description, photoUrl } });
}

export function updateMarketProblemStatus(id, status) {
  return apiRequest(`/market-problems/${id}/status`, { method: "PATCH", body: { status } });
}

// deleteMarketProblem — real, persisted (soft) delete; removed from both
// Active and History immediately (see marketProblemsController.js).
export function deleteMarketProblem(id) {
  return apiRequest(`/market-problems/${id}`, { method: "DELETE" });
}
