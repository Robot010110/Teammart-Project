import { zones } from "./mockData";
import {
  MARKET_ROSTER, SHIFTS, DEPARTMENT_LAYOUT, NAME_POOL, DAILY_PHOTO_RETENTION_HOURS,
  seededRandom, pick,
} from "./constants";

// marketData.js — derives rich per-market mock data (employees, floor plan,
// today's activities, storage capacity) from the lightweight zone/market
// records in mockData.js. Everything is seeded off the market id so it's
// stable across renders.

export function findMarket(marketId) {
  for (const zone of zones) {
    const market = zone.markets.find((m) => m.id === marketId);
    if (market) return { market, zone };
  }
  return null;
}

// Every market is staffed with a fixed 10-person roster: 1 Supervisor,
// 1 Storekeeper, 3 Cashiers, 2 Butchers, 3 Workers. One Worker also carries
// a secondary "Assistant" role (two roles, one headcount slot).
export function generateEmployees(marketId) {
  const rand = seededRandom(marketId + "-employees");
  const workerIndices = MARKET_ROSTER.reduce((acc, role, i) => (role === "Worker" ? [...acc, i] : acc), []);
  const assistantSlot = pick(rand, workerIndices);

  return MARKET_ROSTER.map((role, i) => {
    const name = NAME_POOL[(Math.floor(rand() * NAME_POOL.length) + i) % NAME_POOL.length];
    const secondaryRole = i === assistantSlot ? "Assistant" : null;
    return {
      id: `${marketId}-emp-${i + 1}`,
      marketId,
      name,
      role,
      secondaryRole,
      displayRole: secondaryRole ? `${role} · ${secondaryRole}` : role,
      shift: pick(rand, SHIFTS),
      status: rand() > 0.35 ? "Online" : "Offline",
      initials: name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
      employeeCode: `TM-${(1000 + i * 7 + marketId.length).toString().slice(-4)}`,
    };
  });
}

const DEPT_ACTIVITY_TEMPLATES = [
  (rand) => ({ label: "Expired products removed", value: Math.floor(rand() * 6) + 1 }),
  (rand) => ({ label: "Labels checked", value: Math.floor(rand() * 20) + 5 }),
  (rand) => ({ label: "Shelves refilled", value: Math.floor(rand() * 4) + 1 }),
  (rand) => ({ label: "Cleaning completed", value: "Yes" }),
  (rand) => ({ label: "Items facing-corrected", value: Math.floor(rand() * 30) + 10 }),
];

export function generateDepartments(marketId, employees) {
  const rand = seededRandom(marketId + "-departments");
  return DEPARTMENT_LAYOUT.map((dept) => {
    if (!dept.interactive) return { ...dept };
    const assigned = employees.length ? pick(rand, employees) : null;
    // The person who actually completed the last task isn't always the
    // person assigned to the department — someone might have helped out.
    const performer = employees.length ? pick(rand, employees) : null;
    const hoursAgo = Math.floor(rand() * 7) + 1; // photo uploaded 1-7h ago
    return {
      ...dept,
      assignedTo: assigned?.name || "Unassigned",
      lastCompletedBy: performer?.name || "Unassigned",
      recentActivity: DEPT_ACTIVITY_TEMPLATES.map((tpl) => tpl(rand)),
      photoUploadedHoursAgo: hoursAgo,
      photoExpiresInHours: Math.max(DAILY_PHOTO_RETENTION_HOURS - hoursAgo, 0),
    };
  });
}

export function generateTodayActivities(marketId) {
  const rand = seededRandom(marketId + "-today");
  const wastedStatus = pick(rand, ["Completed", "Pending", "Not Started"]);
  return {
    wastedItems: {
      status: wastedStatus,
      itemsReported: wastedStatus === "Not Started" ? 0 : Math.floor(rand() * 9) + 1,
    },
    refilling: {
      status: pick(rand, ["Completed", "Progress"]),
      progress: Math.floor(rand() * 40) + 60,
      picturesUploaded: Math.floor(rand() * 12) + 4,
      completionTime: `${6 + Math.floor(rand() * 3)}:${pick(rand, ["10", "25", "40"])} AM`,
    },
    facing: {
      morning: pick(rand, ["Completed", "Pending"]),
      afternoon: pick(rand, ["Completed", "Pending", "Not Started"]),
      evening: pick(rand, ["Pending", "Not Started"]),
    },
    cleaning: {
      status: pick(rand, ["Completed", "Pending"]),
      time: "11:40 PM",
      picturesUploaded: Math.floor(rand() * 10) + 3,
    },
    dayOverview: [
      { time: "08:12", text: "Ahmed removed expired products" },
      { time: "09:45", text: "Sara checked labels in Snacks" },
      { time: "12:30", text: "Karwan cleaned shelves in Fresh" },
      { time: "15:05", text: "Ali customized the Drinks section" },
      { time: "17:20", text: "Diyar refilled Non Food 1" },
    ],
  };
}

export function generateCartonCapacity(marketId) {
  const rand = seededRandom(marketId + "-capacity");
  const capacity = 220;
  const used = Math.floor(rand() * capacity * 0.85) + 30;
  const percent = Math.round((used / capacity) * 100);
  const status = percent >= 100 ? "Full" : percent >= 80 ? "Warning" : "Normal";
  return { used, capacity, percent, status };
}

// Aggregates everything a Market Dashboard page needs.
export function getMarketDashboardData(marketId) {
  const found = findMarket(marketId);
  if (!found) return null;
  const { market, zone } = found;
  const employees = generateEmployees(marketId);
  return {
    market,
    zone,
    employees,
    departments: generateDepartments(marketId, employees),
    todayActivities: generateTodayActivities(marketId),
    cartonCapacity: generateCartonCapacity(marketId),
  };
}

export function getEmployeeById(employeeId) {
  const marketId = employeeId.split("-emp-")[0];
  const found = findMarket(marketId);
  if (!found) return null;
  const employees = generateEmployees(marketId);
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) return null;
  return { employee, market: found.market, zone: found.zone };
}
