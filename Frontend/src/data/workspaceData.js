// workspaceData.js — static configuration for the Employee Workspace's
// "Daily Activities" grid: one entry per ActivityCategory the backend
// accepts (see backend/prisma/schema.prisma). This is NOT mock data —
// nothing here is fake/random, it's just the fixed list of buttons shown
// on screen, the same way a page title is "static" rather than "mock".
//
// The previous version of this file listed 8 options (Facing, Refilling,
// Department Photo, Waste Items, Shelf Cleaning, Checking Labels,
// Counting Items, Customization) copied from the old Task model. The new
// Activity model's category enum only has 6 values, and they don't map
// 1:1 to the old list (no "Facing"/"Refilling"/"Department Photo" on the
// backend, but it does have "Daily Cleaning" which the old list didn't).
// This list was updated to match exactly what the backend will accept —
// otherwise submitting would fail validation for half these buttons.
//
// EXPIRED_ITEMS is deliberately NOT listed here anymore — it's been
// superseded by the dedicated Expired/Wasted Items module
// (ItemReportSection.jsx, backed by the ItemReport model), which needs a
// product link + quantity + automatic stock decrement that this simple
// notes+photo Activity flow was never built for. The enum value stays in
// the backend for DB compatibility; it's just not offered here anymore.
export const ACTIVITY_SUBMISSION_OPTIONS = [
  { category: "SHELF_CLEANING", label: "Report Shelf Cleaning" },
  { category: "PRODUCT_CUSTOMIZATION", label: "Submit Product Customization" },
  { category: "DAILY_CLEANING", label: "Report Daily Cleaning" },
  { category: "ITEM_COUNTING", label: "Report Item Counting" },
  { category: "LABEL_CHECKING", label: "Report Label Checking" },
];

// Human-readable label for a category code, used anywhere an Activity is
// displayed (history list, edit form) rather than just the submission grid.
export const CATEGORY_LABELS = ACTIVITY_SUBMISSION_OPTIONS.reduce((map, o) => {
  map[o.category] = o.label;
  return map;
}, {});

// CLEANING_CHECKLIST_ITEMS — the fixed cashier-station cleaning checklist
// (Cashier role, Morning shift only — see CashierCleaningSection.jsx).
// Always "clean the cashier station" — deliberately NOT shelf/aisle/
// department cleaning, which is what ACTIVITY_SUBMISSION_OPTIONS above
// covers for Workers. A fixed list, same "static config, not mock data"
// reasoning as ACTIVITY_SUBMISSION_OPTIONS.
export const CLEANING_CHECKLIST_ITEMS = [
  "Wipe down the counter",
  "Clean the barcode scanner",
  "Sanitize the card reader / PIN pad",
  "Clean the touchscreen / monitor",
  "Empty the trash bin",
  "Restock receipt paper",
];
