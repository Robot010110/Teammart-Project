import { useState } from "react";
import { Pencil, Check, X, UserPlus, UserMinus, Loader2, ShieldCheck, Shield, Camera, Image as ImageIcon, Mic, File as FileIcon, Download, Users2, Trash2 } from "lucide-react";
import Modal from "../common/Modal";
import AuthenticatedImage from "../common/AuthenticatedImage";
import {
  listGroupMembers,
  renameGroup,
  changeGroupPicture,
  addGroupMember,
  removeGroupMember,
  setGroupMemberAdmin,
  listConversationMedia,
  deleteGroup,
} from "../../services/chatService";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { prepareImageForUpload } from "../../services/activityService";
import { formatFileSize } from "../../utils/fileEncoding";
import { useAsync } from "../../hooks/useAsync";
import { initialsOf } from "../../utils/initials";
import { ApiError } from "../../services/apiClient";

function mediaTimeLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// MediaTabs — real Media/Voice/Files browser (verification follow-up:
// "the Group Information screen has a real functional Media/Voice/Files
// browser backed by the database"). Backed entirely by
// GET /api/conversations/:id/media (chatController.listConversationMedia)
// — every thumbnail/row here is a real Message row this group actually
// sent, never a placeholder. Only these three categories exist because
// they're the only attachment kinds this schema supports (no video
// attachment type) — deliberately no fourth fake tab.
function MediaTabs({ conversationId }) {
  const { data, loading, error } = useAsync(() => listConversationMedia(conversationId), { deps: [conversationId] });
  const [tab, setTab] = useState("images");

  const TABS = [
    { key: "images", label: "Media", icon: ImageIcon, count: data?.images.length },
    { key: "voice", label: "Voice", icon: Mic, count: data?.voice.length },
    { key: "files", label: "Files", icon: FileIcon, count: data?.files.length },
  ];

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === key ? "bg-[#F47A20] text-white" : "bg-white/[0.06] text-[#9AA1B4] hover:text-white"
            }`}
          >
            <Icon size={13} /> {label}{count ? ` (${count})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-[#4C5266] py-6 text-center">Loading...</p>
      ) : error ? (
        <p className="text-xs text-red-400 py-6 text-center">{error}</p>
      ) : tab === "images" ? (
        data.images.length === 0 ? (
          <p className="text-xs text-[#4C5266] py-8 text-center">No photos shared in this group yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-[280px] overflow-y-auto">
            {data.images.map((img) => (
              <div key={img.messageId} className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.04]">
                <AuthenticatedImage src={img.url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )
      ) : tab === "voice" ? (
        data.voice.length === 0 ? (
          <p className="text-xs text-[#4C5266] py-8 text-center">No voice messages in this group yet.</p>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {data.voice.map((v) => (
              <div key={v.messageId} className="rounded-xl p-2.5 bg-[#1A1F33]/70 border border-white/[0.06]">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-white">{v.senderName}</p>
                  <p className="text-[10px] text-[#4C5266]">{mediaTimeLabel(v.createdAt)}</p>
                </div>
                <audio controls src={v.url} className="w-full h-9" />
              </div>
            ))}
          </div>
        )
      ) : data.files.length === 0 ? (
        <p className="text-xs text-[#4C5266] py-8 text-center">No files shared in this group yet.</p>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto">
          {data.files.map((f) => (
            <a
              key={f.messageId}
              href={f.url}
              download={f.name || "file"}
              className="flex items-center gap-2.5 rounded-xl p-2.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
            >
              <FileIcon size={16} className="text-[#F47A20] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">{f.name || "File"}</p>
                <p className="text-[10px] text-[#4C5266]">{formatFileSize(f.size)} · {f.senderName}</p>
              </div>
              <Download size={14} className="text-[#4C5266] shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// GroupInfoModal.jsx — spec §1/§7-8/§13: view a Custom Group's roster,
// and (for a group admin) rename it, change its picture, add/remove
// members, and promote/demote other members to admin. Every mutation
// here is re-checked server-side by requireGroupAdmin regardless of what
// this modal computes locally — `canManage` below is derived from the
// CURRENT VIEWER's own membership row (isAdmin), not from their role, per
// the spec's own rule that being a Supervisor/Regional Manager never
// automatically grants control over a group (see chatController.js's
// isGroupAdmin). currentUserId/currentUserKind identify the viewer so
// that lookup can happen; marketId (if the group is market-scoped) drives
// the "Add Member" employee picker — zone-scoped groups don't get that
// picker here (adding to those happens at creation, or removing here).
export default function GroupInfoModal({ conversationId, groupName, groupPictureUrl, marketId, currentUserId, currentUserKind, onClose, onRenamed, onDeleted }) {
  const { data: members, setData: setMembers, loading, error, reload } = useAsync(
    () => listGroupMembers(conversationId),
    { deps: [conversationId] }
  );
  const { data: marketEmployees } = useAsync(
    () => (marketId ? listEmployeesByMarket(marketId) : Promise.resolve([])),
    { deps: [marketId] }
  );

  const [section, setSection] = useState("members"); // "members" | "media"
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(groupName || "");
  const [name, setName] = useState(groupName || "");
  const [pictureUrl, setPictureUrl] = useState(groupPictureUrl || null);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [addingOpen, setAddingOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteGroup() {
    setDeleting(true);
    setActionError(null);
    try {
      await deleteGroup(conversationId);
      onDeleted ? onDeleted() : onClose();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not delete this group.");
      setDeleting(false);
    }
  }

  const myMembership = (members ?? []).find((m) =>
    currentUserKind === "staff" ? m.userId === currentUserId : m.employeeId === currentUserId
  );
  const canManage = !!myMembership?.isAdmin;

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

  async function handlePicture(file) {
    if (!file) return;
    setPictureBusy(true);
    setActionError(null);
    try {
      const url = await prepareImageForUpload(file);
      const updated = await changeGroupPicture(conversationId, url);
      setPictureUrl(updated.pictureUrl);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not change the group photo.");
    } finally {
      setPictureBusy(false);
    }
  }

  async function handleAddMember(employee) {
    setBusyId(employee.id);
    setActionError(null);
    try {
      const updated = await addGroupMember(conversationId, { employeeId: employee.id });
      setMembers(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add this member.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveMember(member) {
    setBusyId(member.id);
    setActionError(null);
    try {
      const updated = await removeGroupMember(conversationId, member.id);
      setMembers(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not remove this member.");
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleAdmin(member) {
    setBusyId(member.id);
    setActionError(null);
    try {
      const updated = await setGroupMemberAdmin(conversationId, member.id, !member.isAdmin);
      setMembers(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update admin status.");
    } finally {
      setBusyId(null);
    }
  }

  const memberEmployeeIds = new Set((members ?? []).map((m) => m.employeeId).filter(Boolean));
  const addableEmployees = (marketEmployees ?? []).filter((e) => !memberEmployeeIds.has(e.id));

  return (
    <Modal open onClose={onClose} title="Group Info">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className={`relative h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center overflow-hidden ${canManage ? "cursor-pointer" : ""}`}>
            {pictureUrl ? (
              <AuthenticatedImage src={pictureUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-base font-display font-bold text-white">{initialsOf(name)}</span>
            )}
            {canManage && (
              <>
                <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                  {pictureBusy ? <Loader2 size={16} className="text-white animate-spin" /> : <Camera size={16} className="text-white" />}
                </span>
                <input type="file" accept="image/*" className="hidden" disabled={pictureBusy} onChange={(e) => handlePicture(e.target.files[0])} />
              </>
            )}
          </label>

          {renaming ? (
            <div className="flex-1 flex items-center gap-2">
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
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <h3 className="text-base font-semibold text-white truncate">{name}</h3>
              {canManage && (
                <button type="button" onClick={() => setRenaming(true)} className="p-1 text-[#4C5266] hover:text-white shrink-0" aria-label="Rename group">
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {actionError && <p className="text-xs text-red-400">{actionError}</p>}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSection("members")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
              section === "members" ? "bg-[#F47A20] text-white" : "bg-white/[0.06] text-[#9AA1B4] hover:text-white"
            }`}
          >
            <Users2 size={13} /> Members
          </button>
          <button
            type="button"
            onClick={() => setSection("media")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
              section === "media" ? "bg-[#F47A20] text-white" : "bg-white/[0.06] text-[#9AA1B4] hover:text-white"
            }`}
          >
            <ImageIcon size={13} /> Media
          </button>
        </div>

        {section === "media" && <MediaTabs conversationId={conversationId} />}

        {section === "members" && (
        <>
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B93A8]">
            Members {members ? `(${members.length})` : ""}
          </p>
          {loading ? (
            <p className="text-xs text-[#4C5266] py-4 text-center">Loading members...</p>
          ) : error ? (
            <p className="text-xs text-red-400 py-4 text-center">{error}</p>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl p-2.5 bg-[#1A1F33]/70 border border-white/[0.06]">
                  <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                    {initialsOf(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                      {m.name}
                      {m.isAdmin && <ShieldCheck size={12} className="text-[#F47A20]" aria-label="Admin" />}
                    </p>
                    <p className="text-[11px] text-[#8B93A8]">{m.position}</p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAdmin(m)}
                        disabled={busyId === m.id}
                        className="p-1.5 text-[#4C5266] hover:text-[#F47A20] disabled:opacity-50"
                        aria-label={m.isAdmin ? `Remove admin from ${m.name}` : `Promote ${m.name} to admin`}
                        title={m.isAdmin ? "Remove admin" : "Promote to admin"}
                      >
                        {busyId === m.id ? <Loader2 size={14} className="animate-spin" /> : m.isAdmin ? <Shield size={14} /> : <ShieldCheck size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m)}
                        disabled={busyId === m.id}
                        className="p-1.5 text-[#4C5266] hover:text-red-400 disabled:opacity-50"
                        aria-label={`Remove ${m.name}`}
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {canManage && marketId && (
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
                      disabled={busyId === e.id}
                      className="w-full flex items-center gap-3 rounded-xl p-2.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 disabled:opacity-50 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                        {initialsOf(e.name)}
                      </span>
                      <span className="flex-1 min-w-0 text-left text-sm text-white truncate">{e.name}</span>
                      {busyId === e.id ? <Loader2 size={14} className="animate-spin text-[#9AA1B4]" /> : <UserPlus size={14} className="text-[#4C5266]" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {canManage && (
          <div className="pt-2 border-t border-white/[0.06]">
            {confirmingDelete ? (
              <div className="space-y-2">
                <p className="text-xs text-red-400">Delete this group permanently? All messages, media, and members will be removed. This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="flex-1 rounded-xl py-2.5 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Confirm Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-red-400 bg-red-500/[0.06] hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} /> Delete Group
              </button>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </Modal>
  );
}

