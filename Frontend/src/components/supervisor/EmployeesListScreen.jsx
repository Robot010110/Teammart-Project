import { useNavigate } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { initialsOf } from "../../utils/initials";

const ROLE_LABEL = { WORKER: "Worker", CASHIER: "Cashier" };
const STATUS_TONE = { ACTIVE: "text-emerald-400", INACTIVE: "text-[#9AA1B4]", ON_LEAVE: "text-amber-400" };
const STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave" };

// EmployeesListScreen.jsx — the Employees tab: every employee belonging
// to the Supervisor's assigned market, real data (GET /api/employees,
// force-scoped server-side to the caller's own market for a SUPERVISOR
// token — never another market's employees, enforced backend-side, not
// just hidden in this UI). Tapping navigates to a real route
// (employees/:employeeId) instead of flipping local state — see
// SupervisorEmployeeProfileRoute.jsx for the other half of this flow.
export default function EmployeesListScreen({ session, basePath }) {
  const { data: employees, error, loading, reload } = useAsync(
    () => listEmployeesByMarket(session.marketId),
    { deps: [session.marketId], fallbackError: "Could not load employees." }
  );
  const navigate = useNavigate();

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Employees</h1>

      {loading ? (
        <SkeletonCard className="h-[280px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : employees.length === 0 ? (
        <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
          <Users size={22} className="mx-auto text-[#4C5266] mb-2" />
          <p className="text-sm text-[#8B93A8]">No employees in this market yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => navigate(`${basePath}/employees/${e.id}`)}
              className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
            >
              <div className="relative h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-2 ring-white/[0.06] overflow-hidden">
                {e.profilePictureUrl ? (
                  <img src={e.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-display font-bold text-white">{initialsOf(e.name)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-white truncate">{e.name}</p>
                <p className="text-xs text-[#8B93A8]">{ROLE_LABEL[e.role] || e.role} · {e.position}</p>
              </div>
              <span className={`text-[11px] font-medium shrink-0 ${STATUS_TONE[e.employmentStatus] || "text-[#9AA1B4]"}`}>
                {STATUS_LABEL[e.employmentStatus] || e.employmentStatus}
              </span>
              <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
