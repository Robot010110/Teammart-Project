import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Plus, Store, X, RotateCw } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import MarketCard from "../components/markets/MarketCard";
import AddMarketModal from "../components/markets/AddMarketModal";
import { listMarkets } from "../services/marketService";

// The three real MarketStatus values, plus the "All" pseudo-filter.
// "Inactive" is the UI wording for CLOSED — the enum itself is never
// renamed, only how it reads on screen.
const STATUS_TABS = [
  { key: "ALL", label: "All", dot: null },
  { key: "ACTIVE", label: "Active", dot: "bg-emerald-400" },
  { key: "MAINTENANCE", label: "Maintenance", dot: "bg-amber-400" },
  { key: "CLOSED", label: "Inactive", dot: "bg-red-400" },
];

function MarketCardSkeleton() {
  // Matches the real card's box exactly (thumbnail + two text lines +
  // divider + footer row) so the list does not reflow when data lands.
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-[#111A2D]/60 p-3">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-2/5 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-2.5 w-3/5 animate-pulse rounded bg-white/[0.04]" />
        </div>
      </div>
      <div className="mt-2.5 border-t border-white/[0.05] pt-2.5">
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

// MarketsPage.jsx — the Regional Manager's Markets tab.
//
// Real data only: GET /api/markets, which is scoped server-side to the
// zones this account actually manages (marketsController.listMarkets) —
// this page never filters for permission, it only filters for the user's
// convenience. Search and the status tabs both operate on that real
// list; there is no decorative filtering here.
//
// Client-side filtering is deliberate and unchanged from before: a
// Regional Manager's market list is small (tens, not thousands), so
// round-tripping every keystroke to the server would be slower and no
// more correct.
export default function MarketsPage() {
  const { data: markets, error, loading, reload, setData } = useAsync(listMarkets, { deps: [] });
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [supervisor, setSupervisor] = useState("ALL");
  const [zone, setZone] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const all = markets ?? [];

  // Zone/supervisor options come from the loaded markets themselves, so
  // they can never offer a value that filters to nothing.
  const zoneOptions = useMemo(() => [...new Set(all.map((m) => m.zoneNumber))].sort((a, b) => a - b), [all]);
  const supervisorOptions = useMemo(
    () => [...new Set(all.map((m) => m.supervisor).filter((s) => s && s !== "Unassigned"))].sort(),
    [all]
  );

  const counts = useMemo(
    () => ({
      ALL: all.length,
      ACTIVE: all.filter((m) => m.status === "ACTIVE").length,
      MAINTENANCE: all.filter((m) => m.status === "MAINTENANCE").length,
      CLOSED: all.filter((m) => m.status === "CLOSED").length,
    }),
    [all]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((m) => {
      if (status !== "ALL" && m.status !== status) return false;
      if (zone !== "ALL" && String(m.zoneNumber) !== String(zone)) return false;
      if (supervisor !== "ALL" && m.supervisor !== supervisor) return false;
      if (!q) return true;
      // Name, supervisor, overlooking supervisor and zone are all real
      // fields on the market row — "location" in the brief maps to zone
      // here, since a market has no separate address field.
      return (
        m.name.toLowerCase().includes(q) ||
        (m.supervisor ?? "").toLowerCase().includes(q) ||
        (m.overlookingSupervisor ?? "").toLowerCase().includes(q) ||
        `zone ${m.zoneNumber}`.includes(q)
      );
    });
  }, [all, query, status, zone, supervisor]);

  const activeFilterCount = (status !== "ALL" ? 1 : 0) + (zone !== "ALL" ? 1 : 0) + (supervisor !== "ALL" ? 1 : 0);
  const zoneSummary = zoneOptions.length === 1 ? `Zone ${zoneOptions[0]}` : `${zoneOptions.length} zones`;

  function clearFilters() {
    setStatus("ALL"); setZone("ALL"); setSupervisor("ALL"); setQuery("");
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-4 pt-5 sm:max-w-3xl sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold leading-tight text-white">Markets</h1>
          <p className="mt-0.5 text-[12.5px] text-[#8B93A8]">
            {loading ? "Loading markets…" : `${all.length} market${all.length === 1 ? "" : "s"} in ${zoneSummary}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F47A20] to-[#E0561A] px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_20px_-6px_rgba(244,122,32,0.85)] transition-all duration-200 hover:from-[#ff8b36] hover:to-[#F47A20] active:scale-[0.97]"
        >
          <Plus size={15} /> Add Market
        </button>
      </header>

      <div className="mt-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6479]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets, supervisors…"
            aria-label="Search markets"
            className="w-full rounded-xl border border-white/[0.07] bg-[#111A2D]/80 py-2.5 pl-10 pr-9 text-[13.5px] text-white outline-none backdrop-blur-xl transition-colors placeholder:text-[#4C5266] focus:border-[#F47A20]/50"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
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

      {/* Status tabs — horizontally scrollable so four chips never wrap
          or shrink on a 360px screen. */}
      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          {STATUS_TABS.map((t) => {
            const isActive = status === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatus(t.key)}
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

      {/* Zone + Supervisor live behind the filter button so the default
          view stays as compact as the brief asks. */}
      {showFilters && (
        <div className="mt-3 animate-fade-up rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-3 backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-[#8B93A8]">Zone</span>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-[#F47A20]/50"
              >
                <option value="ALL" className="bg-[#1F2436]">All zones</option>
                {zoneOptions.map((z) => <option key={z} value={z} className="bg-[#1F2436]">Zone {z}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-[#8B93A8]">Supervisor</span>
              <select
                value={supervisor}
                onChange={(e) => setSupervisor(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-[#F47A20]/50"
              >
                <option value="ALL" className="bg-[#1F2436]">All supervisors</option>
                {supervisorOptions.map((s) => <option key={s} value={s} className="bg-[#1F2436]">{s}</option>)}
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

      <div className="mt-3.5 space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-2.5 sm:space-y-0">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <MarketCardSkeleton key={i} />)
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6 text-center sm:col-span-2">
            <p className="text-[13.5px] font-semibold text-white">Couldn't load your markets</p>
            <p className="mt-1 text-[12px] text-[#9AA1B4]">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/[0.1]"
            >
              <RotateCw size={13} /> Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/70 px-6 py-10 text-center sm:col-span-2">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F47A20]/10 text-[#F47A20]">
              <Store size={20} />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-white">
              {all.length === 0 ? "No markets yet" : "No markets match"}
            </p>
            <p className="mt-1 text-[12.5px] text-[#8B93A8]">
              {all.length === 0
                ? "Markets you add to your zones will appear here."
                : "Try a different search or clear your filters."}
            </p>
            {all.length === 0 ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F47A20] to-[#E0561A] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_20px_-6px_rgba(244,122,32,0.85)]"
              >
                <Plus size={14} /> Add your first market
              </button>
            ) : (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/[0.1]"
              >
                <RotateCw size={13} /> Clear filters
              </button>
            )}
          </div>
        ) : (
          filtered.map((m, i) => (
            <MarketCard key={m.id} market={m} index={i} onOpen={() => navigate(`/rm/markets/${m.id}`)} />
          ))
        )}
      </div>

      <AddMarketModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(created) => {
          // The create response is a bare Market row; the list rows carry
          // computed fields (counts, rating, last visit) that only
          // listMarkets produces — so refetch rather than fabricating
          // them client-side. The optimistic insert below just keeps the
          // new market on screen during that refetch.
          setData((prev) =>
            prev
              ? [...prev, {
                  ...created,
                  zoneNumber: created.zoneNumber ?? zoneOptions[0] ?? 0,
                  supervisor: "Unassigned",
                  overlookingSupervisor: "Unassigned",
                  employeesCount: 0,
                  activeCount: 0,
                  currentRating: null,
                  lastVisitDate: null,
                }]
              : prev
          );
          reload();
        }}
      />
    </div>
  );
}
