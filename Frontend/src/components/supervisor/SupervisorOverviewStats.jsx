import { useNavigate } from "react-router-dom";
import { Users, AlertTriangle, Sparkles } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "../common/SkeletonCard";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { listMarketProblems } from "../../services/marketProblemsService";
import { listActivitiesForMarket } from "../../services/activityService";

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function StatTile({ icon: Icon, label, value, onClick }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-2xl p-4 bg-[#1A1F33]/70 border border-white/[0.06] text-left ${onClick ? "hover:border-[#F47A20]/25 transition-colors" : ""}`}
    >
      <span className="w-8 h-8 rounded-lg bg-[#F47A20]/10 text-[#F47A20] grid place-items-center mb-2">
        <Icon size={15} />
      </span>
      <p className="text-xl font-display font-bold text-white">{value ?? "—"}</p>
      <p className="text-[11px] text-[#8B93A8] mt-0.5">{label}</p>
    </Comp>
  );
}

// SupervisorOverviewStats.jsx — Repair Pass §5: "Today's Overview" tile
// row on the redesigned homepage. Every number is a real, independently
// fetched count from an endpoint that already exists — Employees
// Assigned (GET /api/employees, market-scoped), Active Problems (the
// real MarketProblem model added this same pass), Today's Activities
// (GET /api/activities, filtered client-side to today the same way
// WastedItemsSection already does). Nothing here is invented.
export default function SupervisorOverviewStats({ session, basePath }) {
  const navigate = useNavigate();
  const { data: employees, loading: loadingEmployees } = useAsync(
    () => listEmployeesByMarket(session.marketId),
    { deps: [session.marketId] }
  );
  const { data: problems, loading: loadingProblems } = useAsync(
    () => listMarketProblems(session.marketId, "active"),
    { deps: [session.marketId] }
  );
  const { data: activities, loading: loadingActivities } = useAsync(
    () => listActivitiesForMarket({ marketId: session.marketId }),
    { deps: [session.marketId] }
  );

  if (loadingEmployees || loadingProblems || loadingActivities) {
    return <SkeletonCard className="h-24" />;
  }

  const todaysActivityCount = (activities ?? []).filter((a) => isToday(a.updatedAt ?? a.createdAt)).length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile icon={Users} label="Employees Assigned" value={employees?.length} onClick={() => navigate(`${basePath}/employees`)} />
      <StatTile icon={AlertTriangle} label="Active Problems" value={problems?.length} onClick={() => navigate(`${basePath}/market`)} />
      <StatTile icon={Sparkles} label="Today's Activities" value={todaysActivityCount} />
    </div>
  );
}
