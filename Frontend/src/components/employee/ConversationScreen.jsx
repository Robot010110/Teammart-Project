import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, ShieldAlert, Loader2 } from "lucide-react";
import { listMessages, sendMessage, markConversationRead } from "../../services/chatService";
import { usePolling } from "../../hooks/usePolling";
import { ApiError } from "../../services/apiClient";

const POLL_MS = 4000;

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ConversationScreen.jsx — one open thread. Polls for new messages every
// 4s (delta fetch via ?after=, so this stays cheap even with a lot of
// history) — no WebSocket in this app, this is the agreed-on tradeoff.
// The composer is hidden entirely on Warnings for employees (posting
// there is staff-only — see backend chatController.sendMessage).
export default function ConversationScreen({ conversation, currentEmployeeId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(null);
  const scrollRef = useRef(null);

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
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const message = await sendMessage(conversation.id, { body });
      setMessages((prev) => [...prev, message]);
      lastFetchRef.current = message.createdAt;
      setDraft("");
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
            const isMine = m.senderEmployeeId === currentEmployeeId;
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
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
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
          <div className="flex items-end gap-2">
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
              disabled={sending || !draft.trim()}
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
            >
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
