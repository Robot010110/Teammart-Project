import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Send, ShieldAlert, Loader2, Paperclip, Camera, File as FileIcon, Mic, Download, X,
  MoreHorizontal, Reply, Copy, Pencil, Trash2, Check, CheckCheck, Users2, Forward, Award, Eye,
  Search, MessageCircle,
} from "lucide-react";
import { listMessages, sendMessage, markConversationRead, editMessage, deleteMessage, reactToMessage, listMentionCandidates, getMessageSeenBy, listGroupMembers } from "../../services/chatService";
import { usePolling } from "../../hooks/usePolling";
import { prepareImageForUpload } from "../../services/activityService";
import { uploadAttachment, formatFileSize, formatDuration } from "../../utils/fileEncoding";
import AuthenticatedImage from "../common/AuthenticatedImage";
import VoiceRecorder from "./VoiceRecorder";
import ForwardMessageModal from "./ForwardMessageModal";
import Modal from "../common/Modal";
import { useAsync } from "../../hooks/useAsync";
import { initialsOf } from "../../utils/initials";
import { ApiError } from "../../services/apiClient";

const POLL_MS = 4000;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👏"];
// Real per-message "Seen by" only makes sense for a genuine multi-member
// conversation — a DIRECT/SUPERVISOR_DIRECT/RM_DIRECT/STAFF_DIRECT
// thread already has the simpler inline "Seen" tick (theirLastReadAt,
// see this file's own read-indicator logic), where a reader LIST of at
// most one other person adds nothing.
const GROUP_LIKE_TYPES = new Set(["MARKET_GROUP", "ZONE_GROUP", "CUSTOM_GROUP", "WARNINGS", "ZONE_ANNOUNCEMENTS"]);
// URL detection for tappable links in message text (spec §19) — deliberately
// client-side only, no server-side preview fetch (see chatController.js's
// own note on avoiding an SSRF surface for this).
const URL_RE = /(https?:\/\/[^\s]+)/g;

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API requires a secure context (https/localhost) — this
    // app is also used over a plain http:// LAN address, where it's
    // unavailable. Fall back to the older, broadly-supported approach.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

// Highlights "@Name" for every real, server-validated mention on this
// message (never a raw "@" scan — only names chatController.js actually
// persisted a MessageMention for), then linkifies the rest as usual.
function renderBody(body, mentions) {
  if (!mentions?.length) return linkifyBody(body);
  const names = mentions.map((m) => m.employee?.name || m.user?.name).filter(Boolean);
  if (!names.length) return linkifyBody(body);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(@(?:${escaped.join("|")}))`, "g");
  const parts = body.split(re);
  return parts.map((part, i) =>
    names.some((n) => part === `@${n}`) ? (
      <span key={i} className="font-semibold text-[#F47A20]">{part}</span>
    ) : (
      <span key={i}>{linkifyBody(part)}</span>
    )
  );
}

function linkifyBody(body) {
  const parts = body.split(URL_RE);
  return parts.map((part, i) =>
    URL_RE.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 break-all" onClick={(e) => e.stopPropagation()}>
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function MessageAttachment({ message }) {
  if (message.imageUrl) {
    return <AuthenticatedImage src={message.imageUrl} alt="" className="mt-1.5 rounded-lg max-h-56 w-full object-cover" />;
  }
  if (message.attachmentType === "FILE") {
    return (
      <a
        href={message.attachmentUrl}
        download={message.attachmentName || "file"}
        className="mt-1.5 flex items-center gap-2.5 rounded-lg p-2.5 bg-black/15 hover:bg-black/25 transition-colors"
      >
        <FileIcon size={18} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{message.attachmentName || "File"}</p>
          <p className="text-[10px] opacity-70">{formatFileSize(message.attachmentSize)}</p>
        </div>
        <Download size={14} className="shrink-0" />
      </a>
    );
  }
  if (message.attachmentType === "AUDIO" || message.attachmentType === "VOICE") {
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <audio controls src={message.attachmentUrl} className="h-9 max-w-full" style={{ maxWidth: 220 }} />
        {message.attachmentDurationSec != null && (
          <span className="text-[10px] opacity-70 shrink-0">{formatDuration(message.attachmentDurationSec)}</span>
        )}
      </div>
    );
  }
  return null;
}

// Small bottom-sheet of reactions + actions, portaled (same reasoning as
// Modal.jsx / NotificationBell.jsx). The "..." button on every bubble is
// the accessible, always-visible alternative to long-press the spec asks
// for (§14) — long-press isn't implemented at all, so there's nothing to
// fall back from.
function seenByTimeLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// SeenByModal.jsx (inline) — real per-message read receipts (Repair
// Pass follow-up: "an actual per-message Seen by reader list, not just
// conversation-level read state"). Backed entirely by
// GET /api/conversations/:id/messages/:messageId/seen-by — fetched fresh
// on open, never assembled from anything already in local state, so it
// can never drift from what the server actually knows.
function SeenByModal({ conversationId, messageId, onClose }) {
  const { data, loading, error } = useAsync(() => getMessageSeenBy(conversationId, messageId), { deps: [conversationId, messageId] });

  return (
    <Modal open onClose={onClose} title="Seen By">
      {loading ? (
        <p className="text-sm text-[#4C5266] text-center py-6">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-400 text-center py-6">{error}</p>
      ) : data.count === 0 ? (
        <div className="text-center py-6">
          <Eye size={22} className="mx-auto text-[#4C5266] mb-2" />
          <p className="text-sm text-[#8B93A8]">No one else has seen this message yet.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {data.readers.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="flex items-center gap-3 rounded-xl p-2.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                {initialsOf(r.name)}
              </span>
              <p className="flex-1 min-w-0 text-sm text-white truncate">{r.name}</p>
              <p className="text-[11px] text-[#4C5266] shrink-0">{seenByTimeLabel(r.readAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function MessageActionSheet({ message, canEdit, canDelete, canRecognize, canSeeSeenBy, onClose, onReact, onReply, onForward, onCopy, onEdit, onDelete, onSeenBy }) {
  const [recognizeMode, setRecognizeMode] = useState(false);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm sm:mx-4 rounded-t-2xl sm:rounded-2xl bg-[#1F2436] border border-white/10 shadow-2xl animate-fade-up overflow-hidden">
        {canRecognize && (
          <button
            type="button"
            onClick={() => setRecognizeMode((v) => !v)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold border-b border-white/[0.06] transition-colors ${
              recognizeMode ? "bg-amber-500/15 text-amber-400" : "text-[#9AA1B4] hover:bg-white/[0.05]"
            }`}
          >
            <Award size={13} /> {recognizeMode ? "Sending as Management Recognition — pick an emoji" : "Send as Management Recognition"}
          </button>
        )}
        <div className="flex items-center justify-center gap-1.5 px-3 py-3 border-b border-white/[0.06]">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji, recognizeMode)}
              className="flex-1 text-xl py-1.5 rounded-lg hover:bg-white/[0.06] active:scale-90 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="py-1.5">
          <button type="button" onClick={onReply} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/[0.05]">
            <Reply size={16} /> Reply
          </button>
          <button type="button" onClick={onForward} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/[0.05]">
            <Forward size={16} /> Forward
          </button>
          {message.body && (
            <button type="button" onClick={onCopy} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/[0.05]">
              <Copy size={16} /> Copy
            </button>
          )}
          {canSeeSeenBy && (
            <button type="button" onClick={onSeenBy} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/[0.05]">
              <Eye size={16} /> Seen By
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={onEdit} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/[0.05]">
              <Pencil size={16} /> Edit
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={onDelete} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10">
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function roleLabel(role) {
  if (role === "REGIONAL_MANAGER") return "Regional Manager";
  if (role === "ADMIN") return "Admin";
  if (role === "OVERLOOKING_SUPERVISOR") return "Overlooking Supervisor";
  if (role === "SUPERVISOR") return "Supervisor";
  return "Management";
}

function ReactionPills({ reactions, currentUserId, currentUserKind, onToggle }) {
  if (!reactions || reactions.length === 0) return null;
  const byEmoji = new Map();
  for (const r of reactions) {
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, []);
    byEmoji.get(r.emoji).push(r);
  }
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {[...byEmoji.entries()].map(([emoji, list]) => {
        const mine = list.some((r) => (currentUserKind === "staff" ? r.userId === currentUserId : r.employeeId === currentUserId));
        const recognizers = list.filter((r) => r.isRecognition);
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(emoji); }}
            title={recognizers.length ? recognizers.map((r) => `Recognized by ${roleLabel(r.user?.role)}`).join(", ") : undefined}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
              recognizers.length
                ? "bg-amber-500/15 border-amber-500/40"
                : mine
                ? "bg-[#F47A20]/20 border-[#F47A20]/40"
                : "bg-black/15 border-white/10"
            }`}
          >
            <span>{emoji}</span>
            <span className="text-[10px] text-white/80">{list.length}</span>
            {recognizers.length > 0 && <Award size={11} className="text-amber-400" />}
          </button>
        );
      })}
    </div>
  );
}

// ConversationScreen.jsx — one open thread: polling for new messages
// every 4s (delta fetch via ?after=), reactions, reply, edit, delete,
// copy, a link-detected message body, and a real "Seen" indicator on
// your own last message (from ConversationRead.lastReadAt — no fake
// delivery ticks; see chatController.listMessages's own comment on why
// this is the honest version of a read receipt this REST-polling app can
// support). The composer is hidden entirely on Warnings for employees
// (posting there is staff-only — see backend chatController.sendMessage).
//
// Attachments: Photo reuses activityService.prepareImageForUpload (same
// compression pipeline as everywhere else a photo is captured in this
// app); File/Voice use uploadAttachment (no compression — not meaningful
// for arbitrary files or already-compressed audio). Both upload to the
// real backend (POST /api/uploads, see services/uploadService.js) and
// resolve to a hosted URL — no video message support yet, since that
// would need its own size/compression handling this app doesn't have.
//
// currentUserKind/currentUserId — generalized so the exact same component
// backs both the Employee Chat tab (kind="employee") and the Supervisor
// Chat tab's individual-employee/group conversations (kind="staff").
//
// onBroadcast (optional) — only ever passed for a staff viewer's own
// Warnings channel (SupervisorChatTab.jsx). Warnings has no normal
// composer for anyone (staff posts via the dedicated broadcast endpoint,
// which also fans out a market-wide Notification — see
// chatController.postWarningBroadcast); when provided, a minimal
// text-only composer calls it instead of the generic sendMessage. Left
// unset, Warnings stays fully read-only here (the Employee Chat tab's
// case, and a non-Supervisor staff viewer).
export default function ConversationScreen({ conversation, currentUserId, currentUserKind = "employee", onBack, onBroadcast, onOpenGroupInfo }) {
  // Real member count — only fetched (and only ever shown) for CUSTOM_GROUP,
  // the one conversation type with an actual ConversationMember table to
  // count (see listGroupMembers's own comment in chatController.js).
  // MARKET_GROUP/ZONE_GROUP membership is implicit (derived from
  // market/zone), so there's no honest count to show there — the header
  // just omits the subtitle rather than inventing one.
  const { data: groupMembers } = useAsync(
    () => (conversation.type === "CUSTOM_GROUP" ? listGroupMembers(conversation.id) : Promise.resolve(null)),
    { deps: [conversation.id, conversation.type] }
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults, loading: searchingMessages } = useAsync(
    () => (searchQuery.trim().length >= 2 ? listMessages(conversation.id, { search: searchQuery.trim() }) : Promise.resolve(null)),
    { deps: [searchQuery, conversation.id] }
  );
  const [messages, setMessages] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [theirLastReadAt, setTheirLastReadAt] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null); // { kind, url, name, size, durationSec }
  const [attachBusy, setAttachBusy] = useState(false);
  const [actionSheetFor, setActionSheetFor] = useState(null); // message being acted on
  const [seenByFor, setSeenByFor] = useState(null); // message whose real reader list is being viewed
  const [forwardingMessage, setForwardingMessage] = useState(null); // message being forwarded
  const [replyTo, setReplyTo] = useState(null); // message being replied to
  const [editingId, setEditingId] = useState(null); // message id currently being edited inline
  const [editDraft, setEditDraft] = useState("");
  const [broadcastDraft, setBroadcastDraft] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const lastFetchRef = useRef(null);
  const scrollRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const isWarnings = conversation.type === "WARNINGS" || conversation.type === "ZONE_ANNOUNCEMENTS";
  const [mentionQuery, setMentionQuery] = useState(null); // { start } while the @-dropdown is open
  const [mentionCandidates, setMentionCandidates] = useState({ employees: [], staff: [] });
  const [pendingMentions, setPendingMentions] = useState([]); // [{ employeeId? , userId?, name }]
  const [recognizeMode, setRecognizeMode] = useState(false);

  usePolling(
    async () => {
      try {
        const after = lastFetchRef.current;
        const { messages: batch, theirLastReadAt: seen } = await listMessages(conversation.id, after ? { after } : undefined);
        setTheirLastReadAt(seen);
        if (batch.length > 0) {
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const fresh = batch.filter((m) => !known.has(m.id));
            // A poll can also surface an edit/delete/reaction on an
            // already-loaded message (its id isn't "new" but its content
            // changed) — merge those in place instead of only appending.
            const merged = prev.map((m) => batch.find((b) => b.id === m.id) ?? m);
            return [...merged, ...fresh];
          });
          lastFetchRef.current = batch[batch.length - 1].createdAt;
        }
      } finally {
        setLoadingInitial(false);
      }
    },
    POLL_MS,
    [conversation.id]
  );

  useEffect(() => {
    markConversationRead(conversation.id).catch(() => {});
  }, [conversation.id, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    // Only autoscroll on genuinely new activity, not on a load-older
    // prepend (handled separately, see loadOlder) or on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, pendingAttachment]);

  async function loadOlder() {
    if (loadingOlder || !hasMoreOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const container = scrollRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    try {
      const oldest = messages[0];
      const { messages: older } = await listMessages(conversation.id, { before: oldest.createdAt });
      if (older.length === 0) {
        setHasMoreOlder(false);
      } else {
        setMessages((prev) => [...older, ...prev]);
        // Preserve scroll position — without this, prepending older
        // messages above the viewport yanks the view to the top.
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      }
    } catch {
      // Silently leave hasMoreOlder as-is — the next scroll-up retries.
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleScroll(e) {
    if (e.target.scrollTop < 60) loadOlder();
  }

  async function handlePhotoSelected(file) {
    if (!file) return;
    setAttachMenuOpen(false);
    setAttachBusy(true);
    setError(null);
    try {
      const url = await prepareImageForUpload(file);
      setPendingAttachment({ kind: "image", url });
    } catch {
      setError("Could not process that photo. Please try again.");
    } finally {
      setAttachBusy(false);
    }
  }

  async function handleFileSelected(file) {
    if (!file) return;
    setAttachMenuOpen(false);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("That file is too large (15MB max).");
      return;
    }
    setAttachBusy(true);
    setError(null);
    try {
      const url = await uploadAttachment(file);
      const isAudio = file.type.startsWith("audio/");
      setPendingAttachment({
        kind: isAudio ? "audio" : "file",
        url,
        name: file.name,
        size: file.size,
      });
    } catch {
      setError("Could not attach that file. Please try again.");
    } finally {
      setAttachBusy(false);
    }
  }

  function handleVoiceRecorded(dataUrl, durationSec, size) {
    setPendingAttachment({ kind: "voice", url: dataUrl, durationSec, size });
    setRecordingVoice(false);
  }

  // Mentions (§14-15) — typing "@" opens a bounded candidate dropdown
  // (mention-candidates, scoped to this conversation's real membership);
  // picking one inserts "@Name " and remembers the real id. Only
  // mentions whose "@Name" text still appears in the draft at send time
  // are actually submitted — deleting the text drops the mention too.
  function handleDraftChange(value) {
    setDraft(value);
    const match = value.match(/@([^\s@]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  }

  useEffect(() => {
    if (mentionQuery === null) return;
    let cancelled = false;
    listMentionCandidates(conversation.id, mentionQuery)
      .then((data) => { if (!cancelled) setMentionCandidates(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mentionQuery, conversation.id]);

  function selectMention(candidate, kind) {
    const name = candidate.name;
    setDraft((prev) => prev.replace(/@([^\s@]*)$/, `@${name} `));
    setPendingMentions((prev) => [
      ...prev.filter((m) => m.name !== name),
      kind === "employee" ? { employeeId: candidate.id, name } : { userId: candidate.id, name },
    ]);
    setMentionQuery(null);
  }

  function resolveMentionsFor(body) {
    return pendingMentions
      .filter((m) => body.includes(`@${m.name}`))
      .map((m) => (m.employeeId ? { employeeId: m.employeeId } : { userId: m.userId }));
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body && !pendingAttachment) return;
    setSending(true);
    setError(null);
    try {
      const payload = { body, replyToId: replyTo?.id, mentions: resolveMentionsFor(body) };
      if (pendingAttachment?.kind === "image") {
        payload.imageUrl = pendingAttachment.url;
      } else if (pendingAttachment?.kind === "file") {
        Object.assign(payload, {
          attachmentType: "FILE",
          attachmentUrl: pendingAttachment.url,
          attachmentName: pendingAttachment.name,
          attachmentSize: pendingAttachment.size,
        });
      } else if (pendingAttachment?.kind === "audio") {
        Object.assign(payload, {
          attachmentType: "AUDIO",
          attachmentUrl: pendingAttachment.url,
          attachmentName: pendingAttachment.name,
          attachmentSize: pendingAttachment.size,
        });
      } else if (pendingAttachment?.kind === "voice") {
        Object.assign(payload, {
          attachmentType: "VOICE",
          attachmentUrl: pendingAttachment.url,
          attachmentDurationSec: pendingAttachment.durationSec,
          attachmentSize: pendingAttachment.size,
        });
      }

      const message = await sendMessage(conversation.id, payload);
      setMessages((prev) => [...prev, message]);
      lastFetchRef.current = message.createdAt;
      setDraft("");
      setPendingAttachment(null);
      setReplyTo(null);
      setPendingMentions([]);
      setMentionQuery(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send this message.");
    } finally {
      setSending(false);
    }
  }

  async function handleBroadcastSend() {
    const body = broadcastDraft.trim();
    if (!body || !onBroadcast) return;
    setBroadcasting(true);
    setError(null);
    try {
      const message = await onBroadcast(body);
      setMessages((prev) => [...prev, message]);
      lastFetchRef.current = message.createdAt;
      setBroadcastDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send this announcement.");
    } finally {
      setBroadcasting(false);
    }
  }

  async function handleReact(message, emoji, recognition = false) {
    setActionSheetFor(null);
    try {
      const { reactions } = await reactToMessage(conversation.id, message.id, emoji, recognition);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions } : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not react to this message.");
    }
  }

  function startEdit(message) {
    setActionSheetFor(null);
    setEditingId(message.id);
    setEditDraft(message.body);
  }

  async function submitEdit(message) {
    const body = editDraft.trim();
    if (!body) return;
    try {
      const updated = await editMessage(conversation.id, message.id, body);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? updated : m)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this edit.");
    }
  }

  async function handleDelete(message) {
    setActionSheetFor(null);
    try {
      const updated = await deleteMessage(conversation.id, message.id);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? updated : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this message.");
    }
  }

  // The most recent message I sent — the only bubble that ever shows a
  // Sent/Seen indicator (matches how real messengers only mark the
  // latest, not every prior message).
  const myLastMessageId = [...messages].reverse().find((m) =>
    currentUserKind === "staff" ? m.senderUserId === currentUserId : m.senderEmployeeId === currentUserId
  )?.id;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-96px)]">
      <div className="px-4 sm:px-6 py-3.5 flex items-center gap-2.5 border-b border-white/[0.06]">
        <button type="button" onClick={onBack} className="shrink-0 p-1.5 -ml-1.5 text-[#9AA1B4] hover:text-white">
          <ArrowLeft size={18} />
        </button>

        {searchOpen ? (
          <div className="flex-1 flex items-center gap-2">
            <Search size={15} className="shrink-0 text-[#4C5266]" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this conversation..."
              className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-[#4C5266] outline-none"
            />
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="shrink-0 p-1.5 text-[#4C5266] hover:text-white"
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <span
              className={`relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                isWarnings ? "bg-amber-500/15 text-amber-400" : "bg-[#F47A20]/10 text-[#F47A20]"
              }`}
            >
              {conversation.pictureUrl ? (
                <AuthenticatedImage src={conversation.pictureUrl} alt="" className="w-full h-full object-cover" />
              ) : isWarnings ? (
                <ShieldAlert size={16} />
              ) : conversation.type === "CUSTOM_GROUP" || conversation.type === "MARKET_GROUP" || conversation.type === "ZONE_GROUP" ? (
                <Users2 size={16} />
              ) : (
                <MessageCircle size={16} />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-white truncate">{conversation.title}</h1>
              {conversation.type === "CUSTOM_GROUP" && groupMembers && (
                <p className="text-[11px] text-[#8B93A8]">{groupMembers.length} member{groupMembers.length === 1 ? "" : "s"}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="shrink-0 p-1.5 text-[#9AA1B4] hover:text-white"
              aria-label="Search in conversation"
            >
              <Search size={17} />
            </button>
            {conversation.type === "CUSTOM_GROUP" && onOpenGroupInfo && (
              <button
                type="button"
                onClick={onOpenGroupInfo}
                className="shrink-0 p-1.5 -mr-1.5 text-[#9AA1B4] hover:text-white"
                aria-label="Group info"
              >
                <Users2 size={17} />
              </button>
            )}
          </>
        )}
      </div>

      {searchOpen ? (
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {searchQuery.trim().length < 2 ? (
            <p className="text-center text-xs text-[#4C5266] py-6">Type at least 2 characters to search.</p>
          ) : searchingMessages ? (
            <p className="text-center text-xs text-[#4C5266] py-6">Searching...</p>
          ) : searchResults?.messages?.length ? (
            <div className="space-y-2">
              {searchResults.messages.map((m) => (
                <div key={m.id} className="rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#F47A20]">{m.senderEmployee?.name || m.senderUser?.name}</p>
                    <p className="text-[10px] text-[#4C5266] shrink-0">{timeLabel(m.createdAt)}</p>
                  </div>
                  <p className="text-sm text-white mt-0.5">{m.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-[#4C5266] py-6">No messages found.</p>
          )}
        </div>
      ) : (
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2.5">
        {loadingInitial ? (
          <p className="text-center text-xs text-[#4C5266] py-6">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-[#4C5266] py-10">No messages yet.</p>
        ) : (
          <>
            {loadingOlder && <p className="text-center text-[11px] text-[#4C5266] py-2">Loading older messages...</p>}
            {messages.map((m) => {
              const isMine = currentUserKind === "staff" ? m.senderUserId === currentUserId : m.senderEmployeeId === currentUserId;
              const senderName = m.senderEmployee?.name || m.senderUser?.name;
              const senderPictureUrl = m.senderEmployee?.profilePictureUrl || m.senderUser?.profilePictureUrl;
              const isDeleted = !!m.deletedAt;
              const isEditing = editingId === m.id;
              const replySenderName = m.replyTo?.senderEmployee?.name || m.replyTo?.senderUser?.name;
              const showSenderInfo = !isMine && GROUP_LIKE_TYPES.has(conversation.type);

              return (
                <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`group flex items-end gap-2 max-w-[82%] ${isMine ? "flex-row-reverse" : ""}`}>
                    {showSenderInfo && (
                      <span className="shrink-0 mb-1 w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-semibold text-white overflow-hidden">
                        {senderPictureUrl ? (
                          <AuthenticatedImage src={senderPictureUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          initialsOf(senderName || "?")
                        )}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 ${
                        isDeleted
                          ? "bg-white/[0.03] border border-white/[0.06] text-[#6B7280] italic"
                          : isMine
                          ? "bg-[#F47A20] text-white rounded-br-md"
                          : isWarnings
                          ? "bg-amber-500/10 border border-amber-500/20 text-white rounded-bl-md"
                          : "bg-[#1A1F33]/80 border border-white/[0.06] text-white rounded-bl-md"
                      }`}
                    >
                      {showSenderInfo && senderName && !isDeleted && (
                        <p className="text-[11px] font-semibold text-[#F47A20] mb-0.5">
                          {senderName}
                          {m.senderUser?.role && <span className="font-normal text-[#8B93A8]"> · {roleLabel(m.senderUser.role)}</span>}
                        </p>
                      )}
                      {!showSenderInfo && !isMine && senderName && !isDeleted && (
                        <p className="text-[11px] font-semibold text-[#F47A20] mb-0.5">{senderName}</p>
                      )}
                      {isMine && GROUP_LIKE_TYPES.has(conversation.type) && !isDeleted && (
                        <p className="text-[11px] font-semibold text-white/80 mb-0.5">You</p>
                      )}
                      {m.forwardedFromSenderName && !isDeleted && (
                        <p className={`flex items-center gap-1 text-[11px] italic mb-0.5 ${isMine ? "text-white/70" : "text-[#8B93A8]"}`}>
                          <Forward size={11} /> Forwarded from {m.forwardedFromSenderName}
                        </p>
                      )}

                      {isDeleted ? (
                        <p className="text-sm flex items-center gap-1.5"><Trash2 size={12} /> This message was deleted</p>
                      ) : (
                        <>
                          {m.replyTo && (
                            <div className={`mb-1.5 rounded-lg px-2.5 py-1.5 border-l-2 ${isMine ? "bg-black/10 border-white/40" : "bg-black/20 border-[#F47A20]/50"}`}>
                              <p className="text-[10px] font-semibold opacity-80">{replySenderName || "Deleted message"}</p>
                              <p className="text-xs opacity-70 truncate">{m.replyTo.deletedAt ? "This message was deleted" : m.replyTo.body}</p>
                            </div>
                          )}

                          {isEditing ? (
                            <div className="min-w-[200px]">
                              <textarea
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                rows={2}
                                autoFocus
                                className="w-full resize-none rounded-lg bg-black/20 border border-white/20 px-2 py-1.5 text-sm text-white outline-none"
                              />
                              <div className="flex justify-end gap-2 mt-1.5">
                                <button type="button" onClick={() => setEditingId(null)} className="text-xs opacity-80 hover:opacity-100">Cancel</button>
                                <button type="button" onClick={() => submitEdit(m)} className="text-xs font-semibold">Save</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {m.body && <p className="text-sm whitespace-pre-wrap break-words">{renderBody(m.body, m.mentions)}</p>}
                              <MessageAttachment message={m} />
                            </>
                          )}

                          <ReactionPills
                            reactions={m.reactions}
                            currentUserId={currentUserId}
                            currentUserKind={currentUserKind}
                            onToggle={(emoji) => handleReact(m, emoji)}
                          />

                          <div className={`flex items-center gap-1 mt-1 ${isMine ? "text-white/70" : "text-[#8B93A8]"}`}>
                            <p className="text-[10px]">{timeLabel(m.createdAt)}{m.editedAt ? " · Edited" : ""}</p>
                            {isMine && m.id === myLastMessageId && (
                              theirLastReadAt && new Date(theirLastReadAt) >= new Date(m.createdAt) ? (
                                <span className="flex items-center gap-0.5 text-[10px]" title="Seen"><CheckCheck size={11} /> Seen</span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-[10px]" title="Sent"><Check size={11} /></span>
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {!isDeleted && !isEditing && (
                      <button
                        type="button"
                        onClick={() => setActionSheetFor(m)}
                        className="shrink-0 mb-1 p-1.5 rounded-full text-[#4C5266] hover:text-white hover:bg-white/[0.06] sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        aria-label="Message actions"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      )}

      {isWarnings && onBroadcast ? (
        <div className="px-4 sm:px-6 py-3 border-t border-white/[0.06]">
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={broadcastDraft}
              onChange={(e) => setBroadcastDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleBroadcastSend();
                }
              }}
              rows={1}
              placeholder={conversation.type === "ZONE_ANNOUNCEMENTS" ? "Send an announcement to your zone..." : "Send an announcement to your market..."}
              className="flex-1 min-w-0 resize-none rounded-xl bg-white/[0.04] border border-amber-500/20 px-3.5 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-amber-500/50 max-h-28"
            />
            <button
              type="button"
              onClick={handleBroadcastSend}
              disabled={broadcasting || !broadcastDraft.trim()}
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white bg-amber-500/80 hover:bg-amber-500 disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
            >
              {broadcasting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
        </div>
      ) : isWarnings ? (
        <div className="px-4 sm:px-6 py-3 border-t border-white/[0.06] flex items-center gap-2 text-xs text-[#8B93A8]">
          <ShieldAlert size={14} className="text-amber-400 shrink-0" />
          {conversation.type === "ZONE_ANNOUNCEMENTS" ? "Only a Regional Manager or Admin can post here." : "Only a supervisor can post here."}
        </div>
      ) : (
        <div className="px-4 sm:px-6 py-3 border-t border-white/[0.06]">
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-lg p-2 bg-white/[0.04] border-l-2 border-[#F47A20]/60">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-[#F47A20]">
                  Replying to {replyTo.senderEmployee?.name || replyTo.senderUser?.name || "message"}
                </p>
                <p className="text-xs text-[#9AA1B4] truncate">{replyTo.body || "Attachment"}</p>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="p-1 text-[#4C5266] hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {recordingVoice ? (
            <VoiceRecorder onRecorded={handleVoiceRecorded} onCancel={() => setRecordingVoice(false)} />
          ) : (
            <>
              {pendingAttachment && (
                <div className="mb-2 flex items-center gap-2 rounded-lg p-2 bg-white/[0.04] border border-white/[0.06]">
                  {pendingAttachment.kind === "image" ? (
                    <AuthenticatedImage src={pendingAttachment.url} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <span className="w-10 h-10 rounded bg-white/[0.06] flex items-center justify-center text-[#9AA1B4]">
                      {pendingAttachment.kind === "voice" ? <Mic size={16} /> : <FileIcon size={16} />}
                    </span>
                  )}
                  <span className="flex-1 min-w-0 text-xs text-[#9AA1B4] truncate">
                    {pendingAttachment.name ||
                      (pendingAttachment.kind === "voice" ? `Voice message · ${formatDuration(pendingAttachment.durationSec)}` : "Photo attached")}
                  </span>
                  <button type="button" onClick={() => setPendingAttachment(null)} className="p-1 text-[#4C5266] hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              )}

              {mentionQuery !== null && (mentionCandidates.employees.length > 0 || mentionCandidates.staff.length > 0) && (
                <div className="mb-2 max-h-40 overflow-y-auto rounded-xl bg-[#1F2436] border border-white/10 shadow-xl">
                  {[...mentionCandidates.employees.map((c) => ({ ...c, kind: "employee" })), ...mentionCandidates.staff.map((c) => ({ ...c, kind: "staff" }))].map((c) => (
                    <button
                      key={`${c.kind}-${c.id}`}
                      type="button"
                      onClick={() => selectMention(c, c.kind)}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-white hover:bg-white/[0.06] text-left"
                    >
                      <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </span>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setAttachMenuOpen((v) => !v)}
                    disabled={attachBusy}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-[#9AA1B4] bg-white/[0.05] hover:bg-white/[0.09] disabled:opacity-50"
                  >
                    {attachBusy ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
                  </button>
                  {attachMenuOpen && (
                    <div className="absolute bottom-14 left-0 z-10 w-44 rounded-xl bg-[#1F2436] border border-white/10 shadow-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="w-full flex items-center gap-2.5 px-3.5 py-3 text-sm text-white hover:bg-white/[0.06]"
                      >
                        <Camera size={15} /> Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center gap-2.5 px-3.5 py-3 text-sm text-white hover:bg-white/[0.06]"
                      >
                        <FileIcon size={15} /> File
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAttachMenuOpen(false); setRecordingVoice(true); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-3 text-sm text-white hover:bg-white/[0.06]"
                      >
                        <Mic size={15} /> Voice Message
                      </button>
                    </div>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoSelected(e.target.files[0])}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files[0])}
                  />
                </div>

                <textarea
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Message... (@ to mention)"
                  className="flex-1 min-w-0 resize-none rounded-xl bg-white/[0.04] border border-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 max-h-28"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || (!draft.trim() && !pendingAttachment)}
                  className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
                >
                  {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {actionSheetFor && (
        <MessageActionSheet
          message={actionSheetFor}
          canEdit={
            !actionSheetFor.attachmentType && !actionSheetFor.imageUrl &&
            (currentUserKind === "staff" ? actionSheetFor.senderUserId === currentUserId : actionSheetFor.senderEmployeeId === currentUserId)
          }
          canDelete={currentUserKind === "staff" ? actionSheetFor.senderUserId === currentUserId : actionSheetFor.senderEmployeeId === currentUserId}
          canRecognize={currentUserKind === "staff" && !!actionSheetFor.senderEmployeeId}
          canSeeSeenBy={GROUP_LIKE_TYPES.has(conversation.type)}
          onClose={() => setActionSheetFor(null)}
          onReact={(emoji, recognition) => handleReact(actionSheetFor, emoji, recognition)}
          onReply={() => { setReplyTo(actionSheetFor); setActionSheetFor(null); }}
          onForward={() => { setForwardingMessage(actionSheetFor); setActionSheetFor(null); }}
          onCopy={async () => { await copyText(actionSheetFor.body); setActionSheetFor(null); }}
          onEdit={() => startEdit(actionSheetFor)}
          onDelete={() => handleDelete(actionSheetFor)}
          onSeenBy={() => { setSeenByFor(actionSheetFor); setActionSheetFor(null); }}
        />
      )}

      {forwardingMessage && (
        <ForwardMessageModal
          message={forwardingMessage}
          currentUserKind={currentUserKind}
          onClose={() => setForwardingMessage(null)}
        />
      )}

      {seenByFor && (
        <SeenByModal conversationId={conversation.id} messageId={seenByFor.id} onClose={() => setSeenByFor(null)} />
      )}
    </div>
  );
}
