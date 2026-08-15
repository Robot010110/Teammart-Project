import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, ShieldAlert, Loader2, Paperclip, Camera, File as FileIcon, Mic, Download, X } from "lucide-react";
import { listMessages, sendMessage, markConversationRead } from "../../services/chatService";
import { usePolling } from "../../hooks/usePolling";
import { prepareImageForUpload } from "../../services/activityService";
import { readFileAsDataUrl, formatFileSize, formatDuration } from "../../utils/fileEncoding";
import VoiceRecorder from "./VoiceRecorder";
import { ApiError } from "../../services/apiClient";

const POLL_MS = 4000;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function MessageAttachment({ message }) {
  if (message.imageUrl) {
    return <img src={message.imageUrl} alt="" className="mt-1.5 rounded-lg max-h-56 w-full object-cover" />;
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

// ConversationScreen.jsx — one open thread. Polls for new messages every
// 4s (delta fetch via ?after=, so this stays cheap even with a lot of
// history) — no WebSocket in this app, this is the agreed-on tradeoff.
// The composer is hidden entirely on Warnings for employees (posting
// there is staff-only — see backend chatController.sendMessage).
//
// Attachments: Photo reuses activityService.prepareImageForUpload (same
// compression pipeline as everywhere else a photo is captured in this
// app); File/Voice use the new readFileAsDataUrl (no compression — not
// meaningful for arbitrary files or already-compressed audio). Both are
// the same "temporary base64 data-URL stand-in" convention documented on
// prepareImageForUpload — there is no real upload endpoint anywhere in
// this backend yet.
//
// currentUserKind/currentUserId — generalized so the exact same component
// backs both the Employee Chat tab (kind="employee") and the Supervisor
// Chat tab's individual-employee conversations (kind="staff"), instead of
// the Supervisor side maintaining a separate, simplified message-list
// component backed by mock data. A message is "mine" when its sender
// matches the caller's own kind+id — a SUPERVISOR_DIRECT conversation has
// exactly one Employee sender and one staff sender, so this is unambiguous.
export default function ConversationScreen({ conversation, currentUserId, currentUserKind = "employee", onBack }) {
  const [messages, setMessages] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null); // { kind, url, name, size, durationSec }
  const [attachBusy, setAttachBusy] = useState(false);
  const lastFetchRef = useRef(null);
  const scrollRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const isWarnings = conversation.type === "WARNINGS";

  usePolling(
    async () => {
      try {
        const after = lastFetchRef.current;
        const batch = await listMessages(conversation.id, after ? { after } : undefined);
        if (batch.length > 0) {
          setMessages((prev) => [...prev, ...batch]);
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
  }, [messages.length, pendingAttachment]);

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
      const url = await readFileAsDataUrl(file);
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

  async function handleSend() {
    const body = draft.trim();
    if (!body && !pendingAttachment) return;
    setSending(true);
    setError(null);
    try {
      const payload = { body };
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send this message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-96px)]">
      <div className="px-4 sm:px-6 py-4 flex items-center gap-2 border-b border-white/[0.06]">
        <button type="button" onClick={onBack} className="p-1.5 -ml-1.5 text-[#9AA1B4] hover:text-white">
          <ArrowLeft size={18} />
        </button>
        {isWarnings && <ShieldAlert size={16} className="text-amber-400" />}
        <h1 className="text-sm font-semibold text-white truncate">{conversation.title}</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2.5">
        {loadingInitial ? (
          <p className="text-center text-xs text-[#4C5266] py-6">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-[#4C5266] py-10">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isMine = currentUserKind === "staff" ? m.senderUserId === currentUserId : m.senderEmployeeId === currentUserId;
            const senderName = m.senderEmployee?.name || m.senderUser?.name;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                    isMine
                      ? "bg-[#F47A20] text-white rounded-br-md"
                      : isWarnings
                      ? "bg-amber-500/10 border border-amber-500/20 text-white rounded-bl-md"
                      : "bg-[#1A1F33]/80 border border-white/[0.06] text-white rounded-bl-md"
                  }`}
                >
                  {!isMine && senderName && (
                    <p className="text-[11px] font-semibold text-[#F47A20] mb-0.5">{senderName}</p>
                  )}
                  {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                  <MessageAttachment message={m} />
                  <p className={`text-[10px] mt-1 ${isMine ? "text-white/70" : "text-[#8B93A8]"}`}>{timeLabel(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isWarnings ? (
        <div className="px-4 sm:px-6 py-3 border-t border-white/[0.06] flex items-center gap-2 text-xs text-[#8B93A8]">
          <ShieldAlert size={14} className="text-amber-400 shrink-0" /> Only a supervisor can post here.
        </div>
      ) : (
        <div className="px-4 sm:px-6 py-3 border-t border-white/[0.06]">
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

          {recordingVoice ? (
            <VoiceRecorder onRecorded={handleVoiceRecorded} onCancel={() => setRecordingVoice(false)} />
          ) : (
            <>
              {pendingAttachment && (
                <div className="mb-2 flex items-center gap-2 rounded-lg p-2 bg-white/[0.04] border border-white/[0.06]">
                  {pendingAttachment.kind === "image" ? (
                    <img src={pendingAttachment.url} alt="" className="h-10 w-10 rounded object-cover" />
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
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Message..."
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
    </div>
  );
}
