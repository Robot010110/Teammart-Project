import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import Modal from "../common/Modal";
import { createGroup } from "../../services/chatService";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { getMarket } from "../../services/marketService";
import { useAsync } from "../../hooks/useAsync";
import { initialsOf } from "../../utils/initials";
import { ApiError } from "../../services/apiClient";

// CreateGroupModal.jsx — spec §6: Supervisor names a group, picks members
// from their own market's employees (and, if one exists, the market's
// own Overlooking account — spec §1 doesn't limit group members to
// employees), creates it. Uses the same Conversation/Message architecture
// as every other chat here (a real CUSTOM_GROUP conversation, not a
// separate system) — see chatController.createGroup.
export default function CreateGroupModal({ marketId, onClose, onCreated }) {
  const { data: employees, loading: loadingEmployees } = useAsync(() => listEmployeesByMarket(marketId), { deps: [marketId] });
  const { data: market } = useAsync(() => getMarket(marketId), { deps: [marketId] });
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [includeOverlooking, setIncludeOverlooking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  function toggle(employeeId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Enter a group name.");
      return;
    }
    const memberStaffUserIds = includeOverlooking && market?.overlookingSupervisor ? [market.overlookingSupervisor.id] : [];
    if (selected.size === 0 && memberStaffUserIds.length === 0) {
      setError("Select at least one member.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const conversation = await createGroup({ name: name.trim(), marketId, memberEmployeeIds: [...selected], memberStaffUserIds });
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
            placeholder="e.g. Morning Shift Team"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>

        {market?.overlookingSupervisor && (
          <button
            type="button"
            onClick={() => setIncludeOverlooking((v) => !v)}
            className={`w-full flex items-center gap-3 rounded-xl p-2.5 border transition-colors ${
              includeOverlooking ? "bg-[#F47A20]/10 border-[#F47A20]/40" : "bg-[#1A1F33]/70 border-white/[0.06] hover:border-white/[0.15]"
            }`}
          >
            <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {initialsOf(market.overlookingSupervisor.name)}
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium text-white truncate">{market.overlookingSupervisor.name}</p>
              <p className="text-[11px] text-[#8B93A8]">Overlooking</p>
            </div>
            <span className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${includeOverlooking ? "bg-[#F47A20] border-[#F47A20]" : "border-white/20"}`}>
              {includeOverlooking && <Check size={12} className="text-white" />}
            </span>
          </button>
        )}

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">
            Members {selected.size > 0 ? `(${selected.size} selected)` : ""}
          </label>
          {loadingEmployees ? (
            <p className="text-xs text-[#4C5266] py-4 text-center">Loading employees...</p>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {(employees ?? []).map((e) => {
                const isSelected = selected.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggle(e.id)}
                    className={`w-full flex items-center gap-3 rounded-xl p-2.5 border transition-colors ${
                      isSelected ? "bg-[#F47A20]/10 border-[#F47A20]/40" : "bg-[#1A1F33]/70 border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                      {initialsOf(e.name)}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-white truncate">{e.name}</p>
                      <p className="text-[11px] text-[#8B93A8]">{e.position}</p>
                    </div>
                    <span
                      className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected ? "bg-[#F47A20] border-[#F47A20]" : "border-white/20"
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
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
