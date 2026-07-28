import { apiRequest } from "./apiClient";

// profileService.js — talks to GET /api/profile, which returns whoever
// is currently logged in (staff or employee) based on the token. This
// phase only ever calls it as an Employee, so the shape used by the rest
// of the app is the "kind: employee" branch documented in the backend's
// profileController.js.

export async function getProfile() {
  return apiRequest("/profile");
}
