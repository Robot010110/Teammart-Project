import { useTranslation } from "react-i18next";
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
// Values are translation KEYS, resolved with t() inside the hook body
// below — this constant itself sits at module scope, where `t` isn't
// available yet.
const CATEGORY_LABEL = {
  SHELF_CLEANING: "sup.shelfCleaning",
  DAILY_CLEANING: "emp.dailyCleaning",
  ITEM_COUNTING: "sup.inventoryCounting",
  LABEL_CHECKING: "sup.labelChecking",
  PRODUCT_CUSTOMIZATION: "emp.productCustomization",
  FACING: "sup.facing",
  REFILLING: "sup.refilling",
};

// The real filter groups a person can pick in Activity History — every
// key maps to real category/kind values, nothing invented. "All
// Activities" is the default (no filtering). Labels are translation
// KEYS — ACTIVITY_FILTERS is consumed directly by the two screens below
// (for the filter picker's own UI), so those callers resolve them with
// t() themselves; this hook only resolves the KEYS IT PRODUCES per item.
export const ACTIVITY_FILTERS = [
  { key: "ALL", label: "sup.allActivities" },
  { key: "CLEANING", label: "emp.catCleaningTask" },
  { key: "COUNTING", label: "sup.inventoryCounting" },
  { key: "CUSTOMIZATION", label: "emp.productCustomization" },
  { key: "LABEL", label: "sup.labelChecking" },
  { key: "WASTE", label: "sup.wasteExpired" },
  { key: "TASKS", label: "emp.navTasks" },
  { key: "SYSTEM", label: "sup.system" },
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
//
// `title`/`subtitle` are already-resolved display text (not keys) —
// this is a real React hook (called from a component's render), so it
// can call useTranslation() itself and hand consumers finished strings,
// rather than pushing key-resolution out to every render site.
export function useEmployeeActivityFeed({ employeeId, marketId, todayOnly = false }) {
  const { t } = useTranslation();
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
          title: CATEGORY_LABEL[a.category] ? t(CATEGORY_LABEL[a.category]) : a.category,
          subtitle: a.notes || null,
          status: a.status,
          timestamp: a.updatedAt ?? a.createdAt,
        })),
        ...itemReports.map((r) => ({
          id: `item-report-${r.id}`,
          filterKey: "WASTE",
          icon: PackageX,
          tone: "text-red-400 bg-red-500/12 ring-red-500/25",
          title: r.condition === "EXPIRED" ? t("emp.catExpiredItems") : t("sup.wastedItemsTitle"),
          subtitle: `${r.product?.name ?? t("sup.item")} × ${r.quantity}`,
          status: r.status,
          timestamp: r.reportedAt,
        })),
        ...wastedAll.filter((w) => w.employeeId === employeeId).map((w) => ({
          id: `wasted-${w.id}`,
          filterKey: "WASTE",
          icon: PackageX,
          tone: "text-red-400 bg-red-500/12 ring-red-500/25",
          title: t("emp.wasteReport"),
          subtitle: null,
          status: w.status,
          timestamp: w.reportedAt,
        })),
        ...suddenTasks.map((st) => ({
          id: `task-${st.id}`,
          filterKey: "TASKS",
          icon: CheckCircle2,
          tone: "text-[#C08BFF] bg-[#C08BFF]/12 ring-[#C08BFF]/25",
          title: t("sup.taskCompleted"),
          subtitle: st.title,
          status: "COMPLETED",
          timestamp: st.completedAt ?? st.assignedAt,
        })),
      ];

      const todayRow = (attendanceMonth?.days ?? []).find((d) => isToday(d.date));
      if (todayRow?.checkIn) {
        items.push({
          id: "check-in", filterKey: "SYSTEM", icon: LogIn,
          tone: "text-emerald-400 bg-emerald-500/12 ring-emerald-500/25",
          title: t("emp.checkedIn"), subtitle: t("sup.startedShift"), status: "SYSTEM", timestamp: todayRow.checkIn,
        });
      }
      if (todayRow?.checkOut) {
        items.push({
          id: "check-out", filterKey: "SYSTEM", icon: LogOut,
          tone: "text-sky-400 bg-sky-500/12 ring-sky-500/25",
          title: t("emp.checkedOut"), subtitle: null, status: "SYSTEM", timestamp: todayRow.checkOut,
        });
      }

      return items
        .filter((i) => !todayOnly || isToday(i.timestamp))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },
    // `t` in the deps array: a language switch must re-run this so
    // already-fetched items get their title/subtitle re-resolved in the
    // new language too, not just newly-fetched ones.
    { deps: [employeeId, marketId, todayOnly, t], fallbackError: t("sup.couldNotLoadActivity") }
  );
}
