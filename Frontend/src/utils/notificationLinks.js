// notificationLinks.js — maps a Notification's { linkType, linkId } (see
// backend/src/utils/notifications.js — every notification-creating
// action already sets these) to a real route under the caller's
// basePath, so tapping a notification actually goes somewhere instead of
// being a dead end. Exactly the 5 linkType values the backend ever
// writes are handled here (grep-verified against every createNotification
// call site) — anything else falls back to no navigation rather than a
// guessed/broken route.
export function notificationDestination(notification, basePath) {
  const { linkType, linkId } = notification;
  switch (linkType) {
    case "SUDDEN_TASK":
      return linkId ? `${basePath}/tasks/${linkId}` : `${basePath}/tasks`;
    case "CONVERSATION":
      return linkId ? `${basePath}/chat/${linkId}` : `${basePath}/chat`;
    case "ACTIVITY":
    case "WASTED_OVERALL":
      // Neither has a single-item detail screen — both live in "My
      // Activities" (Profile -> Performance History) / the Activity tab
      // respectively; route to the screen that shows it rather than a
      // route that doesn't exist.
      return linkType === "ACTIVITY" ? `${basePath}/profile/performance` : `${basePath}/activity`;
    case "LEAVE_REQUEST":
      return `${basePath}/profile/attendance`;
    case "ITEM_REPORT":
    case "PRICE_REPORT":
      // Neither has a single-item detail screen — both live in the
      // Supervisor's Home tab (SupervisorHomeTab -> ReportsSection), same
      // "route to the screen that shows it" fallback as ACTIVITY above.
      return `${basePath}/home`;
    case "CARD_SALES_MARKET":
      // Market Activities §4 — a reminder notification, linkId is the
      // market it's about (unlike the older "CARD_SALES" linkType, which
      // points at a specific report and is intentionally left unrouted
      // below). The Regional Manager who sent it lands on that market's
      // Card Sales screen; the Supervisor/Overlooking who received it
      // lands on their own Market tab, where Card Sales already lives.
      if (!linkId) return null;
      return basePath === "/rm" ? `${basePath}/markets/${linkId}/card-sales` : `${basePath}/market`;
    case "COMMUNICATION":
      // Warnings & Notifications — a real detail screen exists for this
      // one (CommunicationDetailScreen.jsx), unlike ACTIVITY/WASTED_OVERALL
      // above which route to a list because they have no single-item view.
      return linkId ? `${basePath}/communications/${linkId}` : null;
    default:
      return null;
  }
}
