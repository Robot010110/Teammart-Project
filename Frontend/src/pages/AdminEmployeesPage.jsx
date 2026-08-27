import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronRight, Store } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { listEmployees } from "../services/staffEmployeeService";
import { listMarkets } from "../services/marketService";
import { initialsOf } from "../utils/initials";
import AdminStaffPage from "./AdminStaffPage";

const ROLE_LABEL = { WORKER: "Worker", CASHIER: "Cashier", BUTCHER: "Butcher" };
const ROLE_OPTIONS = ["WORKER", "CASHIER", "BUTCHER"];
const STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave" };
const STATUS_STYLE = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400",
  INACTIVE: "bg-[#4C5266]/20 text-[#8B93A8]",
  ON_LEAVE: "bg-amber-500/10 text-amber-400",
};

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// AdminEmployeesPage.jsx — Admin Phase 1 §11-13: the company-wide
// "Employees" destination. TeamMart represents people two different,
// real ways (a staff `User` account — Regional Manager/Supervisor/
// Overlooking/Admin — versus an `Employee` row — Worker/Cashier/Butcher)
// and this page presents BOTH coherently, as two clearly-labeled views,
// rather than flattening them into one fake merged list (spec §11's own
// instruction). "Staff Accounts" reuses AdminStaffPage.jsx entirely
// (already built, already ADMIN-gated) instead of duplicating it here;
// "Workforce" is the genuinely new company-wide roster, built on the
// exact same listEmployees() call/filters RmEmployeesPage.jsx already
// uses — employeesController.listEmployees is already unscoped for an
// ADMIN caller, so no backend change was needed for this list itself.
export default function AdminEmployeesPage() {
  const [view, setView] = useState("workforce");
  const [marketId, setMarketId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 300);
  const navigate = useNavigate();

  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const { data: employees, error, loading, reload } = useAsync(
    () => listEmployees({ marketId: marketId || undefined, role: role || undefined, search: search || undefined }),
    { deps: [marketId, role, search] }
  );
  const marketById = useMemo(() => new Map((markets ?? []).map((m) => [m.id, m])), [markets]);
  const shaped = useMemo(
    () => (employees ?? []).filter((e) => !status || e.employmentStatus === status),
    [employees, status]
  );

  const selectClass =
    "rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50";

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-7xl mx-auto animate-fade-up">
      <h1 className="font-display text-xl md:text-2xl font-bold text-white mb-4">Employees</h1>

      <div className="flex gap-2 mb-6">
        {[
          { key: "workforce", label: "Workforce" },
          { key: "staff", label: "Staff Accounts" },
        ].map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              view === v.key ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] hover:bg-white/[0.09]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "staff" ? (
        <AdminStaffPage />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
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
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="">All Statuses</option>
              {Object.keys(STATUS_LABEL).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <p className="mt-3 text-xs text-[#6B7284]">
            {loading ? "Loading..." : `${shaped.length} employee${shaped.length === 1 ? "" : "s"} company-wide`}
          </p>

          <div className="mt-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-[64px]" />)}
              </div>
            ) : error ? (
              <ErrorBanner message={error} onRetry={reload} />
            ) : shaped.length === 0 ? (
              <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
                No authorized contacts found.
              </div>
            ) : (
              <div className="space-y-2">
                {shaped.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => navigate(`/admin/employees/${e.id}`)}
                    className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors text-left"
                  >
                    <span className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0 overflow-hidden">
                      {e.profilePictureUrl ? <AuthenticatedImage src={e.profilePictureUrl} alt="" className="w-full h-full object-cover" /> : initialsOf(e.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{e.name}</p>
                      <div className="flex items-center gap-3 text-xs text-[#8B93A8] mt-0.5">
                        <span>{ROLE_LABEL[e.role] ?? e.position}</span>
                        <span className="flex items-center gap-1"><Store size={11} /> {marketById.get(e.marketId)?.name ?? "—"}</span>
                        {(e.cashierShift || e.shift) && <span>{e.cashierShift ?? e.shift}</span>}
                      </div>
                    </div>
                    <span className={`hidden sm:inline-flex shrink-0 text-[10px] font-semibold uppercase rounded-full px-2 py-1 ${STATUS_STYLE[e.employmentStatus] ?? ""}`}>
                      {STATUS_LABEL[e.employmentStatus] ?? e.employmentStatus}
                    </span>
                    <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
