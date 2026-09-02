import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import Modal from "../common/Modal";
import GroupMemberPicker from "../common/GroupMemberPicker";
import { createGroup } from "../../services/chatService";
import { ApiError } from "../../services/apiClient";

// CreateGroupModal.jsx — Supervisor names a group, picks members
// person-by-person (Chat UI redesign — replaces the old "employees of my
// own market only" list with GroupMemberPicker, already scoped
// server-side to whoever this Supervisor may actually reach), creates
// it. Uses the same Conversation/Message architecture as every other
// chat here (a real CUSTOM_GROUP conversation, not a separate system) —
// see chatController.createGroup.
export default function CreateGroupModal({ marketId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState({ employeeIds: new Set(), staffUserIds: new Set() });
  // Phase 3 §7-8: NORMAL (everyone can post, default) vs WARNING (an
  // announcement group — only group admins, starting with the creator,
  // can post; everyone else is read-only). Reuses the existing group-
  // admin concept, no new permission system.
  const [groupType, setGroupType] = useState("NORMAL");
  // Chat UI redesign — Groups tab categorization (irrelevant once
  // groupType=WARNING, which is always shown under Announcements).
  const [category, setCategory] = useState("GENERAL");
  const [openJoin, setOpenJoin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Enter a group name.");
      return;
    }
    if (selected.employeeIds.size === 0 && selected.staffUserIds.size === 0) {
      setError("Select at least one member.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const conversation = await createGroup({
        name: name.trim(),
        marketId,
        memberEmployeeIds: [...selected.employeeIds],
        memberStaffUserIds: [...selected.staffUserIds],
        groupType,
        category,
        openJoin,
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
            placeholder="e.g. Morning Shift Team"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Group Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGroupType("NORMAL")}
              className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                groupType === "NORMAL" ? "text-white bg-[#F47A20]" : "text-[#9AA1B4] bg-white/[0.04] hover:bg-white/[0.08]"
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setGroupType("WARNING")}
              className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                groupType === "WARNING" ? "text-white bg-amber-500" : "text-[#9AA1B4] bg-white/[0.04] hover:bg-white/[0.08]"
              }`}
            >
              Announcement
            </button>
          </div>
          {groupType === "WARNING" && (
            <p className="mt-1.5 text-[11px] text-amber-400/90">Only group admins can post — everyone else is read-only.</p>
          )}
        </div>

        {groupType === "NORMAL" && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Category</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategory("GENERAL")}
                className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                  category === "GENERAL" ? "text-white bg-[#F47A20]" : "text-[#9AA1B4] bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setCategory("TASK_OPERATIONS")}
                className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                  category === "TASK_OPERATIONS" ? "text-white bg-[#F47A20]" : "text-[#9AA1B4] bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                Task & Operations
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpenJoin((v) => !v)}
          className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 bg-white/[0.03] border border-white/[0.06]"
        >
          <span className="text-xs text-[#9AA1B4]">Let anyone in without approval</span>
          <span className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors ${openJoin ? "bg-[#F47A20]" : "bg-white/10"}`}>
            <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${openJoin ? "translate-x-4" : ""}`} />
          </span>
        </button>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Members</label>
          <GroupMemberPicker selected={selected} onChange={setSelected} />
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
