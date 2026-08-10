import { apiRequest } from "./apiClient";

// notificationService.js — talks to /api/notifications (the current
// employee's own notification feed). Mirrors
// backend/src/controllers/notificationsController.js one function per
// endpoint, same convention as every other service file.

export function listMyNotifications({ limit } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", limit);
  const query = params.toString();
  return apiRequest(`/notifications${query ? `?${query}` : ""}`);
}

export function markNotificationRead(id) {
  return apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead() {
  return apiRequest(`/notifications/read-all`, { method: "PATCH" });
}
