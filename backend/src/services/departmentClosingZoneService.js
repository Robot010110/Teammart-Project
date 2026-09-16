import { prisma } from "../lib/prisma.js";
import { periodStart, activityZoneWhere } from "./zoneActivitiesService.js";
import { startOfWeek } from "../utils/period.js";
import { DEPARTMENTS } from "../utils/departments.js";

// departmentClosingZoneService.js — Zone Activities' Department Closing
// drill-down: Market -> Shift -> Department -> Photo Evidence.
//
// Source of truth, unchanged: the exact same `Activity` rows with
// `category = "DEPARTMENT_CLOSING"` that the employee's own submission
// flow (DepartmentClosingFlow.jsx) and the Supervisor's existing
// Department Report board (departmentMonitoringService.js) already read
// and write. This file adds NO new model, NO new column, and does not
// touch departmentMonitoringService.js — that file's own Supervisor-
// facing, single-day, single-market view is untouched and still the
// source of truth this file's completion rule is deliberately copied
// from (PENDING/APPROVED = completed; DRAFT/REJECTED are not).
//
// --- The one real data-model gap, and the decision made about it -------
// Activity has NO shift field of any kind (verified directly against the
// schema and the employee submission flow — no shift is ever collected
// or stored on a Department Closing row). The application's canonical
// three-shift concept (MORNING/AFTERNOON/NIGHT, EmployeeShift — see the
// Shift System Cleanup) DOES already exist on Employee.shift/
// cashierShift, though: every employee who can submit a Department
// Closing already has their own real, currently-assigned shift on their
// profile. This file derives each record's shift from ITS SUBMITTING
// EMPLOYEE'S OWN profile shift (shiftOf() below) rather than inventing a
// per-submission shift field or guessing from a time-of-day heuristic —
// this is real, existing data, not a fabricated value, matching the same
// "shift at time of reporting" precedent PriceReport.shift already
// establishes elsewhere in this app for a different report type.
// Documented limitation: since Employee.shift is the employee's CURRENT
// assignment (not a historical snapshot at submission time), a record
// submitted before the employee's shift assignment last changed will be
// attributed to their current shift, not necessarily the one they were
// actually working that day. See this feature's final report.
//
// A staff-submitted "unassigned department" row (Activity.employeeId
// null — see Activity's own schema comment) has no employee and
// therefore no shift to derive; such rows are excluded from every
// shift/day bucket below (never make a shift falsely "Completed"), never
// silently misattributed to one of the three shifts.

const SHIFTS = ["MORNING", "AFTERNOON", "NIGHT"];
export const DEPARTMENT_CLOSING_SHIFTS = SHIFTS;

function dayOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date) {
  return dayOnly(date).toISOString().slice(0, 10);
}

// How many distinct calendar days are "in scope" for the period so far —
// the denominator for "X / Y Shifts Completed" (day is always exactly 1;
// week/month grow as the period progresses, never counting days that
// haven't happened yet).
function daysElapsedInPeriod(period) {
  const today = dayOnly(new Date());
  if (period === "week") {
    const start = startOfWeek(today);
    return Math.floor((today - start) / 86400000) + 1;
  }
  if (period === "month") {
    return today.getDate();
  }
  return 1;
}

// Every real calendar day in the period, today first (descending) — used
// so Page 3 can represent a day with zero records as an honest 0/3
// instead of silently omitting it (spec: "do not hide it merely because
// it has no records").
function enumerateDayKeys(period) {
  const today = dayOnly(new Date());
  const from = periodStart(period);
  const keys = [];
  for (let d = new Date(today); d >= from; d.setDate(d.getDate() - 1)) {
    keys.push(dayKey(d));
  }
  return keys;
}

function shiftOf(row) {
  return row.employee?.shift ?? row.employee?.cashierShift ?? null;
}

// A shift is "Completed" only when EVERY one of the market's active,
// configured departments has at least one valid (PENDING/APPROVED)
// submission for it that shift/day — mirrors
// departmentMonitoringService.getMarketDepartmentCompletion's own
// `requiredCount > 0 && completed === requiredCount` rule exactly. A
// market with zero configured departments is never "Completed" (nothing
// to auto-complete against), same as that existing function.
function isShiftComplete(departmentSet, requiredDepartmentNames) {
  if (!requiredDepartmentNames.length) return false;
  return requiredDepartmentNames.every((name) => departmentSet?.has(name));
}

// Lightweight existence-only fetch (no images/notes) for aggregation —
// the full per-record detail is only ever fetched for ONE shift/date at a
// time, in getDepartmentClosingShiftDetail below.
async function fetchValidRows({ zoneIds = null, marketId = null, from }) {
  const scope = marketId
    ? { OR: [{ employee: { marketId } }, { marketId }] }
    : activityZoneWhere(zoneIds);
  return prisma.activity.findMany({
    where: { category: "DEPARTMENT_CLOSING", status: { in: ["PENDING", "APPROVED"] }, date: { gte: from }, ...scope },
    select: { date: true, department: true, marketId: true, employee: { select: { marketId: true, shift: true, cashierShift: true } } },
  });
}

// marketId -> dayKey -> shift -> Set(department names with a valid submission)
function groupRows(rows) {
  const byMarket = new Map();
  for (const row of rows) {
    const marketId = row.employee?.marketId ?? row.marketId;
    const shift = shiftOf(row);
    if (!marketId || !shift) continue; // unattributable — excluded, see file header
    const dKey = dayKey(row.date);
    if (!byMarket.has(marketId)) byMarket.set(marketId, new Map());
    const byDay = byMarket.get(marketId);
    if (!byDay.has(dKey)) byDay.set(dKey, new Map());
    const byShift = byDay.get(dKey);
    if (!byShift.has(shift)) byShift.set(shift, new Set());
    byShift.get(shift).add(row.department);
  }
  return byMarket;
}

// PAGE 2 — every authorized market with its Department Closing shift
// completion, INCLUDING markets with zero records (0/Y — never hidden).
// One market query, one department-catalog query, one activity query for
// the WHOLE zone — no per-market loop, no N+1.
export async function listDepartmentClosingMarkets(zoneIds, period) {
  const from = periodStart(period);
  const totalShifts = daysElapsedInPeriod(period) * SHIFTS.length;

  if (zoneIds !== null && zoneIds.length === 0) {
    return { period, expectedShiftsPerDay: SHIFTS.length, totalShifts, markets: [] };
  }

  const marketWhere = zoneIds === null ? {} : { zoneId: { in: zoneIds } };
  const [markets, deptRows, rows] = await Promise.all([
    prisma.market.findMany({ where: marketWhere, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.marketDepartment.findMany({ where: { active: true, market: marketWhere }, select: { marketId: true, name: true } }),
    fetchValidRows({ zoneIds, from }),
  ]);

  const deptsByMarket = new Map();
  for (const d of deptRows) {
    if (!deptsByMarket.has(d.marketId)) deptsByMarket.set(d.marketId, []);
    deptsByMarket.get(d.marketId).push(d.name);
  }
  const byMarket = groupRows(rows);

  const marketsOut = markets.map((m) => {
    const requiredDepts = deptsByMarket.get(m.id) ?? [];
    const byDay = byMarket.get(m.id) ?? new Map();
    let completedShifts = 0;
    for (const byShift of byDay.values()) {
      for (const shift of SHIFTS) {
        if (isShiftComplete(byShift.get(shift), requiredDepts)) completedShifts++;
      }
    }
    return { marketId: m.id, marketName: m.name, completedShifts, totalShifts };
  });

  return { period, expectedShiftsPerDay: SHIFTS.length, totalShifts, markets: marketsOut };
}

// PAGE 3 — one market's full day-by-day, shift-by-shift completion.
// Every real calendar day in the period is represented (even all-zero
// ones); for `period=day` this is always exactly one day, matching the
// spec's simple "X / 3 Shifts Completed" example directly.
export async function getDepartmentClosingMarketDetail(marketId, period) {
  const from = periodStart(period);
  const [market, deptRows, rows] = await Promise.all([
    prisma.market.findUnique({ where: { id: marketId }, select: { id: true, name: true } }),
    prisma.marketDepartment.findMany({ where: { marketId, active: true }, select: { name: true } }),
    fetchValidRows({ marketId, from }),
  ]);
  if (!market) return null;

  const requiredDepts = deptRows.map((d) => d.name);
  const byDay = groupRows(rows).get(marketId) ?? new Map();

  const days = enumerateDayKeys(period).map((dKey) => {
    const byShift = byDay.get(dKey) ?? new Map();
    const shifts = SHIFTS.map((shift) => {
      const depts = byShift.get(shift);
      return { shift, completed: isShiftComplete(depts, requiredDepts), recordCount: depts?.size ?? 0 };
    });
    return { date: dKey, completedShifts: shifts.filter((s) => s.completed).length, totalShifts: SHIFTS.length, shifts };
  });

  const completedShifts = days.reduce((sum, d) => sum + d.completedShifts, 0);
  return { marketId: market.id, marketName: market.name, period, completedShifts, totalShifts: days.length * SHIFTS.length, days };
}

function shapeRecord(a) {
  return {
    id: a.id,
    status: a.status,
    notes: a.notes,
    date: a.date,
    time: a.time,
    createdAt: a.createdAt,
    submittedBy: a.submittedByStaff
      ? { kind: "staff", id: a.submittedByStaff.id, name: a.submittedByStaff.name }
      : a.employee
        ? { kind: "employee", id: a.employee.id, name: a.employee.name, profilePictureUrl: a.employee.profilePictureUrl }
        : null,
    // Expired photos (16h retention — see activitiesController's
    // DEPARTMENT_CLOSING_PHOTO_RETENTION_MS) keep their row so the
    // frontend can honestly render "photo expired" rather than a broken
    // image link, same convention as departmentMonitoringService's own
    // `photoAvailable`/`photoExpired` split.
    photos: a.images.map((img) => ({ id: img.id, url: img.expiredAt ? null : img.url, expired: !!img.expiredAt })),
  };
}

// PAGE 4 / "Show All" — every department's latest valid record for one
// specific market + date + shift (never merges different dates/shifts).
// Canonical DEPARTMENTS order first, then any other real department name
// this market actually has (configured-but-noncanonical, or present only
// via a submission) — nothing is silently dropped.
export async function getDepartmentClosingShiftDetail(marketId, dateKey, shift) {
  if (!SHIFTS.includes(shift)) return null;
  const dayStart = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) return null;
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [market, deptRows, rows] = await Promise.all([
    prisma.market.findUnique({ where: { id: marketId }, select: { id: true, name: true } }),
    prisma.marketDepartment.findMany({ where: { marketId, active: true }, select: { name: true } }),
    prisma.activity.findMany({
      where: {
        category: "DEPARTMENT_CLOSING",
        status: { in: ["PENDING", "APPROVED"] },
        date: { gte: dayStart, lt: dayEnd },
        OR: [{ employee: { marketId } }, { marketId }],
      },
      include: {
        images: true,
        employee: { select: { id: true, name: true, profilePictureUrl: true, shift: true, cashierShift: true } },
        submittedByStaff: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!market) return null;

  // Newest-first already (orderBy createdAt desc) — first match per
  // department wins, same "latest submission" rule
  // departmentMonitoringService.getMarketDepartmentStatus already uses.
  const latestByDept = new Map();
  for (const row of rows) {
    if (shiftOf(row) !== shift) continue;
    if (!latestByDept.has(row.department)) latestByDept.set(row.department, row);
  }

  const marketDeptNames = new Set(deptRows.map((d) => d.name));
  const allRelevantNames = new Set([...marketDeptNames, ...latestByDept.keys()]);
  const orderedNames = [
    ...DEPARTMENTS.filter((d) => allRelevantNames.has(d)),
    ...[...allRelevantNames].filter((d) => !DEPARTMENTS.includes(d)).sort(),
  ];

  const departments = orderedNames.map((name) => ({
    department: name,
    record: latestByDept.has(name) ? shapeRecord(latestByDept.get(name)) : null,
  }));

  return { marketId: market.id, marketName: market.name, date: dateKey, shift, departments };
}
