import { Hash, Sparkles, Tag, PackageX, CheckCircle2, Layers, LogIn, LogOut } from "lucide-react";
import { useAsync } from "./useAsync";
import { listActivitiesForMarket } from "../services/activityService";
import { listItemReportsForMarket } from "../services/itemReportService";
import { listWastedOverallReportsForMarket } from "../services/wastedOverallService";
import { listSuddenTasks } from "../services/suddenTaskService";
import { getEmployeeAttendanceMonth } from "../services/attendanceService";

// The same per-category icon language EmployeeActivityHistoryScreen.jsx
// already established (Hash/Sparkles/Tag/PackageX/…) — one mapping, used
// by both places this feed renders, instead of drifting apart.
const CATEGORY_ICON = {
  ITEM_COUNTING: Hash,
  SHELF_CLEANING: Sparkles,
  DAILY_CLEANING: Sparkles,
  LABEL_CHECKING: Tag,
  PRODUCT_CUSTOMIZATION: Layers,
  FACING: Layers,
  REFILLING: Layers,
};
const CATEGORY_LABEL = {
  SHELF_CLEANING: "Shelf Cleaning",
  DAILY_CLEANING: "Daily Cleaning",
  ITEM_COUNTING: "Inventory Counting",
  LABEL_CHECKING: "Label Checking",
  PRODUCT_CUSTOMIZATION: "Product Customization",
  FACING: "Facing",
  REFILLING: "Refilling",
};

// The real filter groups a person can pick in Activity History — every
// key maps to real category/kind values, nothing invented. "All
// Activities" is the default (no filtering).
export const ACTIVITY_FILTERS = [
  { key: "ALL", label: "All Activities" },
  { key: "CLEANING", label: "Cleaning" },
  { key: "COUNTING", label: "Inventory Counting" },
  { key: "CUSTOMIZATION", label: "Product Customization" },
  { key: "LABEL", label: "Label Checking" },
  { key: "WASTE", label: "Waste / Expired" },
  { key: "TASKS", label: "Tasks" },
  { key: "SYSTEM", label: "System" },
];

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// useEmployeeActivityFeed.js — the one real merge of everything a
// specific employee has done, shared by EmployeeTodayActivity.jsx (the
// Profile page's today-only preview) and EmployeeActivityHistoryScreen.jsx
// (the full historical feed) so the two never drift into separate data
// sources under the hood. Five real sources, each already scoped to this
// employeeId server-side except Wasted Overall (no employeeId filter
// exists for that endpoint, so it's fetched market-wide and filtered
// client-side — same approach the old category-picker screen already
// used):
//   - Activities (shelf cleaning, counting, label checks, …)
//   - Expired/Wasted item reports
//   - Wasted Overall reports
//   - Completed Sudden Tasks
//   - Check In / Check Out for the CURRENT month, read from the same
//     AttendanceRecord getEmployeeAttendanceMonth already exposes (the
//     Attendance screen's own data source) — not a new endpoint. Scoped
//     to the current month only (not fetched per-month across all of
//     history) to avoid turning one feed load into an unbounded number
//     of requests; every other source here already returns full history.
//
// Every item carries a real `status` (ActivityStatus for
// Activity/ItemReport/WastedOverall; "COMPLETED" for a finished task;
// "SYSTEM" for an automatic check-in/out event, which was never
// reviewable to begin with) — never inferred, always the backend's own
// field. Sorted newest-first.
export function useEmployeeActivityFeed({ employeeId, marketId, todayOnly = false }) {
  return useAsync(
    async () => {
      const now = new Date();
      const [activities, itemReports, wastedAll, suddenTasks, attendanceMonth] = await Promise.all([
        listActivitiesForMarket({ marketId, employeeId }),
        listItemReportsForMarket({ marketId, employeeId }),
        listWastedOverallReportsForMarket({ marketId }),
        listSuddenTasks({ employeeId, status: "COMPLETED" }),
        getEmployeeAttendanceMonth(employeeId, { year: now.getFullYear(), month: now.getMonth() + 1 }),
      ]);

      const items = [
        ...activities.map((a) => ({
          id: `activity-${a.id}`,
          filterKey: a.category === "SHELF_CLEANING" || a.category === "DAILY_CLEANING" ? "CLEANING"
            : a.category === "ITEM_COUNTING" ? "COUNTING"
            : a.category === "LABEL_CHECKING" ? "LABEL"
            : "CUSTOMIZATION",
          icon: CATEGORY_ICON[a.category] ?? Sparkles,
          tone: "text-[#F47A20] bg-[#F47A20]/12 ring-[#F47A20]/25",
          title: CATEGORY_LABEL[a.category] ?? a.category,
          subtitle: a.notes || null,
          status: a.status,
          timestamp: a.updatedAt ?? a.createdAt,
        })),
        ...itemReports.map((r) => ({
          id: `item-report-${r.id}`,
          filterKey: "WASTE",
          icon: PackageX,
          tone: "text-red-400 bg-red-500/12 ring-red-500/25",
          title: r.condition === "EXPIRED" ? "Expired Items" : "Wasted Items",
          subtitle: `${r.product?.name ?? "Item"} × ${r.quantity}`,
          status: r.status,
          timestamp: r.reportedAt,
        })),
        ...wastedAll.filter((w) => w.employeeId === employeeId).map((w) => ({
          id: `wasted-${w.id}`,
          filterKey: "WASTE",
          icon: PackageX,
          tone: "text-red-400 bg-red-500/12 ring-red-500/25",
          title: "Waste Report",
          subtitle: null,
          status: w.status,
          timestamp: w.reportedAt,
        })),
        ...suddenTasks.map((t) => ({
          id: `task-${t.id}`,
          filterKey: "TASKS",
          icon: CheckCircle2,
          tone: "text-[#C08BFF] bg-[#C08BFF]/12 ring-[#C08BFF]/25",
          title: "Task Completed",
          subtitle: t.title,
          status: "COMPLETED",
          timestamp: t.completedAt ?? t.assignedAt,
        })),
      ];

      const todayRow = (attendanceMonth?.days ?? []).find((d) => isToday(d.date));
      if (todayRow?.checkIn) {
        items.push({
          id: "check-in", filterKey: "SYSTEM", icon: LogIn,
          tone: "text-emerald-400 bg-emerald-500/12 ring-emerald-500/25",
          title: "Checked In", subtitle: "Started shift", status: "SYSTEM", timestamp: todayRow.checkIn,
        });
      }
      if (todayRow?.checkOut) {
        items.push({
          id: "check-out", filterKey: "SYSTEM", icon: LogOut,
          tone: "text-sky-400 bg-sky-500/12 ring-sky-500/25",
          title: "Checked Out", subtitle: null, status: "SYSTEM", timestamp: todayRow.checkOut,
        });
      }

      return items
        .filter((i) => !todayOnly || isToday(i.timestamp))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },
    { deps: [employeeId, marketId, todayOnly], fallbackError: "Could not load activity." }
  );
}
