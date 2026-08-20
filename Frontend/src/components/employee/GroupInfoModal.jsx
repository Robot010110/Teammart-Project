import { useState } from "react";
import { Pencil, Check, X, UserPlus, UserMinus, Loader2 } from "lucide-react";
import Modal from "../common/Modal";
import { listGroupMembers, renameGroup, addGroupMember, removeGroupMember } from "../../services/chatService";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { useAsync } from "../../hooks/useAsync";
import { initialsOf } from "../../utils/initials";
import { ApiError } from "../../services/apiClient";

// GroupInfoModal.jsx — spec §7-8: view a Custom Group's roster, and (for
// a manager) rename it / add / remove members. Every mutation here is
// re-checked server-side by requireGroupManagerRole regardless of
// `canManage` (see chatController.js) — canManage only controls whether
// this modal SHOWS the controls, it isn't itself a security boundary.
// `canManage` is only ever true for a staff Supervisor/Admin/Regional
// Manager viewer; an employee member opens this same modal read-only.
export default function GroupInfoModal({ conversationId, groupName, marketId, canManage, onClose, onRenamed }) {
  const { data: members, setData: setMembers, loading, error, reload } = useAsync(
    () => listGroupMembers(conversationId),
    { deps: [conversationId] }
  );
  const { data: marketEmployees } = useAsync(
    () => (canManage && marketId ? listEmployeesByMarket(marketId) : Promise.resolve([])),
    { deps: [canManage, marketId] }
  );

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(groupName || "");
  const [name, setName] = useState(groupName || "");
  const [savingName, setSavingName] = useState(false);
  const [addingOpen, setAddingOpen] = useState(false);
  const [busyEmployeeId, setBusyEmployeeId] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function handleSaveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === name) {
      setRenaming(false);
      return;
    }
    setSavingName(true);
    setActionError(null);
    try {
      const updated = await renameGroup(conversationId, trimmed);
      setName(updated.name);
      onRenamed?.(updated.name);
      setRenaming(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not rename this group.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleAddMember(employee) {
    setBusyEmployeeId(employee.id);
    setActionError(null);
    try {
      const updated = await addGroupMember(conversationId, employee.id);
      setMembers(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add this member.");
    } finally {
      setBusyEmployeeId(null);
    }
  }

  async function handleRemoveMember(employeeId) {
    setBusyEmployeeId(employeeId);
    setActionError(null);
    try {
      const updated = await removeGroupMember(conversationId, employeeId);
      setMembers(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not remove this member.");
      reload();
    } finally {
      setBusyEmployeeId(null);
    }
  }

  const memberIds = new Set((members ?? []).map((m) => m.employeeId));
  const addableEmployees = (marketEmployees ?? []).filter((e) => !memberIds.has(e.id));

  return (
    <Modal open onClose={onClose} title="Group Info">
      <div className="space-y-4">
        <div>
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={100}
                className="flex-1 rounded-lg bg-white/[0.05] border border-[#F47A20]/40 px-3 py-2 text-sm text-white outline-none"
              />
              <button type="button" onClick={handleSaveName} disabled={savingName} className="p-2 rounded-lg bg-[#F47A20] text-white disabled:opacity-50">
                {savingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button type="button" onClick={() => { setRenaming(false); setNameDraft(name); }} className="p-2 rounded-lg bg-white/[0.06] text-[#9AA1B4]">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white truncate">{name}</h3>
              {canManage && (
                <button type="button" onClick={() => setRenaming(true)} className="p-1 text-[#4C5266] hover:text-white" aria-label="Rename group">
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {actionError && <p className="text-xs text-red-400">{actionError}</p>}

        <div>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B93A8]">
            Members {members ? `(${members.length})` : ""}
          </p>
          {loading ? (
            <p className="text-xs text-[#4C5266] py-4 text-center">Loading members...</p>
          ) : error ? (
            <p className="text-xs text-red-400 py-4 text-center">{error}</p>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {members.map((m) => (
                <div key={m.employeeId} className="flex items-center gap-3 rounded-xl p-2.5 bg-[#1A1F33]/70 border border-white/[0.06]">
                  <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                    {initialsOf(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{m.name}</p>
                    <p className="text-[11px] text-[#8B93A8]">{m.position}</p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.employeeId)}
                      disabled={busyEmployeeId === m.employeeId}
                      className="p-1.5 text-[#4C5266] hover:text-red-400 disabled:opacity-50"
                      aria-label={`Remove ${m.name}`}
                    >
                      {busyEmployeeId === m.employeeId ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {canManage && (
          <div>
            <button
              type="button"
              onClick={() => setAddingOpen((v) => !v)}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/[0.1] transition-colors duration-150"
            >
              <UserPlus size={14} /> Add Member
            </button>
            {addingOpen && (
              <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                {addableEmployees.length === 0 ? (
                  <p className="text-xs text-[#4C5266] text-center py-3">No other employees to add.</p>
                ) : (
                  addableEmployees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => handleAddMember(e)}
                      disabled={busyEmployeeId === e.id}
                      className="w-full flex items-center gap-3 rounded-xl p-2.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 disabled:opacity-50 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                        {initialsOf(e.name)}
                      </span>
                      <span className="flex-1 min-w-0 text-left text-sm text-white truncate">{e.name}</span>
                      {busyEmployeeId === e.id ? <Loader2 size={14} className="animate-spin text-[#9AA1B4]" /> : <UserPlus size={14} className="text-[#4C5266]" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
