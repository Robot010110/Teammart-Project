import { apiRequest } from "./apiClient";

// countingAssignmentService.js — talks to /api/counting-assignments.
// Mirrors backend/src/controllers/countingAssignmentsController.js one
// function per endpoint (Inventory Counting spec §1-3).

// Employee-only: their current assignment, or a synthesized default
// (their plain department, no specific area) if none has ever been set.
export function getMyAssignment() {
  return apiRequest("/counting-assignments/mine");
}

// --- Staff-only ---

// payload: { employeeId, assignedDepartment, countingArea? }
export function createCountingAssignment(payload) {
  return apiRequest("/counting-assignments", { method: "POST", body: payload });
}

export function verifyCountingAssignment(id) {
  return apiRequest(`/counting-assignments/${id}/verify`, { method: "POST" });
}

export function listCountingAssignmentsForMarket({ marketId, pending } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (pending) params.set("pending", "true");
  const query = params.toString();
  return apiRequest(`/counting-assignments/market${query ? `?${query}` : ""}`);
}
