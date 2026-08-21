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

// updateMyProfilePhoto — same PATCH /api/profile endpoint, own-account-
// only (backend derives the target from the auth token, never trusts an
// id from the client — see profileController.updateMyProfile). `url` is
// a prepareImageForUpload() data URL, same convention as every other
// photo in this app.
export function updateMyProfilePhoto(profilePictureUrl) {
  return apiRequest("/profile", { method: "PATCH", body: { profilePictureUrl } });
}

// updateMyUserId — self-service "User ID" change (spec §7). `field` is
// whichever the caller's own account actually uses: "employeeCode"
// (Worker), "username" (Cashier), or "loginId" (Supervisor/Overlooking).
// Same PATCH /api/profile endpoint, own-account-only. Case-insensitive
// uniqueness is enforced server-side (userIdTaken) — a 409 ApiError means
// the id is already taken.
export function updateMyUserId(field, value) {
  return apiRequest("/profile", { method: "PATCH", body: { [field]: value } });
}

// updateMyPassword — spec §8: current password required, hashed
// server-side, never echoed back. Works for both account kinds (see
// profileController.updatePassword).
export function updateMyPassword(currentPassword, newPassword) {
  return apiRequest("/profile/password", { method: "PATCH", body: { currentPassword, newPassword } });
}
