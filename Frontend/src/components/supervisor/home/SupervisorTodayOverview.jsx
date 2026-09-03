import { useNavigate } from "react-router-dom";
import { Users, AlertTriangle, Sparkles, ClipboardList } from "lucide-react";
import { useAsync } from "../../../hooks/useAsync";
import { SkeletonCard } from "../../common/SkeletonCard";
import { listEmployeesByMarket } from "../../../services/staffEmployeeService";
import { listMarketProblems } from "../../../services/marketProblemsService";
import { listActivitiesForMarket } from "../../../services/activityService";
import { listWastedOverallReportsForMarket } from "../../../services/wastedOverallService";
import { listExtraHoursRequestsForMarket } from "../../../services/attendanceService";
import { listItemReportsForMarket } from "../../../services/itemReportService";
import { listSuddenTasks } from "../../../services/suddenTaskService";

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// SupervisorTodayOverview.jsx — the four Today Overview cards. Each one
// is a genuinely distinct, real, non-overlapping data source — this
// matters, because it would be easy to accidentally show the same
// underlying list twice under two names:
//
//   Employees        listEmployeesByMarket — who's on the team.
//   Alerts           real MarketProblem rows (OPEN/IN_PROGRESS) — an
//                    actual operational issue (broken equipment, etc.),
//                    not a review queue.
//   Pending Tasks    real PENDING Activity + WastedOverall + ExtraHours
//                    reviews — things awaiting the Supervisor's own
//                    decision, distinct from "something is physically
//                    wrong" above.
//   Recent Activity  the same 5-source merge TodayActivityFeed.jsx
//                    already does, counted for TODAY here as a teaser —
//                    the dedicated page (opened by tapping this card)
//                    shows the real, wider chronological history.
//
// Every count is fetched directly from the same real services the
// dedicated pages use — not invented, not a second source of truth.
export default function SupervisorTodayOverview({ session, basePath }) {
  const navigate = useNavigate();
  const marketId = session.marketId;

  const { data: employees, loading: l1 } = useAsync(() => listEmployeesByMarket(marketId), { deps: [marketId] });
  const { data: problems, loading: l2 } = useAsync(() => listMarketProblems(marketId, "active"), { deps: [marketId] });

  const { data: pendingCounts, loading: l3 } = useAsync(
    async () => {
      const [activities, wasted, extraHours] = await Promise.all([
        listActivitiesForMarket({ marketId, status: "PENDING" }),
        listWastedOverallReportsForMarket({ marketId, status: "PENDING" }),
        listExtraHoursRequestsForMarket({ marketId, status: "PENDING" }),
      ]);
      return activities.length + wasted.length + extraHours.length;
    },
    { deps: [marketId] }
  );

  const { data: recentCount, loading: l4 } = useAsync(
    async () => {
      const [activities, itemReports, wasted, suddenTasks, extraHours] = await Promise.all([
        listActivitiesForMarket({ marketId, status: "PENDING" }),
        listItemReportsForMarket({ marketId }),
        listWastedOverallReportsForMarket({ marketId }),
        listSuddenTasks({ status: "COMPLETED" }),
        listExtraHoursRequestsForMarket({ marketId }),
      ]);
      const timestamps = [
        ...activities.map((a) => a.updatedAt ?? a.createdAt),
        ...itemReports.map((r) => r.reportedAt),
        ...wasted.map((w) => w.reportedAt),
        ...suddenTasks.map((t) => t.completedAt ?? t.assignedAt),
        ...extraHours.map((r) => r.createdAt),
      ];
      return timestamps.filter(isToday).length;
    },
    { deps: [marketId] }
  );

  const loading = l1 || l2 || l3 || l4;

  const cards = [
    { key: "employees", label: "Employees", sub: "Managed", value: employees?.length, icon: Users, tone: "blue", onClick: () => navigate(`${basePath}/employees`) },
    { key: "alerts", label: "Alerts", sub: "Require attention", value: problems?.length, icon: AlertTriangle, tone: "red", onClick: () => navigate(`${basePath}/alerts`) },
    { key: "activity", label: "Recent Activity", sub: "New updates", value: recentCount, icon: Sparkles, tone: "violet", onClick: () => navigate(`${basePath}/activity`) },
    { key: "tasks", label: "Pending Tasks", sub: "Tasks waiting", value: pendingCounts, icon: ClipboardList, tone: "orange", onClick: () => navigate(`${basePath}/pending-tasks`) },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-[104px] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <OverviewCard key={c.key} {...c} />
      ))}
    </div>
  );
}

const TONES = {
  blue: { text: "text-sky-400", bg: "bg-sky-500/10", glow: "glow-sky-soft" },
  red: { text: "text-[#FF5C5C]", bg: "bg-red-500/10", glow: "glow-red" },
  violet: { text: "text-violet-400", bg: "bg-violet-500/10", glow: "glow-violet-soft" },
  orange: { text: "text-[#F47A20]", bg: "bg-[#F47A20]/10", glow: "glow-orange-soft" },
};

function OverviewCard({ label, sub, value, icon: Icon, tone, onClick }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl hover:border-white/[0.14] active:scale-[0.98] transition-all duration-150"
    >
      <span className={`w-8 h-8 rounded-lg grid place-items-center ${t.bg} ${t.glow} ${t.text}`}>
        <Icon size={15} />
      </span>
      <p className="mt-2.5 font-display text-2xl font-bold text-white tabular-nums">{value ?? "—"}</p>
      <p className="mt-0.5 text-[13px] font-medium text-white">{label}</p>
      <p className="text-[11px] text-[#8B93A8]">{sub}</p>
    </button>
  );
}
