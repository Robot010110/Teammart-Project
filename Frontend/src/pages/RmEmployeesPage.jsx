import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronRight, Store } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { listEmployees } from "../services/staffEmployeeService";
import { listMarkets } from "../services/marketService";
import { initialsOf } from "../utils/initials";

const ROLE_LABEL = { WORKER: "Worker", CASHIER: "Cashier", BUTCHER: "Butcher" };
const ROLE_OPTIONS = ["WORKER", "CASHIER", "BUTCHER"];
const SHIFT_OPTIONS = ["MORNING", "EVENING", "NIGHT"];

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// RmEmployeesPage.jsx — spec §3: the Regional Manager's global roster
// across every market they manage (~60 employees), with server-side
// market/role/shift/search filtering (employeesController.listEmployees)
// so this never loads more than what's actually being looked at. Every
// row opens the existing per-market employee profile drill-down
// (Attendance/Performance/History already live there — see
// RmEmployeeProfile.jsx) rather than duplicating that page here.
export default function RmEmployeesPage() {
  const [marketId, setMarketId] = useState("");
  const [role, setRole] = useState("");
  const [shift, setShift] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 300);
  const navigate = useNavigate();

  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const { data: employees, error, loading, reload } = useAsync(
    () => listEmployees({ marketId: marketId || undefined, role: role || undefined, shift: shift || undefined, search: search || undefined }),
    { deps: [marketId, role, shift, search] }
  );
  const marketNameById = useMemo(() => new Map((markets ?? []).map((m) => [m.id, m.name])), [markets]);

  const selectClass =
    "rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50";

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Employees</h1>
        <p className="mt-1 text-sm text-[#9AA1B4]">
          {loading ? "Loading..." : `${employees?.length ?? 0} employee${employees?.length === 1 ? "" : "s"} across your markets`}
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5266]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or employee code..."
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>
        <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
          <option value="">All Markets</option>
          {(markets ?? []).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
          <option value="">All Roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <select value={shift} onChange={(e) => setShift(e.target.value)} className={selectClass}>
          <option value="">All Shifts</option>
          {SHIFT_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-[64px]" />)}
          </div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : employees.length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
            No employees match these filters.
          </div>
        ) : (
          <div className="space-y-2">
            {employees.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => navigate(`/rm/markets/${e.marketId}/employees/${e.id}`)}
                className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors text-left"
              >
                <span className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0 overflow-hidden">
                  {e.profilePictureUrl ? <img src={e.profilePictureUrl} alt="" className="w-full h-full object-cover" /> : initialsOf(e.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{e.name}</p>
                  <div className="flex items-center gap-3 text-xs text-[#8B93A8] mt-0.5">
                    <span>{ROLE_LABEL[e.role] ?? e.position}</span>
                    <span className="flex items-center gap-1"><Store size={11} /> {marketNameById.get(e.marketId) ?? "—"}</span>
                    {(e.cashierShift || e.shift) && <span>{e.cashierShift ?? e.shift}</span>}
                  </div>
                </div>
                <span className="hidden sm:block text-xs text-[#4C5266] shrink-0">{e.employeeCode}</span>
                <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
