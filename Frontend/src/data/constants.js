// constants.js — shared vocabulary for mock data generators.
// Centralised here so Market Dashboard and Employee Profile stay consistent.

export const ROLES = [
  "Supervisor",
  "Overlooking",
  "Worker",
  "Assistant",
  "Cashier",
  "Butcher",
];

// Fixed 10-person roster every market is staffed with. "Assistant" is a
// secondary role layered onto one Worker (see generateEmployees), not a
// separate headcount slot — so this list intentionally sums to 10 primary
// roles: 1 Supervisor, 1 Storekeeper, 3 Cashiers, 2 Butchers, 3 Workers.
export const MARKET_ROSTER = [
  "Supervisor",
  "Storekeeper",
  "Cashier",
  "Cashier",
  "Cashier",
  "Butcher",
  "Butcher",
  "Worker",
  "Worker",
  "Worker",
];

export const SHIFTS = ["Morning Shift", "Afternoon Shift", "Night Shift"];

export const APPROVERS = ["Market Manager", "Supervisor"];

// Task types that require Before/After photo evidence, per spec. Other
// activity types show no photo slots at all.
export const PHOTO_REQUIRED_TYPES = ["Customization", "Shelf Cleaning", "Facing"];

export const DEPARTMENTS = [
  "Drinks",
  "Freezer",
  "Food",
  "Non Food",
  "Non Food 1",
  "Non Food 2",
  "Snacks",
  "Nuts",
  "Fresh",
  "Checkout",
];

// Floor-plan layout matching the reference map: an 8-column x 9-row grid.
// Some department types repeat (two "Non Food 1" zones, two "Snacks" zones,
// two checkout counters) because they're physically separate shelf runs —
// each gets its own id so it can be assigned/tracked independently even
// though the displayed label is the same.
// WC, Manager Office, and the Entrance strip are decorative (not clickable
// departments) — they exist for spatial realism, per the reference image.
export const DEPARTMENT_LAYOUT = [
  { id: "wc", name: "WC", col: "1 / 2", row: "1 / 2", color: "bg-black/30", interactive: false },
  { id: "entrance", name: "Entrance", col: "2 / 8", row: "1 / 2", color: "from-[#F47A20]/25 to-[#c95c10]/15", interactive: false },
  { id: "nonfood-right", name: "Non Food 1", col: "8 / 9", row: "1 / 6", color: "from-[#7C5CF4]/30 to-[#5237B8]/20", interactive: true },

  { id: "drinks", name: "Drinks", col: "1 / 2", row: "2 / 8", color: "from-[#8FE3FF]/30 to-[#5CC9E8]/20", interactive: true },
  { id: "freezer", name: "Freezer", col: "2 / 4", row: "2 / 5", color: "from-[#22D3EE]/30 to-[#0891B2]/20", interactive: true },
  { id: "food-1", name: "Food", col: "4 / 5", row: "2 / 4", color: "from-[#FBBF24]/30 to-[#D97706]/20", interactive: true },
  { id: "nonfood-thin", name: "Non Food", col: "5 / 6", row: "2 / 4", color: "from-[#6B7280]/30 to-[#374151]/20", interactive: true },
  { id: "nonfood-1a", name: "Non Food 1", col: "6 / 7", row: "2 / 4", color: "from-[#7C5CF4]/30 to-[#5237B8]/20", interactive: true },

  { id: "food-2", name: "Food", col: "4 / 5", row: "4 / 6", color: "from-[#FBBF24]/30 to-[#D97706]/20", interactive: true },
  { id: "nonfood-2", name: "Non Food 2", col: "5 / 6", row: "4 / 6", color: "from-[#4B5563]/30 to-[#1F2937]/20", interactive: true },
  { id: "nonfood-1b", name: "Non Food 1", col: "6 / 7", row: "4 / 6", color: "from-[#7C5CF4]/30 to-[#5237B8]/20", interactive: true },

  { id: "office", name: "Manager Office", col: "2 / 4", row: "6 / 7", color: "bg-black/30", interactive: false },
  { id: "snacks-1", name: "Snacks", col: "4 / 5", row: "6 / 8", color: "from-[#EF4444]/30 to-[#B91C1C]/20", interactive: true },
  { id: "snacks-2", name: "Snacks", col: "6 / 7", row: "6 / 8", color: "from-[#EF4444]/30 to-[#B91C1C]/20", interactive: true },
  { id: "nuts", name: "Nuts", col: "8 / 9", row: "6 / 9", color: "from-[#10B981]/30 to-[#047857]/20", interactive: true },

  { id: "fresh", name: "Fresh", col: "2 / 4", row: "7 / 9", color: "from-[#14B8A6]/30 to-[#0F766E]/20", interactive: true },
  { id: "cashier-1", name: "Checkout", col: "4 / 5", row: "8 / 9", color: "from-[#EC4899]/30 to-[#BE185D]/20", interactive: true },
  { id: "cashier-2", name: "Checkout", col: "6 / 7", row: "8 / 9", color: "from-[#EC4899]/30 to-[#BE185D]/20", interactive: true },
];

// Activity categories used across Today's Activities and Employee Profile.
export const ACTIVITY_TYPES = [
  "Shelf Cleaning",
  "Expired Items",
  "Checking Labels",
  "Customization",
  "Counting Items",
  "Waste Items",
  "Refilling",
  "Facing",
];

// Photo retention windows (UI-only — no real deletion/cron happens here).
export const DAILY_PHOTO_RETENTION_HOURS = 8;
export const TASK_PHOTO_RETENTION_DAYS = 30;

export const NAME_POOL = [
  "Shalaw Naji", "Ahmed Kareem", "Sara Omer", "Karwan Rasul", "Ali Hassan",
  "Diyar Saman", "Rezan Hama", "Zana Fatih", "Lawin Jamal", "Hemn Aziz",
  "Sozan Bakr", "Peshawa Latif", "Nian Rebwar", "Baxtiyar Nawroz", "Avan Karim",
  "Halgurd Salih", "Rojgar Anwar", "Chnoor Ismail", "Aram Bakhtiyar", "Snur Hawre",
];

export const STATUS_TONE = {
  Online: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  Offline: "bg-white/5 text-[#8B93A8] ring-white/10",
};

export const TASK_STATUS_TONE = {
  Completed: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  Progress: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  Pending: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  "Not Started": "bg-white/5 text-[#8B93A8] ring-white/10",
};

// Deterministic pseudo-random generator so the same employee/market always
// renders the same mock numbers (avoids UI "jumping" between re-renders).
export function seededRandom(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}
