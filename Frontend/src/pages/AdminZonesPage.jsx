import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Store, Users, Gauge, Plus, Check, Loader2, UserCog, ChevronRight, Search } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import AdminKpiCard from "../components/admin/AdminKpiCard";
import Modal from "../components/common/Modal";
import { ApiError } from "../services/apiClient";
import { listZones, createZone, assignZoneManager } from "../services/zoneService";
import { listMarkets } from "../services/marketService";
import { listStaffAccounts } from "../services/authService";

// A zone's own id comes back prefixed ("zone-3" — see
// zonesController.shapeZoneSummary, kept for compatibility with how the
// frontend originally modeled zones) everywhere except the PATCH/DELETE
// routes, which take the raw numeric id. This is the one place that
// needs to know that.
function rawZoneId(zone) {
  return Number(String(zone.id).replace("zone-", ""));
}

// AdminZonesPage.jsx — ADMIN-only: browse the organization by zone,
// create zones, and assign/unassign each zone's Regional Manager (PATCH
// /api/zones/:id/manager). Every zone company-wide (GET /api/zones is
// unscoped for ADMIN).
//
// Visual pass + one addition: this also fetches GET /api/markets (the
// same company-wide list AdminPeoplePage/AdminMarketsPage already use)
// purely to compute real, derived numbers no endpoint currently returns
// on its own — organization-wide totals for the KPI row, and each zone's
// own "N/M Active" count. No backend change: Zone has no status field of
// its own (schema.prisma), so a per-zone "Active" pill would otherwise
// have to be invented; this instead aggregates Market.status (which IS
// real) across that zone's markets, entirely client-side.
export default function AdminZonesPage() {
  const navigate = useNavigate();
  const { data: zones, error: zonesError, loading: zonesLoading, reload } = useAsync(listZones, { deps: [] });
  const { data: markets, error: marketsError, loading: marketsLoading } = useAsync(listMarkets, { deps: [] });
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [assigningZone, setAssigningZone] = useState(null);

  const loading = zonesLoading || marketsLoading;
  const error = zonesError || marketsError;

  // Active-market count per zone, derived from the same real Market rows
  // the company-wide Markets list already shows — never estimated.
  const activeByZone = useMemo(() => {
    const map = new Map();
    for (const m of markets ?? []) {
      const entry = map.get(m.zoneId) ?? { active: 0, total: 0 };
      entry.total += 1;
      if (m.status === "ACTIVE") entry.active += 1;
      map.set(m.zoneId, entry);
    }
    return map;
  }, [markets]);

  const kpi = useMemo(() => {
    const totalMarkets = (markets ?? []).length;
    const activeMarkets = (markets ?? []).filter((m) => m.status === "ACTIVE").length;
    const totalEmployees = (markets ?? []).reduce((sum, m) => sum + m.employeesCount, 0);
    return {
      totalZones: (zones ?? []).length,
      totalMarkets,
      totalEmployees,
      activePct: totalMarkets > 0 ? Math.round((activeMarkets / totalMarkets) * 100) : null,
    };
  }, [zones, markets]);

  const filteredZones = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return zones ?? [];
    return (zones ?? []).filter(
      (z) => `zone ${z.number}`.includes(q) || z.manager.toLowerCase().includes(q)
    );
  }, [zones, search]);

  return (
    <div className="max-w-6xl mx-auto animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h1 className="font-display text-xl md:text-[26px] font-bold text-white">Zones & Markets</h1>
          <p className="mt-1 text-sm text-[#9AA1B4]">Manage all zones and markets across your company</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5266]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search zones..."
              className="w-56 rounded-xl bg-gradient-to-b from-[#131C31]/90 to-[#0F1728]/90 border border-white/[0.09] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#5C6479] outline-none transition-all duration-150 focus:border-[#F47A20]/55 focus:shadow-[0_0_0_3px_rgba(244,122,32,0.15)]"
            />
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#F47A20] to-[#E0561A] shadow-[0_4px_24px_-6px_rgba(244,122,32,0.75)] ring-1 ring-white/10 transition-all duration-150 hover:from-[#ff8b36] hover:to-[#F47A20] hover:shadow-[0_4px_28px_-4px_rgba(244,122,32,0.9)] active:scale-[0.97]"
          >
            <Plus size={15} /> New Zone
          </button>
        </div>
      </div>

      {/* KPIs — organization-wide, derived from real Zone + Market rows */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <AdminKpiCard icon={Layers} tone="blue" value={loading ? undefined : kpi.totalZones} label="Total Zones" loading={loading} />
        <AdminKpiCard icon={Store} tone="green" value={loading ? undefined : kpi.totalMarkets} label="Total Markets" loading={loading} />
        <AdminKpiCard icon={Users} tone="purple" value={loading ? undefined : kpi.totalEmployees} label="Total Employees" loading={loading} />
        <AdminKpiCard icon={Gauge} tone="amber" value={loading ? undefined : (kpi.activePct === null ? "—" : `${kpi.activePct}%`)} label="Active Markets" loading={loading} />
      </div>

      <div>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[86px]" />)}</div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : (zones ?? []).length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#111A2D]/80 border border-white/[0.07] text-center text-sm text-[#8B93A8]">
            No zones found.
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#111A2D]/80 border border-white/[0.07] text-center text-sm text-[#8B93A8]">
            No matching zones found.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredZones.map((zone, i) => {
              const raw = rawZoneId(zone);
              const activity = activeByZone.get(raw);
              return (
                <div
                  key={zone.id}
                  style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                  className="group animate-fade-up relative overflow-hidden rounded-2xl border border-[#F47A20]/[0.12] bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 backdrop-blur-xl flex items-center gap-3 p-4 transition-all duration-200 hover:border-[#F47A20]/35 hover:shadow-[0_0_28px_-14px_rgba(244,122,32,0.5)]"
                >
                  <span className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-[#F47A20]/[0.08] blur-3xl" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/zones/${raw}/markets`)}
                    className="relative flex flex-1 min-w-0 items-center gap-3.5 text-left"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#F47A20]/35 to-[#F47A20]/10 ring-2 ring-inset ring-[#F47A20]/45 shadow-[0_0_16px_1px_rgba(244,122,32,0.5)]">
                      <Layers size={19} className="text-[#FFB578]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[15px] font-bold text-white">Zone {zone.number}</p>
                      <p className="text-[12.5px] text-[#8B93A8] mt-0.5">
                        Manager: {zone.manager} &middot; {zone.marketsCount} market{zone.marketsCount === 1 ? "" : "s"} &middot; {zone.employeesCount} employee{zone.employeesCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    {activity && activity.total > 0 && (
                      <span
                        className={`hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                          activity.active === activity.total
                            ? "bg-emerald-500/12 text-emerald-400 ring-emerald-500/30 shadow-[0_0_10px_-3px_rgba(52,211,153,0.6)]"
                            : activity.active > 0
                              ? "bg-amber-500/12 text-amber-400 ring-amber-500/30 shadow-[0_0_10px_-3px_rgba(251,191,36,0.6)]"
                              : "bg-red-500/12 text-red-400 ring-red-500/30 shadow-[0_0_10px_-3px_rgba(248,113,113,0.6)]"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {activity.active}/{activity.total} Active
                      </span>
                    )}
                    <ChevronRight size={17} className="relative shrink-0 text-[#4C5266] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[#F47A20]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssigningZone(zone)}
                    className="relative shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/10 transition-colors duration-150"
                  >
                    <UserCog size={13} /> Assign
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {creating && <CreateZoneModal onClose={() => setCreating(false)} onCreated={reload} />}
      {assigningZone && (
        <AssignManagerModal zone={assigningZone} onClose={() => setAssigningZone(null)} onAssigned={reload} />
      )}
    </div>
  );
}

function CreateZoneModal({ onClose, onCreated }) {
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate() {
    const n = Number(number);
    if (!Number.isInteger(n) || n <= 0) {
      setError("Enter a positive whole number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createZone(n);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the zone.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New Zone">
      <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-2">Zone Number</label>
      <input
        type="number"
        min="1"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="e.g. 4"
        autoFocus
        className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
      />
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handleCreate}
        disabled={saving || !number.trim()}
        className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-150"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create Zone
      </button>
    </Modal>
  );
}

function AssignManagerModal({ zone, onClose, onAssigned }) {
  const { data: managers, error: managersError, loading: managersLoading } = useAsync(
    () => listStaffAccounts("REGIONAL_MANAGER"),
    { deps: [] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleAssign(managerId) {
    setSaving(true);
    setError(null);
    try {
      await assignZoneManager(rawZoneId(zone), managerId);
      onAssigned();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign the manager.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Zone ${zone.number} — Manager`}>
      {managersLoading ? (
        <p className="text-sm text-[#4C5266] text-center py-6">Loading...</p>
      ) : managersError ? (
        <p className="text-sm text-red-400 text-center py-6">{managersError}</p>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleAssign(null)}
            className="w-full text-left rounded-lg px-3.5 py-3 text-sm text-[#9AA1B4] bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors duration-150"
          >
            Unassigned
          </button>
          {managers.length === 0 ? (
            <p className="text-xs text-[#6B7284] px-1 py-2">
              No Regional Manager accounts exist yet — create one from the People tab first.
            </p>
          ) : (
            managers.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={saving}
                onClick={() => handleAssign(m.id)}
                className="w-full text-left rounded-lg px-3.5 py-3 text-sm text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors duration-150"
              >
                {m.name} <span className="text-xs text-[#6B7284]">({m.email})</span>
              </button>
            ))
          )}
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
