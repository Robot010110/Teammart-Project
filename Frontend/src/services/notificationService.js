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

// deleteNotification — Repair Pass §6: a real, persisted delete
// (soft-deleted server-side — see the backend's own comment), not a
// React-state-only hide. The deleted notification stops coming back from
// listMyNotifications immediately, and stays gone across refresh/
// logout/re-login since it's backed by a real column.
export function deleteNotification(id) {
  return apiRequest(`/notifications/${id}`, { method: "DELETE" });
}

// deleteAllNotifications — bulk "Delete All", same real soft-delete as
// deleteNotification above, scoped entirely server-side to the caller's
// own feed (no ids sent — there's nothing here for a client to spoof).
export function deleteAllNotifications() {
  return apiRequest(`/notifications`, { method: "DELETE" });
}
