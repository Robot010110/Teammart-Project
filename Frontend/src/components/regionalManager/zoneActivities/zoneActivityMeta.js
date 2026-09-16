import {
  PackageX, Trash2, Tags, Sparkles, Palette, Droplets, ClipboardList,
  BadgeDollarSign, Rows3, PackagePlus, SprayCan, Wrench, DoorClosed,
} from "lucide-react";

// zoneActivityMeta.js — the ONE client-side mapping from a Zone Activities
// category key (see backend zoneActivitiesService.js's own registry) to
// how it reads on screen: icon, tone (one of AdminKpiCard's existing
// tones — no new color system), label, and the exact empty-state copy
// for each period. The backend never sends labels/icons — it only ever
// returns real counts/records — matching every other category-meta file
// already in this app (itemReportMeta.js, activityMeta.js).
//
// "department-closing" is included here for its label/icon (so the grid
// tile renders) — its count comes from the same /counts endpoint as every
// other tile (the unique-market count computed in zoneActivitiesService.js),
// but tapping it navigates to its own dedicated Market -> Shift ->
// Department -> Photo drill-down (RmDepartmentClosingMarketsPage.jsx),
// never the generic flat category list every other tile uses — see
// RmZoneActivitiesPage.jsx's openTile().
// `empty` is the exact noun phrase that slots into the one shared
// rm.zaEmptyState template ("No {{subject}} {{period}}.") — matching the
// spec's own examples ("No expired items reported today.", "No shelf-
// cleaning activity this week.", "No maintenance reports this month.")
// via one translated sentence shape instead of 36 hand-written variants.
// `desc` — a short one-line supporting description shown under the count
// on each redesigned category card (see ZoneActivityCategoryCard.jsx).
// Purely presentational copy, same as `label`/`empty` — never sent by or
// derived from the backend.
export const ZONE_ACTIVITY_CATEGORY_META = {
  "expired-items": { label: "rm.zaExpiredItems", icon: PackageX, tone: "amber", empty: "rm.zaEmptyExpiredItems", desc: "rm.zaDescExpiredItems" },
  "waste-reports": { label: "rm.zaWasteReports", icon: Trash2, tone: "red", empty: "rm.zaEmptyWasteReports", desc: "rm.zaDescWasteReports" },
  "label-checking": { label: "rm.zaLabelChecking", icon: Tags, tone: "purple", empty: "rm.zaEmptyLabelChecking", desc: "rm.zaDescLabelChecking" },
  "shelf-cleaning": { label: "rm.zaShelfCleaning", icon: Sparkles, tone: "blue", empty: "rm.zaEmptyShelfCleaning", desc: "rm.zaDescShelfCleaning" },
  customization: { label: "rm.zaCustomization", icon: Palette, tone: "green", empty: "rm.zaEmptyCustomization", desc: "rm.zaDescCustomization" },
  "market-washing": { label: "rm.zaMarketWashing", icon: Droplets, tone: "blue", empty: "rm.zaEmptyMarketWashing", desc: "rm.zaDescMarketWashing" },
  "inventory-checking": { label: "rm.zaInventoryChecking", icon: ClipboardList, tone: "purple", empty: "rm.zaEmptyInventoryChecking", desc: "rm.zaDescInventoryChecking" },
  "product-checking": { label: "rm.zaProductChecking", icon: BadgeDollarSign, tone: "amber", empty: "rm.zaEmptyProductChecking", desc: "rm.zaDescProductChecking" },
  facing: { label: "rm.zaFacing", icon: Rows3, tone: "green", empty: "rm.zaEmptyFacing", desc: "rm.zaDescFacing" },
  refilling: { label: "rm.zaRefilling", icon: PackagePlus, tone: "blue", empty: "rm.zaEmptyRefilling", desc: "rm.zaDescRefilling" },
  "daily-cleaning": { label: "rm.zaDailyCleaning", icon: SprayCan, tone: "green", empty: "rm.zaEmptyDailyCleaning", desc: "rm.zaDescDailyCleaning" },
  "maintenance-reports": { label: "rm.zaMaintenanceReports", icon: Wrench, tone: "red", empty: "rm.zaEmptyMaintenanceReports", desc: "rm.zaDescMaintenanceReports" },
  "department-closing": { label: "rm.zaDepartmentClosing", icon: DoorClosed, tone: "purple", desc: "rm.zaDescDepartmentClosing" },
};

// The period half of the shared empty-state sentence — "today" / "this
// week" / "this month", reusing the exact same three existing
// translation keys the period pills themselves already use.
export const ZONE_ACTIVITY_EMPTY_PERIOD_KEY = { today: "common.today", week: "emp.thisWeek", month: "emp.thisMonth" };

export const ZONE_ACTIVITY_TILE_ORDER = [
  "expired-items", "waste-reports", "label-checking", "shelf-cleaning",
  "customization", "market-washing", "inventory-checking", "product-checking",
  "facing", "refilling", "daily-cleaning", "maintenance-reports", "department-closing",
];

// Status chip across every source this feature reads — ActivityStatus
// (PENDING/APPROVED/REJECTED/DRAFT, shared by Activity/ItemReport/
// PriceReport/WastedOverallReport) and MarketProblemStatus (OPEN/
// IN_PROGRESS/RESOLVED, its own real enum) — one lookup covers both since
// the values never collide.
export const ZONE_ACTIVITY_STATUS_META = {
  PENDING: { label: "emp.pendingReview", chip: "bg-white/[0.06] text-[#9AA1B4] ring-white/10" },
  APPROVED: { label: "status.approved", chip: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/25" },
  REJECTED: { label: "status.rejected", chip: "bg-red-500/12 text-red-400 ring-red-500/25" },
  DRAFT: { label: "status.draft", chip: "bg-white/[0.06] text-[#8B93A8] ring-white/10" },
  OPEN: { label: "rm.zaOpen", chip: "bg-amber-500/12 text-amber-400 ring-amber-500/25" },
  IN_PROGRESS: { label: "rm.zaInProgress", chip: "bg-sky-500/12 text-sky-400 ring-sky-500/25" },
  RESOLVED: { label: "status.approved", chip: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/25" },
};

export function zoneActivityCategoryMeta(key) {
  return ZONE_ACTIVITY_CATEGORY_META[key] ?? null;
}

export function zoneActivityStatusMeta(status) {
  return ZONE_ACTIVITY_STATUS_META[status] ?? null;
}

export function initialsOfName(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Same relative-then-absolute shape as itemReportMeta.js's reportTimeLabel
// — kept identical rather than reinvented, so a record reads the same way
// whether it's opened from Zone Activities or the Expired Items page.
export function zoneActivityTimeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (isSameDay(d, now)) return `Today · ${time}`;
  if (isSameDay(d, yesterday)) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}
