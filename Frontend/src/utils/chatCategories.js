// chatCategories.js — Chat UI redesign: the ONE place GROUP_TYPES/
// INDIVIDUAL_TYPES/category logic lives, reconciling three previously
// slightly-different copies (ChatViewTabs.jsx, RmChatPage.jsx,
// ChatConversationCard.jsx each had their own GROUP_TYPES set). Mirrors
// chatController.js's own categoryOf exactly, so the Groups tab's four
// sections (Zone/Announcements/General/Task & Operations) can never
// disagree with what the backend already computed and sent down on
// `conversation.category`.
export const GROUP_TYPES = new Set(["MARKET_GROUP", "WARNINGS", "ZONE_GROUP", "ZONE_ANNOUNCEMENTS", "CUSTOM_GROUP"]);
export const INDIVIDUAL_TYPES = new Set(["DIRECT", "SUPERVISOR_DIRECT", "RM_DIRECT", "STAFF_DIRECT"]);
export const ANNOUNCEMENT_TYPES = new Set(["WARNINGS", "ZONE_ANNOUNCEMENTS"]);

export const GROUP_CATEGORIES = [
  { key: "zone", label: "Zone" },
  { key: "announcements", label: "Announcements" },
  { key: "general", label: "General" },
  { key: "tasks", label: "Task & Operations" },
];

// Backend already computes and sends `conversation.category` (see
// chatController.js's categoryOf) on every conversation-list shape —
// this is only a fallback for any conversation object that predates that
// field reaching the frontend cache, never the primary source of truth.
export function categoryOf(conversation) {
  if (conversation.category) return conversation.category;
  if (conversation.type === "ZONE_GROUP") return "zone";
  if (ANNOUNCEMENT_TYPES.has(conversation.type) || conversation.groupType === "WARNING") return "announcements";
  return "general";
}
