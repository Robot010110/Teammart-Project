import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Users, HardHat, ShoppingBag, Search } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { SkeletonCard } from "../common/SkeletonCard";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { initialsOf } from "../../utils/initials";

const ROLE_LABEL = { WORKER: "Worker", CASHIER: "Cashier" };
const STATUS_TONE = { ACTIVE: "text-emerald-400", INACTIVE: "text-[#9AA1B4]", ON_LEAVE: "text-amber-400" };
const STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave" };

function EmployeeCard({ e, onOpen }) {
  const userId = e.employeeCode || e.username;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-center gap-3 rounded-2xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/30 hover:bg-[#1F2436] transition-all duration-150"
    >
      <div className="relative h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-2 ring-white/[0.06] overflow-hidden">
        {e.profilePictureUrl ? (
          <AuthenticatedImage src={e.profilePictureUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-display font-bold text-white">{initialsOf(e.name)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{e.name}</p>
        <p className="text-xs text-[#8B93A8] truncate">
          {[e.position, e.shift, e.department].filter(Boolean).join(" · ")}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {userId && <span className="text-[10px] font-mono text-[#4C5266]">#{userId}</span>}
          {!e.employeeCode && !e.username ? (
            <span className="text-[10px] font-medium text-amber-400">Pending Login</span>
          ) : (
            <span className={`text-[10px] font-medium ${STATUS_TONE[e.employmentStatus] || "text-[#9AA1B4]"}`}>
              {STATUS_LABEL[e.employmentStatus] || e.employmentStatus}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
    </button>
  );
}

function RoleGroup({ title, icon: Icon, employees, onOpen }) {
  return (
    <div className="rounded-2xl p-4 bg-[#121627]/40 border border-white/[0.05]">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-7 w-7 rounded-lg bg-[#F47A20]/10 text-[#F47A20] grid place-items-center">
          <Icon size={14} />
        </span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="text-xs text-[#4C5266]">({employees.length})</span>
      </div>
      {employees.length === 0 ? (
        <p className="text-xs text-[#4C5266] text-center py-6">No {title.toLowerCase()} here.</p>
      ) : (
        <div className="space-y-2">
          {employees.map((e) => (
            <EmployeeCard key={e.id} e={e} onOpen={() => onOpen(e)} />
          ))}
        </div>
      )}
    </div>
  );
}

// EmployeesListScreen.jsx — Repair Pass §2: Workers and Cashiers grouped
// into their own visually distinct card sections instead of one flat
// list, per real data (GET /api/employees, force-scoped server-side to
// the caller's own market — never another market's employees, enforced
// backend-side, not just hidden here). Tapping still navigates to the
// same real route (employees/:employeeId) unchanged — see
// SupervisorEmployeeProfileRoute.jsx for the other half of this flow;
// this redesign only changes how the list is presented, not what it
// links to or where its data comes from.
export default function EmployeesListScreen({ session, basePath }) {
  const { data: employees, error, loading, reload } = useAsync(
    () => listEmployeesByMarket(session.marketId),
    { deps: [session.marketId], fallbackError: "Could not load employees." }
  );
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!employees) return [];
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.name, e.employeeCode, e.username, e.position, e.department].some((v) => v?.toLowerCase().includes(q))
    );
  }, [employees, query]);

  const workers = filtered.filter((e) => e.role !== "CASHIER");
  const cashiers = filtered.filter((e) => e.role === "CASHIER");

  function openEmployee(e) {
    navigate(`${basePath}/employees/${e.id}`);
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-1">Employees</h1>
      <p className="text-xs text-[#8B93A8] mb-4">{session.marketName || "Your market"}</p>

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
        <>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, ID, or department"
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-[#4C5266] text-center py-10">No employees match "{query}".</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RoleGroup title="Worker" icon={HardHat} employees={workers} onOpen={openEmployee} />
              <RoleGroup title="Cashier" icon={ShoppingBag} employees={cashiers} onOpen={openEmployee} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
