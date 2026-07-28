import {
  ACTIVITY_TYPES, APPROVERS, PHOTO_REQUIRED_TYPES, TASK_PHOTO_RETENTION_DAYS,
  seededRandom, pick,
} from "./constants";

// employeeData.js — builds an employee's performance summary, monthly
// activity calendar, and activity timeline from a seeded random source so
// the same employee always renders the same mock history.

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// "Counting Items" is a monthly (not daily) task — pick 2 fixed-feeling days.
function countingDaysFor(rand, totalDays) {
  const first = Math.floor(rand() * 10) + 3; // early-month
  const second = Math.floor(rand() * 10) + 17; // mid/late-month
  return [Math.min(first, totalDays), Math.min(second, totalDays)];
}

function buildDayActivities(rand, day, isCountingDay, daysAgo) {
  const activities = [];
  const retentionInfo = (type) => {
    const requiresPhoto = PHOTO_REQUIRED_TYPES.includes(type);
    if (!requiresPhoto) return { requiresPhoto: false };
    const daysRemaining = Math.max(TASK_PHOTO_RETENTION_DAYS - daysAgo, 0);
    return { requiresPhoto: true, photoExpiresInDays: daysRemaining, photoExpired: daysRemaining === 0 };
  };

  if (isCountingDay) {
    activities.push({
      type: "Counting Items",
      time: `${9 + Math.floor(rand() * 3)}:${pick(rand, ["05", "20", "40"])} ${rand() > 0.5 ? "AM" : "PM"}`,
      status: "Completed",
      department: pick(rand, ["Fresh", "Snacks", "Non Food 1", "Drinks"]),
      notes: "Bi-monthly inventory count completed.",
      approvedBy: pick(rand, APPROVERS),
      ...retentionInfo("Counting Items"),
    });
    return activities;
  }
  const count = Math.floor(rand() * 3) + 1;
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let type = pick(rand, ACTIVITY_TYPES.filter((t) => t !== "Counting Items"));
    if (used.has(type)) continue;
    used.add(type);
    const hour = 8 + Math.floor(rand() * 10);
    const minute = pick(rand, ["05", "14", "22", "38", "47", "55"]);
    const status = pick(rand, ["Completed", "Completed", "Completed", "Pending"]);
    activities.push({
      type,
      time: `${hour > 12 ? hour - 12 : hour}:${minute} ${hour >= 12 ? "PM" : "AM"}`,
      status,
      department: pick(rand, ["Snacks", "Drinks", "Freezer", "Fresh", "Food", "Nuts", "Checkout"]),
      notes: "",
      approvedBy: status === "Completed" ? pick(rand, APPROVERS) : null,
      ...retentionInfo(type),
    });
  }
  return activities.sort((a, b) => a.time.localeCompare(b.time));
}

// Builds the full current-month calendar for an employee.
export function generateMonthlyCalendar(employeeId) {
  const rand = seededRandom(employeeId + "-calendar");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const total = daysInMonth(year, month);
  const today = now.getDate();
  const [countA, countB] = countingDaysFor(rand, total);

  const days = [];
  for (let d = 1; d <= total; d++) {
    const isFuture = d > today;
    const isCountingDay = d === countA || d === countB;
    const hasActivity = !isFuture && (isCountingDay || rand() > 0.28);
    days.push({
      day: d,
      date: new Date(year, month, d),
      isToday: d === today,
      isFuture,
      isCountingDay,
      hasActivity,
      activities: !isFuture && hasActivity ? buildDayActivities(rand, d, isCountingDay, today - d) : [],
    });
  }
  return { year, month, days };
}

export function generatePerformanceStats(employeeId) {
  const rand = seededRandom(employeeId + "-performance");
  return {
    performanceScore: Math.floor(rand() * 12) + 85,
    completedTasks: Math.floor(rand() * 60) + 120,
    expiredItemsRemoved: Math.floor(rand() * 30) + 10,
    labelsChecked: Math.floor(rand() * 80) + 60,
    shelvesCleaned: Math.floor(rand() * 50) + 40,
    customizations: Math.floor(rand() * 20) + 5,
    attendanceRate: Math.floor(rand() * 8) + 91,
    avgCompletionTime: `${(rand() * 2 + 1.5).toFixed(1)} hrs`,
  };
}

// Flattened, newest-first timeline for the Activity Timeline section.
export function generateTimeline(employeeId, calendar) {
  const entries = [];
  [...calendar.days].reverse().forEach((day) => {
    day.activities.forEach((a) => {
      entries.push({
        ...a,
        day: day.day,
        dateLabel: day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    });
  });
  return entries.slice(0, 25);
}

export function generateChartSeries(employeeId) {
  const rand = seededRandom(employeeId + "-charts");
  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  return {
    monthlyActivity: months.map((m) => ({ label: m, value: Math.floor(rand() * 40) + 50 })),
    taskCompletion: months.map((m) => ({ label: m, value: Math.floor(rand() * 15) + 82 })),
    attendance: months.map((m) => ({ label: m, value: Math.floor(rand() * 10) + 88 })),
    performanceTrend: months.map((m) => ({ label: m, value: Math.floor(rand() * 14) + 80 })),
    departmentDistribution: [
      { label: "Fresh", value: Math.floor(rand() * 20) + 10 },
      { label: "Snacks", value: Math.floor(rand() * 20) + 10 },
      { label: "Drinks", value: Math.floor(rand() * 20) + 10 },
      { label: "Checkout", value: Math.floor(rand() * 20) + 10 },
      { label: "Freezer", value: Math.floor(rand() * 15) + 5 },
    ],
  };
}
