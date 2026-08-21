import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import Modal from "../components/common/Modal";
import { createGroup } from "../services/chatService";
import { listEmployees } from "../services/staffEmployeeService";
import { listMarkets, getMarket } from "../services/marketService";
import { useAsync } from "../hooks/useAsync";
import { initialsOf } from "../utils/initials";
import { ApiError } from "../services/apiClient";

// RmCreateGroupModal.jsx — spec §9-11: a Regional Manager builds a group
// scoped to either ONE market (e.g. that market's Supervisor +
// Overlooking) or a WHOLE ZONE (e.g. a cross-market "Supervisors —
// Zone 1" group, or "Cashiers — Regional"). Reuses the exact same
// createGroup endpoint/architecture as the Supervisor's own group
// creation (CreateGroupModal.jsx) — only the scope picker and the
// member-source (which now includes staff, not just employees) differ.
export default function RmCreateGroupModal({ session, onClose, onCreated }) {
  const [scopeKind, setScopeKind] = useState("zone"); // "zone" | "market"
  const [zoneId, setZoneId] = useState(session.zoneIds?.[0] ?? "");
  const [marketId, setMarketId] = useState("");
  const [name, setName] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(new Set());
  const [selectedStaffIds, setSelectedStaffIds] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const { data: allMarkets } = useAsync(listMarkets, { deps: [] });
  const zoneMarkets = (allMarkets ?? []).filter((m) => scopeKind === "zone" ? m.zoneId === Number(zoneId) : m.id === marketId);

  useEffect(() => {
    if (scopeKind === "market" && !marketId && allMarkets?.length) setMarketId(allMarkets[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKind, allMarkets]);

  // Employees in scope — one request per relevant market, merged.
  const { data: employeesByMarket } = useAsync(
    () => Promise.all(zoneMarkets.map((m) => listEmployees({ marketId: m.id }))),
    { deps: [zoneMarkets.map((m) => m.id).join(","), scopeKind] }
  );
  const employees = (employeesByMarket ?? []).flat();

  // Staff (Supervisor + Overlooking) in scope — getMarket gives real ids,
  // listMarkets only gives names.
  const { data: marketDetails } = useAsync(
    () => Promise.all(zoneMarkets.map((m) => getMarket(m.id))),
    { deps: [zoneMarkets.map((m) => m.id).join(","), scopeKind] }
  );
  const staffMembers = (marketDetails ?? []).flatMap((m) =>
    [
      m.supervisor ? { id: m.supervisor.id, name: m.supervisor.name, role: "Supervisor" } : null,
      m.overlookingSupervisor ? { id: m.overlookingSupervisor.id, name: m.overlookingSupervisor.name, role: "Overlooking" } : null,
    ].filter(Boolean)
  );

  function toggleEmployee(id) {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleStaff(id) {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim()) return setError("Enter a group name.");
    if (selectedEmployeeIds.size === 0 && selectedStaffIds.size === 0) return setError("Select at least one member.");

    setCreating(true);
    setError(null);
    try {
      const conversation = await createGroup({
        name: name.trim(),
        ...(scopeKind === "zone" ? { zoneId: Number(zoneId) } : { marketId }),
        memberEmployeeIds: [...selectedEmployeeIds],
        memberStaffUserIds: [...selectedStaffIds],
      });
      onCreated(conversation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this group.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Create Group">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Group Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Supervisors — Zone 1"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Scope</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScopeKind("zone")}
              className={`rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${scopeKind === "zone" ? "bg-[#F47A20] text-white" : "bg-white/[0.04] text-[#9AA1B4] hover:bg-white/[0.08]"}`}
            >
              Entire Zone
            </button>
            <button
              type="button"
              onClick={() => setScopeKind("market")}
              className={`rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${scopeKind === "market" ? "bg-[#F47A20] text-white" : "bg-white/[0.04] text-[#9AA1B4] hover:bg-white/[0.08]"}`}
            >
              One Market
            </button>
          </div>
        </div>

        {scopeKind === "zone" ? (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Zone</label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50"
            >
              {(session.zoneIds ?? []).map((z) => (
                <option key={z} value={z}>Zone {z}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Market</label>
            <select
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50"
            >
              {(allMarkets ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {staffMembers.length > 0 && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">
              Supervisors / Overlooking {selectedStaffIds.size > 0 ? `(${selectedStaffIds.size} selected)` : ""}
            </label>
            <div className="space-y-2 max-h-[140px] overflow-y-auto">
              {staffMembers.map((s) => {
                const isSelected = selectedStaffIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStaff(s.id)}
                    className={`w-full flex items-center gap-3 rounded-xl p-2.5 border transition-colors ${isSelected ? "bg-[#F47A20]/10 border-[#F47A20]/40" : "bg-[#1A1F33]/70 border-white/[0.06] hover:border-white/[0.15]"}`}
                  >
                    <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">{initialsOf(s.name)}</span>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-white truncate">{s.name}</p>
                      <p className="text-[11px] text-[#8B93A8]">{s.role}</p>
                    </div>
                    <span className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? "bg-[#F47A20] border-[#F47A20]" : "border-white/20"}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">
            Employees {selectedEmployeeIds.size > 0 ? `(${selectedEmployeeIds.size} selected)` : ""}
          </label>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {employees.length === 0 ? (
              <p className="text-xs text-[#4C5266] text-center py-3">No employees in this scope.</p>
            ) : (
              employees.map((e) => {
                const isSelected = selectedEmployeeIds.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleEmployee(e.id)}
                    className={`w-full flex items-center gap-3 rounded-xl p-2.5 border transition-colors ${isSelected ? "bg-[#F47A20]/10 border-[#F47A20]/40" : "bg-[#1A1F33]/70 border-white/[0.06] hover:border-white/[0.15]"}`}
                  >
                    <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">{initialsOf(e.name)}</span>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-white truncate">{e.name}</p>
                      <p className="text-[11px] text-[#8B93A8]">{e.position}</p>
                    </div>
                    <span className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? "bg-[#F47A20] border-[#F47A20]" : "border-white/20"}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {creating ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
