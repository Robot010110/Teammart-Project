import { useState } from "react";
import { Layers, Plus, Check, Loader2, UserCog } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import Modal from "../components/common/Modal";
import { ApiError } from "../services/apiClient";
import { listZones, createZone, assignZoneManager } from "../services/zoneService";
import { listStaffAccounts } from "../services/authService";

// A zone's own id comes back prefixed ("zone-3" — see
// zonesController.shapeZoneSummary, kept for compatibility with how the
// frontend originally modeled zones) everywhere except the PATCH/DELETE
// routes, which take the raw numeric id. This is the one place that
// needs to know that.
function rawZoneId(zone) {
  return Number(String(zone.id).replace("zone-", ""));
}

// AdminZonesPage.jsx — ADMIN-only: create zones and assign/unassign each
// zone's Regional Manager (PATCH /api/zones/:id/manager). Every zone
// company-wide (GET /api/zones is unscoped for ADMIN).
export default function AdminZonesPage() {
  const { data: zones, error, loading, reload } = useAsync(listZones, { deps: [] });
  const [creating, setCreating] = useState(false);
  const [assigningZone, setAssigningZone] = useState(null);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Zones</h1>
          <p className="mt-1 text-sm text-[#9AA1B4]">{loading ? "Loading..." : `${zones?.length ?? 0} zone${zones?.length === 1 ? "" : "s"}`}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
        >
          <Plus size={15} /> New Zone
        </button>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-[90px]" />)}</div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : zones.length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
            No zones exist yet.
          </div>
        ) : (
          <div className="space-y-3">
            {zones.map((zone) => (
              <div key={zone.id} className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#F47A20]/10 grid place-items-center shrink-0">
                  <Layers size={16} className="text-[#F47A20]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">Zone {zone.number}</p>
                  <p className="text-xs text-[#8B93A8] mt-0.5">
                    Manager: {zone.manager} &middot; {zone.marketsCount} market{zone.marketsCount === 1 ? "" : "s"} &middot; {zone.employeesCount} employee{zone.employeesCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssigningZone(zone)}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/10 transition-colors duration-150"
                >
                  <UserCog size={13} /> Assign
                </button>
              </div>
            ))}
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
              No Regional Manager accounts exist yet — create one from the Staff tab first.
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
