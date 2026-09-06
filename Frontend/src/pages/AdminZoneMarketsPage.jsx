import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Layers, Store, ChevronRight, Search, Plus,
  ShieldCheck, Crown, Users2,
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import AddMarketModal from "../components/markets/AddMarketModal";
import AdminStaffActionsPanel from "./AdminStaffActionsPanel";
import { getZone } from "../services/zoneService";
import { listStaffAccounts } from "../services/authService";
import { initialsOf } from "../utils/initials";

// Decorative only — a rotating accent so a grid of markets doesn't read
// as one repeated tile, exactly as the reference does it. Not tied to
// market status (the status pill below already carries that real
// meaning); this is purely "make six identical cards visually distinct."
const ACCENTS = [
  { icon: "text-[#9DBBFF] bg-gradient-to-br from-[#7EA6FF]/40 to-[#7EA6FF]/8 ring-[#7EA6FF]/50 shadow-[0_0_14px_-1px_rgba(126,166,255,0.75)]", border: "border-[#7EA6FF]/20", borderHover: "group-hover:border-[#7EA6FF]/45" },
  { icon: "text-[#D8C2FF] bg-gradient-to-br from-[#C08BFF]/40 to-[#C08BFF]/8 ring-[#C08BFF]/50 shadow-[0_0_14px_-1px_rgba(192,139,255,0.75)]", border: "border-[#C08BFF]/20", borderHover: "group-hover:border-[#C08BFF]/45" },
  { icon: "text-emerald-300 bg-gradient-to-br from-emerald-400/40 to-emerald-400/8 ring-emerald-400/50 shadow-[0_0_14px_-1px_rgba(52,211,153,0.75)]", border: "border-emerald-400/20", borderHover: "group-hover:border-emerald-400/45" },
  { icon: "text-amber-300 bg-gradient-to-br from-amber-400/40 to-amber-400/8 ring-amber-400/50 shadow-[0_0_14px_-1px_rgba(251,191,36,0.75)]", border: "border-amber-400/20", borderHover: "group-hover:border-amber-400/45" },
  { icon: "text-red-300 bg-gradient-to-br from-red-400/40 to-red-400/8 ring-red-400/50 shadow-[0_0_14px_-1px_rgba(248,113,113,0.75)]", border: "border-red-400/20", borderHover: "group-hover:border-red-400/45" },
  { icon: "text-[#A5B4FC] bg-gradient-to-br from-[#818CF8]/40 to-[#818CF8]/8 ring-[#818CF8]/50 shadow-[0_0_14px_-1px_rgba(129,140,248,0.75)]", border: "border-[#818CF8]/20", borderHover: "group-hover:border-[#818CF8]/45" },
];

// getZone's own shaping title-cases the raw MarketStatus enum ("CLOSED"
// -> "Closed"); relabeled here only for the word "Inactive", matching
// the exact label MarketCard.jsx already uses everywhere else in the
// app for this same status — a display-only mapping, not a data change.
const STATUS_META = {
  Active: { label: "Active", tone: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/30 shadow-[0_0_10px_-3px_rgba(52,211,153,0.6)]" },
  Maintenance: { label: "Maintenance", tone: "bg-amber-500/12 text-amber-400 ring-amber-500/30 shadow-[0_0_10px_-3px_rgba(251,191,36,0.6)]" },
  Closed: { label: "Inactive", tone: "bg-red-500/12 text-red-400 ring-red-500/30 shadow-[0_0_10px_-3px_rgba(248,113,113,0.6)]" },
};

const STAFF_ROLE_META = {
  SUPERVISOR: { label: "Supervisor", icon: ShieldCheck, tone: "text-[#A5B4FC] bg-[#818CF8]/15 ring-[#818CF8]/35 shadow-[0_0_10px_-3px_rgba(129,140,248,0.7)]" },
  OVERLOOKING_SUPERVISOR: { label: "Overlooking Sup.", icon: ShieldCheck, tone: "text-[#A5B4FC] bg-[#818CF8]/15 ring-[#818CF8]/35 shadow-[0_0_10px_-3px_rgba(129,140,248,0.7)]" },
  REGIONAL_MANAGER: { label: "Regional Manager", icon: Crown, tone: "text-[#FBBF24] bg-[#FBBF24]/15 ring-[#FBBF24]/35 shadow-[0_0_10px_-3px_rgba(251,191,36,0.7)]" },
};

function MarketTile({ market, accent, onOpen, index }) {
  const statusMeta = STATUS_META[market.status] ?? STATUS_META.Active;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
      className={`group animate-fade-up relative overflow-hidden rounded-2xl border ${accent.border} ${accent.borderHover} bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 p-4 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]`}
    >
      <div className="flex items-start justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ring-2 ring-inset ${accent.icon}`}>
          <Store size={18} />
        </span>
        <ChevronRight size={16} className="mt-2.5 shrink-0 text-[#4C5266] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[#F47A20]" />
      </div>
      <p className="mt-3 truncate font-display text-[15px] font-bold text-white">{market.name}</p>
      <p className="mt-1 text-[12px] text-[#8B93A8]">{market.employees} employee{market.employees === 1 ? "" : "s"}</p>
      <span className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusMeta.tone}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {statusMeta.label}
      </span>
    </button>
  );
}

// AdminZoneMarketsPage.jsx — the markets (and staff) inside ONE zone,
// reached by tapping a zone on AdminZonesPage. Zones & Markets previously
// stopped at the zone list; there was no way to drill from a zone into
// what's actually in it.
//
// Both real, already-authorized endpoints, no backend changes:
//   - GET /api/zones/:id — the zone's own header AND its market grid.
//     Using the server's own zone-scoped `markets` array (rather than
//     fetching every company market and filtering client-side, the
//     previous version of this file) means a market from another zone
//     can never appear here even if a future client bug filtered wrong —
//     the server already only sent this zone's own rows.
//   - GET /api/auth/staff (ADMIN-only) for the Zone Staff tab: the same
//     "only a real market/zone assignment counts" rule AdminPeoplePage
//     uses, scoped here to markets/zones that belong to this specific
//     zone (matched against the ids getZone already returned above).
//
// "Reports" was in the reference but is deliberately not a tab here:
// AdminReportsPage.jsx has no zone-scoping of its own, so a "Reports"
// tab would open the exact same unscoped page regardless of which zone
// sent you there — not a real per-zone destination.
//
// Opening a market goes to the existing /admin/markets/:marketId detail
// page — the same real profile (employees, supervisor, activity, sales)
// Admin already has, not a new one.
export default function AdminZoneMarketsPage({ zoneId, onOpenMarket, onBack }) {
  const navigate = useNavigate();
  const { data: zone, error: zoneError, loading: zoneLoading, reload: reloadZone } = useAsync(() => getZone(zoneId), { deps: [zoneId] });
  const { data: staffAccounts, error: staffError, loading: staffLoading } = useAsync(() => listStaffAccounts(), { deps: [] });

  const [tab, setTab] = useState("markets");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [manageStaff, setManageStaff] = useState(null);

  const markets = zone?.markets ?? [];
  const marketIds = useMemo(() => new Set(markets.map((m) => m.id)), [markets]);
  const filteredMarkets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? markets.filter((m) => m.name.toLowerCase().includes(q)) : markets;
  }, [markets, search]);

  const activeCount = markets.filter((m) => m.status === "Active").length;
  const totalEmployees = markets.reduce((sum, m) => sum + m.employees, 0);

  // Real staff assigned to THIS zone only — a Supervisor/Overlooking
  // whose market is one of this zone's own market ids, or a Regional
  // Manager whose managedZones includes this zone. Same "only a real
  // assignment counts" exclusion AdminPeoplePage uses, so a leftover/
  // orphaned staff row never appears here either.
  const zoneStaff = useMemo(() => {
    return (staffAccounts ?? [])
      .filter((u) => {
        if (u.role === "REGIONAL_MANAGER") return (u.managedZones ?? []).some((z) => String(z.id) === String(zoneId));
        const market = u.managedMarket ?? u.managedOverlookingMarket;
        return market && marketIds.has(market.id);
      })
      .map((u) => ({
        ...u,
        roleKey: u.role === "SUPERVISOR" && u.managedOverlookingMarket ? "OVERLOOKING_SUPERVISOR" : u.role,
        marketName: (u.managedMarket ?? u.managedOverlookingMarket)?.name ?? null,
      }));
  }, [staffAccounts, marketIds, zoneId]);

  function openStaff(person) {
    const market = person.managedMarket ?? person.managedOverlookingMarket;
    if (person.role !== "REGIONAL_MANAGER" && market) {
      navigate(`/admin/markets/${market.id}/supervisors/${person.id}`);
    } else {
      setManageStaff(person); // Regional Manager: no dedicated profile route yet — the real admin panel is the closest genuine destination
    }
  }

  const loading = zoneLoading;

  return (
    <div className="max-w-6xl mx-auto animate-fade-up">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1 transition-colors duration-150"
      >
        <ArrowLeft size={15} /> Back to Zones
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#F47A20]/40 to-[#F47A20]/10 ring-2 ring-inset ring-[#F47A20]/50 shadow-[0_0_16px_1px_rgba(244,122,32,0.55)]">
            <Layers size={20} className="text-[#FFB578]" />
          </span>
          <div>
            <h1 className="font-display text-[22px] font-bold text-white">{loading ? "Zone" : `Zone ${zone.number}`}</h1>
            <p className="mt-0.5 text-[13px] text-[#9AA1B4]">
              {loading ? "Loading..." : `Manager: ${zone.manager} · ${markets.length} market${markets.length === 1 ? "" : "s"} · ${totalEmployees} employee${totalEmployees === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        {!loading && markets.length > 0 && (
          <span
            className={`self-start inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold ring-1 ring-inset ${
              activeCount === markets.length
                ? "bg-emerald-500/12 text-emerald-400 ring-emerald-500/30 shadow-[0_0_10px_-3px_rgba(52,211,153,0.6)]"
                : activeCount > 0
                  ? "bg-amber-500/12 text-amber-400 ring-amber-500/30 shadow-[0_0_10px_-3px_rgba(251,191,36,0.6)]"
                  : "bg-red-500/12 text-red-400 ring-red-500/30 shadow-[0_0_10px_-3px_rgba(248,113,113,0.6)]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> {activeCount}/{markets.length} Active
          </span>
        )}
      </div>

      {/* Markets / Zone Staff — both real destinations; see this file's
          header comment for why "Reports" isn't a third tab. */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "markets", label: "Markets", icon: Store, count: markets.length },
          { key: "staff", label: "Zone Staff", icon: Users2, count: zoneStaff.length },
        ].map((v) => {
          const Icon = v.icon;
          const activeTab = tab === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setTab(v.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                activeTab
                  ? "bg-gradient-to-b from-[#F47A20]/25 to-[#F47A20]/[0.08] text-[#FFA35C] ring-1 ring-[#F47A20]/50 shadow-[0_0_22px_-6px_rgba(244,122,32,0.8)]"
                  : "bg-[#111A2D]/80 text-[#8B93A8] ring-1 ring-white/[0.06] hover:text-white hover:bg-white/[0.05] hover:ring-white/[0.12]"
              }`}
            >
              <Icon size={15} /> {v.label} {!loading && `(${v.count})`}
            </button>
          );
        })}
      </div>

      {tab === "markets" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5266]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search markets..."
                className="w-full rounded-xl bg-gradient-to-b from-[#131C31]/90 to-[#0F1728]/90 border border-white/[0.09] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#5C6479] outline-none transition-all duration-150 focus:border-[#F47A20]/55 focus:shadow-[0_0_0_3px_rgba(244,122,32,0.15)]"
              />
            </div>
            {!loading && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#F47A20] to-[#E0561A] shadow-[0_4px_24px_-6px_rgba(244,122,32,0.75)] ring-1 ring-white/10 transition-all duration-150 hover:from-[#ff8b36] hover:to-[#F47A20] active:scale-[0.97]"
              >
                <Plus size={15} /> New Market
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-[150px]" />)}
            </div>
          ) : zoneError ? (
            <ErrorBanner message={zoneError} onRetry={reloadZone} />
          ) : markets.length === 0 ? (
            <div className="rounded-2xl p-10 bg-[#111A2D]/80 border border-white/[0.07] text-center text-sm text-[#8B93A8]">
              No markets in this zone yet.
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div className="rounded-2xl p-10 bg-[#111A2D]/80 border border-white/[0.07] text-center text-sm text-[#8B93A8]">
              No matching markets found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMarkets.map((m, i) => (
                <MarketTile key={m.id} market={m} accent={ACCENTS[i % ACCENTS.length]} index={i} onOpen={() => onOpenMarket(m.id)} />
              ))}
            </div>
          )}
        </>
      ) : staffLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-[64px]" />)}</div>
      ) : staffError ? (
        <ErrorBanner message={staffError} />
      ) : zoneStaff.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[#111A2D]/80 border border-white/[0.07] text-center text-sm text-[#8B93A8]">
          No staff assigned to this zone yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#101A2E]/90 to-[#0A0F1D]/90 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl divide-y divide-white/[0.05]">
          {zoneStaff.map((person, i) => {
            const roleMeta = STAFF_ROLE_META[person.roleKey] ?? STAFF_ROLE_META.SUPERVISOR;
            const RoleIcon = roleMeta.icon;
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => openStaff(person)}
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                className="animate-fade-up flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[11px] font-bold text-white ring-1 ring-white/10">
                  {initialsOf(person.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-white truncate">{person.name}</p>
                  <p className="text-[11.5px] text-[#6B7284]">{person.marketName ?? `Zone ${zone?.number}`}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${roleMeta.tone}`}>
                  <RoleIcon size={12} /> {roleMeta.label}
                </span>
                <ChevronRight size={15} className="shrink-0 text-[#4C5266]" />
              </button>
            );
          })}
        </div>
      )}

      {addOpen && zone && (
        <AddMarketModal
          open={addOpen}
          defaultZoneNumber={zone.number}
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); reloadZone(); }}
        />
      )}

      {manageStaff && (
        <AdminStaffActionsPanel
          staff={manageStaff}
          onClose={() => setManageStaff(null)}
          onChanged={() => setManageStaff(null)}
        />
      )}
    </div>
  );
}
