import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronRight, Store, Users2, X, SlidersHorizontal, RotateCw, ShieldCheck, Clock3 } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import { listEmployees } from "../services/staffEmployeeService";
import { listMarkets, listAccessibleSupervisors } from "../services/marketService";
import { initialsOf } from "../utils/initials";

// Only the roles this organisation actually has. EmployeeRole still
// carries a BUTCHER value in the schema (and Admin-side code that reads
// it), but no employee in this system holds it and it is not part of the
// structure — so it is deliberately not offered as a filter here. Nothing
// is hidden by doing so: with no BUTCHER employees, "All" is still
// genuinely everyone.
const ROLE_LABEL = { WORKER: "Worker", CASHIER: "Cashier" };
const SHIFT_OPTIONS = ["MORNING", "EVENING", "NIGHT"];

const TABS = [
  { key: "ALL", label: "All" },
  { key: "SUPERVISORS", label: "Supervisors" },
  { key: "CASHIER", label: "Cashiers" },
  { key: "WORKER", label: "Workers" },
];

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function Avatar({ src, name, ring }) {
  return (
    <span
      className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[12.5px] font-bold text-white ring-1 ${
        ring ?? "ring-white/10"
      }`}
    >
      {src ? <AuthenticatedImage src={src} alt="" className="h-full w-full object-cover" /> : initialsOf(name)}
    </span>
  );
}

function StatusChip({ tone, label }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-medium ring-1 ring-inset ${tone.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {label}
    </span>
  );
}

const LIVE = {
  ACTIVE: { chip: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/25", dot: "bg-emerald-400" },
  ON_BREAK: { chip: "bg-amber-500/12 text-amber-400 ring-amber-500/25", dot: "bg-amber-400" },
  OFF: { chip: "bg-white/[0.06] text-[#8B93A8] ring-white/10", dot: "bg-[#4C5266]" },
};

function PersonRow({ avatarUrl, name, roleLabel, marketName, shift, code, tone, statusLabel, onOpen, index, accentRing }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className="animate-fade-up group flex w-full items-center gap-3 rounded-[18px] border border-white/[0.07] bg-[#111A2D]/80 p-3 text-left backdrop-blur-xl
                 transition-all duration-200 hover:border-[#F47A20]/30 hover:bg-[#131E33]/90 active:scale-[0.985]"
    >
      <Avatar src={avatarUrl} name={name} ring={accentRing} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">{name}</p>
          {statusLabel && <StatusChip tone={tone} label={statusLabel} />}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-[#8B93A8]">
          {roleLabel}
          {marketName && (
            <>
              <span className="text-[#3A4155]">·</span>
              <Store size={11} className="shrink-0" />
              <span className="truncate">{marketName}</span>
            </>
          )}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-[10.5px] text-[#5C6479]">
          {shift && (
            <span className="flex items-center gap-1">
              <Clock3 size={10} /> {shift}
            </span>
          )}
          {code && <span className="tabular-nums">{code}</span>}
        </p>
      </div>

      <ChevronRight size={16} className="shrink-0 text-[#4C5266] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#F47A20]" />
    </button>
  );
}

function PersonSkeleton() {
  return <div className="h-[86px] animate-pulse rounded-[18px] border border-white/[0.06] bg-[#111A2D]/60" />;
}

// RmEmployeesPage.jsx — the Regional Manager's people directory across
// every market they manage.
//
// Two real sources, one list:
//   Workers/Cashiers  GET /api/employees (employeesController.listEmployees)
//                     — server-side market/role/shift/search filtering,
//                     already scoped to the RM's own zones.
//   Supervisors       GET /api/markets/supervisors — derived from the
//                     markets this account can reach (a supervisor is a
//                     User assigned to a market, not a separate model).
//
// Both are scoped server-side; nothing here filters for permission, only
// for what the user asked to look at.
export default function RmEmployeesPage() {
  const [tab, setTab] = useState("ALL");
  const [marketId, setMarketId] = useState("");
  const [shift, setShift] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 300);
  const navigate = useNavigate();

  const { data: markets } = useAsync(listMarkets, { deps: [] });

  // Employee role sent to the server only when a concrete employee role
  // is selected — "Supervisors" is not an EmployeeRole, so that tab
  // simply shows no employees rather than sending a bogus filter.
  const employeeRole = tab === "WORKER" || tab === "CASHIER" ? tab : undefined;
  const skipEmployees = tab === "SUPERVISORS";

  const { data: employees, error, loading, reload } = useAsync(
    () =>
      skipEmployees
        ? Promise.resolve([])
        : listEmployees({
            marketId: marketId || undefined,
            role: employeeRole,
            shift: shift || undefined,
            search: search || undefined,
          }),
    { deps: [tab, marketId, shift, search] }
  );

  const { data: supervisors, error: supError, loading: supLoading, reload: reloadSup } = useAsync(listAccessibleSupervisors, { deps: [] });

  const marketNameById = useMemo(() => new Map((markets ?? []).map((m) => [m.id, m.name])), [markets]);

  // Supervisors are filtered client-side: the whole directory is a
  // handful of rows (one per market at most), so a round trip per
  // keystroke would be slower and no more correct.
  const visibleSupervisors = useMemo(() => {
    if (tab === "WORKER" || tab === "CASHIER") return [];
    const q = search.trim().toLowerCase();
    return (supervisors ?? []).filter((s) => {
      if (marketId && s.market.id !== marketId) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.loginId ?? "").toLowerCase().includes(q);
    });
  }, [supervisors, tab, marketId, search]);

  const employeeList = employees ?? [];
  const counts = {
    ALL: employeeList.length + visibleSupervisors.length,
    SUPERVISORS: visibleSupervisors.length,
  };

  const totalShown = counts.ALL;
  const activeFilterCount = (marketId ? 1 : 0) + (shift ? 1 : 0);
  const anyLoading = loading || supLoading;

  function clearFilters() {
    setMarketId("");
    setShift("");
    setSearchInput("");
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-4 pt-5 sm:max-w-3xl sm:px-6">
      <header>
        <h1 className="font-display text-[26px] font-bold leading-tight text-white">Employees</h1>
        <p className="mt-0.5 text-[12.5px] text-[#8B93A8]">
          {anyLoading
            ? "Loading your people…"
            : `${totalShown} ${tab === "SUPERVISORS" ? (totalShown === 1 ? "supervisor" : "supervisors") : totalShown === 1 ? "person" : "people"} across your markets`}
        </p>
      </header>

      <div className="mt-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6479]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or employee code…"
            aria-label="Search people"
            className="w-full rounded-xl border border-white/[0.07] bg-[#111A2D]/80 py-2.5 pl-10 pr-9 text-[13.5px] text-white outline-none backdrop-blur-xl transition-colors placeholder:text-[#4C5266] focus:border-[#F47A20]/50"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#5C6479] transition-colors hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          aria-label="Filters"
          className={`relative grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border backdrop-blur-xl transition-all duration-200 ${
            showFilters || activeFilterCount > 0
              ? "border-[#F47A20]/45 bg-[#F47A20]/[0.12] text-[#F47A20]"
              : "border-white/[0.07] bg-[#111A2D]/80 text-[#8B93A8] hover:text-white"
          }`}
        >
          <SlidersHorizontal size={16} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#F47A20] px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
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
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-200 ${
                  isActive
                    ? "border-[#F47A20]/50 bg-[#F47A20]/[0.14] text-white shadow-[0_0_16px_-5px_rgba(244,122,32,0.8)]"
                    : "border-white/[0.07] bg-[#111A2D]/70 text-[#8B93A8] hover:border-white/[0.16] hover:text-white"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {showFilters && (
        <div className="mt-3 animate-fade-up rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-3 backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-[#8B93A8]">Market</span>
              <select
                value={marketId}
                onChange={(e) => setMarketId(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-[#F47A20]/50"
              >
                <option value="" className="bg-[#1F2436]">All markets</option>
                {(markets ?? []).map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#1F2436]">{m.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-[#8B93A8]">Shift</span>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                disabled={tab === "SUPERVISORS"}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-[#F47A20]/50 disabled:opacity-50"
              >
                <option value="" className="bg-[#1F2436]">All shifts</option>
                {SHIFT_OPTIONS.map((s) => (
                  <option key={s} value={s} className="bg-[#1F2436]">{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </label>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-[#F47A20] transition-colors hover:text-[#ff9a4d]"
            >
              <RotateCw size={12} /> Reset filters
            </button>
          )}
        </div>
      )}

      <div className="mt-3.5 space-y-2.5">
        {anyLoading ? (
          Array.from({ length: 6 }).map((_, i) => <PersonSkeleton key={i} />)
        ) : error || supError ? (
          <ErrorBanner
            message={error || supError}
            onRetry={() => {
              if (error) reload();
              if (supError) reloadSup();
            }}
          />
        ) : totalShown === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/70 px-6 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F47A20]/10 text-[#F47A20]">
              <Users2 size={20} />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-white">No one matches</p>
            <p className="mt-1 text-[12.5px] text-[#8B93A8]">Try a different search, role or filter.</p>
          </div>
        ) : (
          <>
            {/* Supervisors first — they're the management layer, and
                there are only ever a handful. */}
            {visibleSupervisors.map((s, i) => (
              <PersonRow
                key={`sup-${s.id}`}
                index={i}
                avatarUrl={s.profilePictureUrl}
                name={s.name}
                roleLabel={s.kind === "OVERLOOKING" ? "Overlooking Supervisor" : "Supervisor"}
                marketName={s.market?.name}
                code={s.loginId}
                accentRing="ring-[#F47A20]/40"
                tone={s.onBreak ? LIVE.ON_BREAK : s.onShift ? LIVE.ACTIVE : LIVE.OFF}
                statusLabel={s.onBreak ? "On Break" : s.onShift ? "Active" : "Off Shift"}
                onOpen={() => navigate(`/rm/employees/supervisors/${s.id}`)}
              />
            ))}

            {employeeList.map((e, i) => (
              <PersonRow
                key={e.id}
                index={visibleSupervisors.length + i}
                avatarUrl={e.profilePictureUrl}
                name={e.name}
                roleLabel={ROLE_LABEL[e.role] ?? e.position}
                marketName={marketNameById.get(e.marketId)}
                shift={e.cashierShift ?? e.shift ?? null}
                code={e.employeeCode}
                onOpen={() => navigate(`/rm/markets/${e.marketId}/employees/${e.id}`)}
              />
            ))}
          </>
        )}
      </div>

      {!anyLoading && tab === "SUPERVISORS" && visibleSupervisors.length > 0 && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#5C6479]">
          <ShieldCheck size={11} /> Supervisors are shown for the markets you manage
        </p>
      )}
    </div>
  );
}
