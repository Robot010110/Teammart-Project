// supervisorMockData.js — realistic local/mock data for the parts of
// Supervisor Mode that have no backend model yet: Zone Manager
// announcements, market physical structure/sections, daily section
// checks, market problem reports, and the Zone-Manager-facing chat
// channels (Zone Manager Group/Direct, Overlooking Direct — the Regional
// Manager module these connect to is still mock throughout this app).
// Warnings ("Management -> Employees") sends for real
// (chatService.postWarningBroadcast). Individual Employee chats are also
// real now (SUPERVISOR_DIRECT conversations — see chatController.js and
// StaffEmployeeConversationRoute.jsx), no longer backed by this file.
//
// Every function here returns a Promise, deliberately — this is the
// exact "service -> UI" shape every *real* service file in this app
// already uses (see attendanceService.js etc.), so a component calling
// `listMarketSections()` looks identical whether the data comes from
// here or a future `GET /api/markets/:id/sections` endpoint. Swapping
// this file for a real service later changes nothing about the calling
// component. Nothing here pretends to be a network call it isn't (no
// fake latency, no fabricated "real-time" claim) — it's synchronous mock
// data wrapped in Promise.resolve, plainly.

// ---------------------------------------------------------------------
// Zone Manager notification — a single most-recent high-priority
// message, shown on Home. No Zone Manager <-> Supervisor messaging
// backend exists yet (see chatController.js — every real endpoint is
// employee-only except the Warnings broadcast).
// ---------------------------------------------------------------------
let zoneManagerNotification = {
  id: "zm-note-1",
  from: "Zone Manager",
  title: "Freezer inspection required",
  body: "All markets must complete the freezer inspection before 8 PM today. Submit a photo once done.",
  read: false,
  createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
};

export function getZoneManagerNotification() {
  return Promise.resolve(zoneManagerNotification);
}

export function markZoneManagerNotificationRead() {
  zoneManagerNotification = { ...zoneManagerNotification, read: true };
  return Promise.resolve(zoneManagerNotification);
}

// ---------------------------------------------------------------------
// Market structure — physical sections. Fixed set per the reference
// architecture (Drinks, Freezer, Fresh, Food, Non-Food 1, Non-Food 2,
// Snacks, Nuts) — deliberately does NOT include a Children's Items
// section (an earlier draft spec mentioned one; the current reference
// does not). `layout` is a simple row/col grid position so the visual
// component can preserve relative placement without hardcoding pixel
// coordinates.
// ---------------------------------------------------------------------
export const MARKET_SECTIONS = [
  { key: "DRINKS", label: "Drinks", row: 1, col: 1, span: 1 },
  { key: "FREEZER", label: "Freezer", row: 1, col: 2, span: 1 },
  { key: "FRESH", label: "Fresh", row: 1, col: 3, span: 1 },
  { key: "FOOD", label: "Food", row: 2, col: 1, span: 2 },
  { key: "NON_FOOD_1", label: "Non-Food 1", row: 2, col: 3, span: 1 },
  { key: "NON_FOOD_2", label: "Non-Food 2", row: 3, col: 1, span: 1 },
  { key: "SNACKS", label: "Snacks", row: 3, col: 2, span: 1 },
  { key: "NUTS", label: "Nuts", row: 3, col: 3, span: 1 },
];

// ---------------------------------------------------------------------
// Daily section checks — Supervisor-side monitoring, per calendar day.
// Keyed by "<sectionKey>:<YYYY-MM-DD>" so re-checking the same section
// twice in one day just overwrites the earlier submission (matches how
// AttendanceRecord/CashierCleaningLog upsert per-day elsewhere in this
// app).
// ---------------------------------------------------------------------
const sectionChecks = new Map();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function listTodaySectionChecks() {
  const date = todayKey();
  const result = MARKET_SECTIONS.map((section) => sectionChecks.get(`${section.key}:${date}`) ?? {
    sectionKey: section.key,
    date,
    checked: false,
    photoUrl: null,
    notes: null,
    checkedAt: null,
  });
  return Promise.resolve(result);
}

export function submitSectionCheck({ sectionKey, photoUrl, notes }) {
  const date = todayKey();
  const record = { sectionKey, date, checked: true, photoUrl: photoUrl ?? null, notes: notes ?? null, checkedAt: new Date().toISOString() };
  sectionChecks.set(`${sectionKey}:${date}`, record);
  return Promise.resolve(record);
}

// ---------------------------------------------------------------------
// Reports & Problems — physical/technical market issues.
// ---------------------------------------------------------------------
export const PROBLEM_TYPES = [
  "Freezer not working",
  "Electricity problem",
  "Computer not working",
  "Cashier monitor not working",
  "Door broken",
  "Equipment problem",
  "Internet/network problem",
  "Other market problem",
];

let problems = [
  {
    id: "prob-1",
    problemType: "Freezer not working",
    location: "Freezer section",
    description: "Freezer #2 is not cooling below 4°C.",
    status: "OPEN",
    photoUrl: null,
    reporterName: "Supervisor",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
];

export function listMarketProblems() {
  return Promise.resolve([...problems].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
}

export function createMarketProblem({ problemType, location, description, photoUrl, reporterName }) {
  const problem = {
    id: `prob-${Date.now()}`,
    problemType,
    location,
    description,
    photoUrl: photoUrl ?? null,
    status: "OPEN",
    reporterName,
    createdAt: new Date().toISOString(),
  };
  problems = [problem, ...problems];
  return Promise.resolve(problem);
}

export function updateMarketProblemStatus(id, status) {
  problems = problems.map((p) => (p.id === id ? { ...p, status } : p));
  return Promise.resolve(problems.find((p) => p.id === id));
}

// ---------------------------------------------------------------------
// Chat — the remaining channel types with no backend messaging model yet
// (Zone Manager Group, Zone Manager Direct, Supervisor<->Overlooking —
// all Regional-Manager-module-facing, still mock throughout this app;
// Market Employee Group read-back is also still local-only here, since
// there's no dedicated screen for it yet). Warnings/"Management ->
// Employees" sending is real (chatService.postWarningBroadcast); its
// local history here is just what THIS session has sent, since there's
// no staff read-back for it specifically.
//
// Same Conversation shape as the spec asks for:
// { type, title, participants, lastMessage, unreadCount, messages }
// ---------------------------------------------------------------------
const now = Date.now();
const mockConversations = {
  "zone-manager-group": {
    id: "zone-manager-group",
    type: "ZONE_MANAGER_GROUP",
    title: "Zone Manager Group",
    participants: ["Zone Manager", "Supervisors", "Overlookings"],
    unreadCount: 1,
    messages: [
      { id: "m1", from: "Zone Manager", body: "All markets must complete the freezer inspection before 8 PM.", createdAt: new Date(now - 3600_000).toISOString(), fromMe: false },
    ],
  },
  "market-group": {
    id: "market-group",
    type: "MARKET_GROUP",
    title: "Market Employee Group",
    participants: ["Everyone in this market"],
    unreadCount: 0,
    messages: [
      { id: "m1", from: "Ahmed", body: "Trash taken out, shelf cleaning done for aisle 3.", createdAt: new Date(now - 7200_000).toISOString(), fromMe: false },
    ],
  },
  "warnings": {
    id: "warnings",
    type: "WARNINGS",
    title: "Management → Employees",
    participants: ["Supervisor", "Overlooking", "Employees"],
    unreadCount: 0,
    messages: [],
  },
  "zone-manager-direct": {
    id: "zone-manager-direct",
    type: "ZONE_MANAGER_DIRECT",
    title: "Zone Manager",
    participants: ["Zone Manager"],
    unreadCount: 0,
    messages: [
      { id: "m1", from: "Zone Manager", body: "Can you confirm the delivery arrived this morning?", createdAt: new Date(now - 5400_000).toISOString(), fromMe: false },
    ],
  },
  "overlooking-direct": {
    id: "overlooking-direct",
    type: "OVERLOOKING_DIRECT",
    title: "Overlooking",
    participants: ["Overlooking"],
    unreadCount: 0,
    messages: [
      { id: "m1", from: "Overlooking", body: "Heads up — cashier register 2 was short at close, flagged it.", createdAt: new Date(now - 10_000_000).toISOString(), fromMe: false },
    ],
  },
};

export function listMockConversations() {
  return Promise.resolve(Object.values(mockConversations));
}

export function getMockConversation(id) {
  return Promise.resolve(mockConversations[id] ?? null);
}

export function sendMockMessage(conversationId, body) {
  const convo = mockConversations[conversationId];
  if (!convo) return Promise.reject(new Error("Conversation not found"));
  const message = { id: `m-${Date.now()}`, from: "Me", body, createdAt: new Date().toISOString(), fromMe: true };
  convo.messages = [...convo.messages, message];
  convo.unreadCount = 0;
  return Promise.resolve(message);
}
