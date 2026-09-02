// supervisorMockData.js — realistic local/mock data for the parts of
// Supervisor Mode that have no backend model yet: the market's physical
// structure/section catalog (MARKET_SECTIONS — labels/icons only; the
// actual daily report status per section is real data now, see
// DepartmentReportBoard.jsx). Chat, Zone Announcements, and Market
// Feedback (Warning/Recognition) are all entirely real now — nothing in
// Supervisor Mode reads mock notification data from this file anymore
// (the old zoneManagerNotification mock + ZoneManagerNotificationCard.jsx
// were confirmed unused and removed in the Supervisor<->Regional Manager
// connectivity fix — SupervisorHomeTab uses the real Zone Announcements
// conversation via SupervisorAnnouncementsCard.jsx instead).
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

