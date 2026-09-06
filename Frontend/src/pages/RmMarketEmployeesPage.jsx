import { useMemo, useState } from "react";
import { ArrowLeft, Search, Users2, X } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import MarketEmployeeCard, { employeeState } from "../components/regionalManager/market/MarketEmployeeCard";
import { getMarketOverview } from "../services/marketManagementService";

const TABS = [
  { key: "ALL", label: "All", dot: null },
  { key: "ACTIVE", label: "Active", dot: "bg-emerald-400" },
  { key: "ON_BREAK", label: "On Break", dot: "bg-amber-400" },
  { key: "OFF_SHIFT", label: "Off Shift", dot: "bg-[#4C5266]" },
];

// RmMarketEmployeesPage.jsx — the employees of ONE market.
//
// Scoping is not done here by filtering a global list: this reads
// GET /api/markets/:id/overview, whose `employees` array is that
// market's own roster (built from market.employees server-side, then
// given live attendance state by attachEmployeeStatuses). A market's
// page therefore cannot show an employee from another market or zone
// even if the client asked it to, and access to the market itself is
// re-checked by assertMarketAccess on every request.
export default function RmMarketEmployeesPage({ marketId, onBack, onOpenEmployee }) {
  const { data: overview, error, loading, reload } = useAsync(() => getMarketOverview(marketId), { deps: [marketId] });
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("ALL");

  const employees = useMemo(() => overview?.employees ?? [], [overview]);

  const counts = useMemo(
    () => ({
      ALL: employees.length,
      ACTIVE: employees.filter((e) => employeeState(e) === "ACTIVE").length,
      ON_BREAK: employees.filter((e) => employeeState(e) === "ON_BREAK").length,
      OFF_SHIFT: employees.filter((e) => employeeState(e) === "OFF_SHIFT").length,
    }),
    [employees]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (tab !== "ALL" && employeeState(e) !== tab) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.position ?? "").toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q) ||
        (e.employeeCode ?? "").toLowerCase().includes(q)
      );
    });
  }, [employees, query, tab]);

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-4 pt-4 sm:max-w-3xl sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to market"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/10 active:scale-95"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[22px] font-bold leading-tight text-white">
            {loading ? "Employees" : overview?.name}
          </h1>
          <p className="text-[12px] text-[#8B93A8]">
            {loading ? "Loading team…" : `${counts.ALL} Employee${counts.ALL === 1 ? "" : "s"} · ${counts.ACTIVE} Active Now`}
          </p>
        </div>
      </div>

      <div className="relative mt-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6479]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employees…"
          aria-label="Search employees"
          className="w-full rounded-xl border border-white/[0.07] bg-[#111A2D]/80 py-2.5 pl-10 pr-9 text-[13.5px] text-white outline-none backdrop-blur-xl transition-colors placeholder:text-[#4C5266] focus:border-[#F47A20]/50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear employee search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#5C6479] transition-colors hover:text-white"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          {TABS.map((t) => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={isActive}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-200 ${
                  isActive
                    ? "border-[#F47A20]/50 bg-[#F47A20]/[0.14] text-white shadow-[0_0_16px_-5px_rgba(244,122,32,0.8)]"
                    : "border-white/[0.07] bg-[#111A2D]/70 text-[#8B93A8] hover:border-white/[0.16] hover:text-white"
                }`}
              >
                {t.dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
                {t.label}
                <span className={isActive ? "text-[#F9A03C]" : "text-[#5C6479]"}>({counts[t.key]})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3.5 space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-2.5 sm:space-y-0">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[86px] animate-pulse rounded-[18px] border border-white/[0.06] bg-[#111A2D]/60" />
          ))
        ) : error ? (
          <div className="sm:col-span-2">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/70 px-6 py-10 text-center sm:col-span-2">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F47A20]/10 text-[#F47A20]">
              <Users2 size={20} />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-white">
              {employees.length === 0 ? "No employees yet" : "No one matches"}
            </p>
            <p className="mt-1 text-[12.5px] text-[#8B93A8]">
              {employees.length === 0
                ? "Employees assigned to this market will appear here."
                : "Try a different search or status filter."}
            </p>
          </div>
        ) : (
          filtered.map((e, i) => (
            <MarketEmployeeCard key={e.id} employee={e} index={i} onOpen={() => onOpenEmployee(e.id)} />
          ))
        )}
      </div>
    </div>
  );
}
