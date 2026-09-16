import { prisma } from "../lib/prisma.js";
import { startOfWeek } from "../utils/period.js";

// zoneActivitiesService.js — Zone Activities (Regional Manager): a
// read-only aggregation/rollup layer over EXISTING employee activity/
// report models. This file creates no new activity system — it counts
// and lists rows that already exist, using the exact same zone-scoping
// idiom already established by activitiesController.listCompanyActivities
// and itemReportsController.listZoneItemReports.
//
// Every function here takes an already-authorized `zoneIds` (an array of
// Zone ids the caller is allowed to see, or `null` meaning "no zone
// filter" — only ever passed by an ADMIN caller with no zoneId of their
// own; see zoneActivitiesController.resolveZoneScope for where that
// authorization actually happens). This file never reads req.user and
// never decides who's allowed to ask — it only ever answers "here is
// what's true for these zones," which is what keeps the authorization
// boundary in exactly one place.
//
// --- Category mapping (see the approved plan for the full reasoning) ---
//   expired-items        -> ItemReport(condition = EXPIRED)
//   waste-reports         -> ItemReport(condition = WASTED) + WastedOverallReport (merged)
//   label-checking        -> Activity(category = LABEL_CHECKING)
//   shelf-cleaning         -> Activity(category = SHELF_CLEANING)
//   customization          -> Activity(category = PRODUCT_CUSTOMIZATION)
//   market-washing         -> Activity(category = NIGHT_SHIFT_TASK, nightShiftTaskDefinition.key = "WASHING_MARKET")
//   inventory-checking     -> Activity(category = ITEM_COUNTING)
//   product-checking       -> PriceReport
//   facing                 -> Activity(category = FACING)
//   refilling              -> Activity(category = REFILLING)
//   daily-cleaning         -> Activity(category = DAILY_CLEANING)
//   maintenance-reports    -> MarketProblem (Supervisor-submitted, not
//                             Employee-submitted — the only real "maintenance
//                             report" data that exists; see the plan)
//   department-closing     -> Activity(category = DEPARTMENT_CLOSING). Its
//                             Page 1 count (unique markets with >=1 valid
//                             record) is computed below; the full Market ->
//                             Shift -> Department -> Photo drill-down lives
//                             in the dedicated departmentClosingZoneService.js
//                             (a flat "list of records" shape, which is what
//                             every OTHER category here returns, does not
//                             fit a hierarchical drill-down — kept separate
//                             rather than forced into this registry).
//   ActivityCategory.EXPIRED_ITEMS is deliberately never read here: per
//   Frontend/src/data/workspaceData.js's own comment, it's a superseded,
//   vestigial enum value kept only for DB compatibility — the real,
//   current expired-item workflow is ItemReport, which is what
//   "expired-items" above actually reads.

// "today" is local midnight — never UTC, matching every other "today" in
// this codebase (marketsController, attendanceController, employeeStatus.js,
// itemReportsController's own periodStart). "week"/"month" reuse
// utils/period.js — the one canonical company-wide definition (Saturday-
// start week). This mirrors itemReportsController.js's local periodStart()
// exactly (same algorithm, same imported primitives) rather than editing
// that unrelated file to export it.
export function periodStart(period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") return startOfWeek(d);
  if (period === "month") {
    d.setDate(1);
    return d;
  }
  return d; // "today"
}

// zoneIds === null means "no zone filter" (ADMIN, no zoneId given —
// company-wide, matching listCompanyActivities' own ADMIN default).
export function activityZoneWhere(zoneIds) {
  if (zoneIds === null) return {};
  return { OR: [{ employee: { market: { zoneId: { in: zoneIds } } } }, { market: { zoneId: { in: zoneIds } } }] };
}

export function marketZoneWhere(zoneIds) {
  if (zoneIds === null) return {};
  return { market: { zoneId: { in: zoneIds } } };
}

const EMPLOYEE_SELECT = { id: true, name: true, profilePictureUrl: true, department: true };
const MARKET_SELECT = { id: true, name: true };

function mapEmployee(e) {
  if (!e) return null;
  return { id: e.id, name: e.name, profilePictureUrl: e.profilePictureUrl ?? null };
}

// --- Row shaping — every source maps into this one common shape, so the
// frontend never needs to know which underlying model a record came from
// to render it. Every field is either real data or explicitly null —
// nothing here is fabricated.
function mapActivityRow(a) {
  const market = a.employee?.market ?? a.market ?? null;
  return {
    id: a.id,
    source: "activity",
    category: a.category,
    employee: mapEmployee(a.employee),
    market: market ? { id: market.id, name: market.name } : null,
    department: a.employee?.department ?? a.department ?? null,
    subject: a.category === "LABEL_CHECKING" ? a.labelIssueType : null,
    notes: a.notes,
    status: a.status,
    date: a.date,
    time: a.time ?? null,
    photos: a.images.map((img) => ({ url: img.url })),
  };
}

function mapItemReportRow(r) {
  return {
    id: r.id,
    source: "itemReport",
    category: r.condition,
    employee: mapEmployee(r.employee),
    market: r.market ? { id: r.market.id, name: r.market.name } : null,
    department: r.employee?.department ?? null,
    subject: r.product?.name ? `${r.product.name} × ${r.quantity}` : null,
    notes: r.notes,
    status: r.status,
    date: r.reportedAt,
    time: null,
    photos: r.imageUrl ? [{ url: r.imageUrl }] : [],
  };
}

function mapWastedOverallRow(r) {
  return {
    id: r.id,
    source: "wastedOverallReport",
    category: "WASTED",
    employee: mapEmployee(r.employee),
    market: r.market ? { id: r.market.id, name: r.market.name } : null,
    department: r.employee?.department ?? null,
    subject: r.item === "OTHER" ? r.otherItemName : r.item,
    notes: r.notes,
    status: r.status,
    date: r.reportedAt,
    time: null,
    photos: r.photoUrl ? [{ url: r.photoUrl }] : [],
  };
}

function mapPriceReportRow(r) {
  return {
    id: r.id,
    source: "priceReport",
    category: null,
    employee: mapEmployee(r.employee),
    market: r.market ? { id: r.market.id, name: r.market.name } : null,
    department: r.employee?.department ?? null,
    subject: r.productName,
    notes: r.notes,
    status: r.status,
    date: r.reportedAt,
    time: null,
    photos: r.photoUrl ? [{ url: r.photoUrl }] : [],
  };
}

function mapMarketProblemRow(r) {
  // No employee at all — MarketProblem is Supervisor-submitted (a staff
  // User, not an Employee). Per "only show information that actually
  // exists," employee/department are honestly null here, never fabricated.
  return {
    id: r.id,
    source: "marketProblem",
    category: null,
    employee: null,
    market: r.market ? { id: r.market.id, name: r.market.name } : null,
    department: null,
    subject: r.problemType,
    notes: r.description,
    status: r.status,
    date: r.createdAt,
    time: null,
    photos: r.photoUrl ? [{ url: r.photoUrl }] : [],
  };
}

// --- Counts — one grouped query per shared table, not one query per tile ---
//
// 6 total queries answer all 12 real category counts:
//   1. Activity.groupBy(category)          -> 7 tiles at once
//   2. Activity.count(NIGHT_SHIFT_TASK + WASHING_MARKET)  -> Market Washing
//   3. ItemReport.groupBy(condition)        -> Expired Items + half of Waste Reports
//   4. WastedOverallReport.count            -> other half of Waste Reports
//   5. PriceReport.count                    -> Product Checking
//   6. MarketProblem.count                  -> Maintenance Reports
export async function getZoneActivityCounts(zoneIds, period) {
  const from = periodStart(period);

  if (zoneIds !== null && zoneIds.length === 0) {
    // An RM with no assigned zone sees an honestly empty grid, not
    // "everything" (an unfiltered query would be a real authorization
    // bug here, not just an inefficiency) and not an error.
    return {
      period,
      periodStart: from.toISOString(),
      categories: ZONE_ACTIVITY_CATEGORY_KEYS.map((key) => ({ key, count: 0 })),
    };
  }

  const activityWhere = { ...activityZoneWhere(zoneIds), date: { gte: from }, status: { not: "DRAFT" } };
  const marketWhere = marketZoneWhere(zoneIds);

  const [
    activityGroups, marketWashingCount, itemReportGroups, wastedOverallCount, priceReportCount, marketProblemCount,
    departmentClosingRows,
  ] = await Promise.all([
    prisma.activity.groupBy({ by: ["category"], where: activityWhere, _count: true }),
    prisma.activity.count({
      where: { ...activityWhere, category: "NIGHT_SHIFT_TASK", nightShiftTaskDefinition: { key: "WASHING_MARKET" } },
    }),
    prisma.itemReport.groupBy({
      by: ["condition"],
      where: { ...marketWhere, deletedAt: null, reportedAt: { gte: from } },
      _count: true,
    }),
    prisma.wastedOverallReport.count({ where: { ...marketWhere, reportedAt: { gte: from } } }),
    prisma.priceReport.count({ where: { ...marketWhere, deletedAt: null, reportedAt: { gte: from } } }),
    prisma.marketProblem.count({ where: { ...marketWhere, deletedAt: null, createdAt: { gte: from } } }),
    // Department Closing's Page 1 number is NOT a record count — it's the
    // count of DISTINCT markets with >=1 valid record (spec's own explicit
    // rule: a market with 1/3 shifts still contributes exactly +1). "Valid"
    // reuses departmentMonitoringService.js's own existing completion rule
    // (PENDING/APPROVED only — REJECTED/DRAFT are not a completed closing),
    // not the looser "not DRAFT" rule the other 12 categories use above —
    // Department Closing already has its own real completion semantics,
    // inherited here rather than reinvented. Only marketId/employee.marketId
    // is selected (no images/notes/etc — this is a lightweight existence
    // check, not the detail view).
    prisma.activity.findMany({
      where: { ...activityZoneWhere(zoneIds), category: "DEPARTMENT_CLOSING", date: { gte: from }, status: { in: ["PENDING", "APPROVED"] } },
      select: { marketId: true, employee: { select: { marketId: true } } },
    }),
  ]);

  const byActivityCategory = Object.fromEntries(activityGroups.map((g) => [g.category, g._count]));
  const byItemCondition = Object.fromEntries(itemReportGroups.map((g) => [g.condition, g._count]));
  const departmentClosingMarketCount = new Set(
    departmentClosingRows.map((r) => r.employee?.marketId ?? r.marketId)
  ).size;

  const counts = {
    "expired-items": byItemCondition.EXPIRED ?? 0,
    "waste-reports": (byItemCondition.WASTED ?? 0) + wastedOverallCount,
    "label-checking": byActivityCategory.LABEL_CHECKING ?? 0,
    "shelf-cleaning": byActivityCategory.SHELF_CLEANING ?? 0,
    customization: byActivityCategory.PRODUCT_CUSTOMIZATION ?? 0,
    "market-washing": marketWashingCount,
    "inventory-checking": byActivityCategory.ITEM_COUNTING ?? 0,
    "product-checking": priceReportCount,
    facing: byActivityCategory.FACING ?? 0,
    refilling: byActivityCategory.REFILLING ?? 0,
    "daily-cleaning": byActivityCategory.DAILY_CLEANING ?? 0,
    "maintenance-reports": marketProblemCount,
    "department-closing": departmentClosingMarketCount,
  };

  return {
    period,
    periodStart: from.toISOString(),
    categories: ZONE_ACTIVITY_CATEGORY_KEYS.map((key) => ({ key, count: counts[key] ?? 0 })),
  };
}

export const ZONE_ACTIVITY_CATEGORY_KEYS = [
  "expired-items",
  "waste-reports",
  "label-checking",
  "shelf-cleaning",
  "customization",
  "market-washing",
  "inventory-checking",
  "product-checking",
  "facing",
  "refilling",
  "daily-cleaning",
  "maintenance-reports",
  "department-closing",
];

// --- Detail list per category, all paginated identically (page/pageSize,
// default 1/25, matching listZoneItemReports' own convention exactly) ---

async function listActivityCategory(category, extraWhere, zoneIds, from, { skip, take }) {
  const where = { ...activityZoneWhere(zoneIds), date: { gte: from }, status: { not: "DRAFT" }, category, ...extraWhere };
  const [total, rows] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      include: {
        images: true,
        employee: { select: { ...EMPLOYEE_SELECT, market: { select: MARKET_SELECT } } },
        market: { select: MARKET_SELECT },
      },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
  ]);
  return { total, rows: rows.map(mapActivityRow) };
}

async function listItemReportCategory(condition, zoneIds, from, { skip, take }) {
  const where = { ...marketZoneWhere(zoneIds), deletedAt: null, reportedAt: { gte: from }, condition };
  const [total, rows] = await Promise.all([
    prisma.itemReport.count({ where }),
    prisma.itemReport.findMany({
      where,
      include: {
        employee: { select: EMPLOYEE_SELECT },
        product: { select: { id: true, name: true } },
        market: { select: MARKET_SELECT },
      },
      orderBy: { reportedAt: "desc" },
      skip,
      take,
    }),
  ]);
  return { total, rows: rows.map(mapItemReportRow) };
}

// Waste Reports merges two real tables (ItemReport WASTED + WastedOverallReport)
// into one list. `total` is always exact (a real sum of two real counts).
// The page itself is merge-paginated: fetch the `skip + take` most-recent
// rows from EACH source (bounded by page depth, not unbounded), merge-sort
// by real timestamp, then slice to exactly the requested page — this is
// the standard correct technique for merging two independently-sorted
// streams and stays exact at any realistic pagination depth; it does do
// somewhat more work than a single-table query would, which is an
// accepted, documented tradeoff for a genuinely two-table category.
async function listWasteReports(zoneIds, from, { skip, take }) {
  const itemWhere = { ...marketZoneWhere(zoneIds), deletedAt: null, reportedAt: { gte: from }, condition: "WASTED" };
  const overallWhere = { ...marketZoneWhere(zoneIds), reportedAt: { gte: from } };
  const fetchCount = skip + take;

  const [itemTotal, overallTotal, itemRows, overallRows] = await Promise.all([
    prisma.itemReport.count({ where: itemWhere }),
    prisma.wastedOverallReport.count({ where: overallWhere }),
    prisma.itemReport.findMany({
      where: itemWhere,
      include: { employee: { select: EMPLOYEE_SELECT }, product: { select: { id: true, name: true } }, market: { select: MARKET_SELECT } },
      orderBy: { reportedAt: "desc" },
      take: fetchCount,
    }),
    prisma.wastedOverallReport.findMany({
      where: overallWhere,
      include: { employee: { select: EMPLOYEE_SELECT }, market: { select: MARKET_SELECT } },
      orderBy: { reportedAt: "desc" },
      take: fetchCount,
    }),
  ]);

  const merged = [...itemRows.map(mapItemReportRow), ...overallRows.map(mapWastedOverallRow)].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return { total: itemTotal + overallTotal, rows: merged.slice(skip, skip + take) };
}

async function listPriceReports(zoneIds, from, { skip, take }) {
  const where = { ...marketZoneWhere(zoneIds), deletedAt: null, reportedAt: { gte: from } };
  const [total, rows] = await Promise.all([
    prisma.priceReport.count({ where }),
    prisma.priceReport.findMany({
      where,
      include: { employee: { select: EMPLOYEE_SELECT }, market: { select: MARKET_SELECT } },
      orderBy: { reportedAt: "desc" },
      skip,
      take,
    }),
  ]);
  return { total, rows: rows.map(mapPriceReportRow) };
}

async function listMarketProblems(zoneIds, from, { skip, take }) {
  const where = { ...marketZoneWhere(zoneIds), deletedAt: null, createdAt: { gte: from } };
  const [total, rows] = await Promise.all([
    prisma.marketProblem.count({ where }),
    prisma.marketProblem.findMany({
      where,
      include: { market: { select: MARKET_SELECT } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  return { total, rows: rows.map(mapMarketProblemRow) };
}

// The one dispatcher the controller calls — adding a future category is a
// new `case` here (plus a registry key + a counts-query addition above),
// never a rebuild of this feature.
export async function listZoneActivityCategory(key, zoneIds, period, { page, pageSize }) {
  const from = periodStart(period);
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  if (zoneIds !== null && zoneIds.length === 0) {
    return { total: 0, rows: [] };
  }

  switch (key) {
    case "expired-items":
      return listItemReportCategory("EXPIRED", zoneIds, from, { skip, take });
    case "waste-reports":
      return listWasteReports(zoneIds, from, { skip, take });
    case "label-checking":
      return listActivityCategory("LABEL_CHECKING", {}, zoneIds, from, { skip, take });
    case "shelf-cleaning":
      return listActivityCategory("SHELF_CLEANING", {}, zoneIds, from, { skip, take });
    case "customization":
      return listActivityCategory("PRODUCT_CUSTOMIZATION", {}, zoneIds, from, { skip, take });
    case "market-washing":
      return listActivityCategory(
        "NIGHT_SHIFT_TASK",
        { nightShiftTaskDefinition: { key: "WASHING_MARKET" } },
        zoneIds,
        from,
        { skip, take }
      );
    case "inventory-checking":
      return listActivityCategory("ITEM_COUNTING", {}, zoneIds, from, { skip, take });
    case "product-checking":
      return listPriceReports(zoneIds, from, { skip, take });
    case "facing":
      return listActivityCategory("FACING", {}, zoneIds, from, { skip, take });
    case "refilling":
      return listActivityCategory("REFILLING", {}, zoneIds, from, { skip, take });
    case "daily-cleaning":
      return listActivityCategory("DAILY_CLEANING", {}, zoneIds, from, { skip, take });
    case "maintenance-reports":
      return listMarketProblems(zoneIds, from, { skip, take });
    default:
      // Unreachable given the route's Zod z.enum(ZONE_ACTIVITY_CATEGORIES)
      // param check — kept as a defensive, honest empty result rather than
      // a throw, since it can only happen if that enum and this switch
      // ever drift apart.
      return { total: 0, rows: [] };
  }
}
