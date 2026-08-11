import { apiRequest } from "./apiClient";

// profileService.js — talks to GET /api/profile, which returns whoever
// is currently logged in (staff or employee) based on the token. This
// phase only ever calls it as an Employee, so the shape used by the rest
// of the app is the "kind: employee" branch documented in the backend's
// profileController.js.

export async function getProfile() {
  return apiRequest("/profile");
}

// updateMyWhatsApp — the only self-service profile field today (see
// profileController.updateMyProfile). Pass null to clear it. Server-side
// normalization/validation (digits only, 8-15 digits) means this can
// still reject a malformed value — callers should surface ApiError.
export function updateMyWhatsApp(whatsappNumber) {
  return apiRequest("/profile", { method: "PATCH", body: { whatsappNumber } });
}
