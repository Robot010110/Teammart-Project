import { apiRequest } from "./apiClient";

// zoneService.js — talks to /api/zones. Mirrors
// backend/src/controllers/zonesController.js. Staff-only (Admin sees
// every zone; a Regional Manager's own zones only — scoped server-side,
// never by anything here).

export function listZones() {
  return apiRequest("/zones");
}

export function getZone(id) {
  return apiRequest(`/zones/${id}`);
}

// ADMIN-only.
export function createZone(number) {
  return apiRequest("/zones", { method: "POST", body: { number } });
}

// ADMIN-only. managerId: a User.id belonging to a REGIONAL_MANAGER
// account, or null to unassign.
export function assignZoneManager(zoneId, managerId) {
  return apiRequest(`/zones/${zoneId}/manager`, { method: "PATCH", body: { managerId } });
}

// ADMIN-only.
export function deleteZone(id) {
  return apiRequest(`/zones/${id}`, { method: "DELETE" });
}
