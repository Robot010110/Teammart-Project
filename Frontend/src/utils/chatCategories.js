// chatCategories.js — Chat UI redesign: the ONE place GROUP_TYPES/
// INDIVIDUAL_TYPES/category logic lives, reconciling three previously
// slightly-different copies (ChatViewTabs.jsx, RmChatPage.jsx,
// ChatConversationCard.jsx each had their own GROUP_TYPES set). Mirrors
// chatController.js's own categoryOf exactly, so the Groups tab's four
// sections (Zone/Announcements/General/Task & Operations) can never
// disagree with what the backend already computed and sent down on
// `conversation.category`.
export const GROUP_TYPES = new Set(["MARKET_GROUP", "WARNINGS", "KOCH_OPERATION", "ZONE_GROUP", "ZONE_ANNOUNCEMENTS", "CUSTOM_GROUP"]);
export const INDIVIDUAL_TYPES = new Set(["DIRECT", "SUPERVISOR_DIRECT", "RM_DIRECT", "STAFF_DIRECT"]);
export const ANNOUNCEMENT_TYPES = new Set(["WARNINGS", "ZONE_ANNOUNCEMENTS"]);

// The SYSTEM channels whose title the backend generates from the
// conversation type rather than from anything a person named (see
// chatController.js's title ternary). Those arrive as fixed English, so
// they're re-derived here from the same `type` to render in the reader's
// language. Every other type's title is a real name — a person, or a
// group someone named — and is shown exactly as stored.
const SYSTEM_CHANNEL_TITLE = {
  MARKET_GROUP: "sup.marketGroup",
  WARNINGS: "sup.warnings",
  KOCH_OPERATION: "emp.kochOperation",
  ZONE_GROUP: "sup.zoneGroup",
  ZONE_ANNOUNCEMENTS: "sup.zoneAnnouncements",
};

export function conversationTitle(conversation, t) {
  const key = SYSTEM_CHANNEL_TITLE[conversation?.type];
  return key ? t(key) : conversation?.title;
}

// Labels are translation KEYS, not display text — this file is plain
// data shared by every role's Chat screen (module scope, no access to
// `t`), so each caller resolves the key with t() at render time. Same
// pattern as data/auth.js's ROLE_OPTIONS.
export const GROUP_CATEGORIES = [
  { key: "zone", label: "emp.catZone" },
  { key: "announcements", label: "emp.catAnnouncements" },
  { key: "general", label: "emp.catGeneral" },
  { key: "tasks", label: "emp.catTaskOperations" },
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
