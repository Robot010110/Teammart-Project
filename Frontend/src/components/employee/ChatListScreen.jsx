import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Users2, ShieldAlert, MessageCircle, ChevronRight, Search, Pin, PinOff, BellOff, Bell, MoreVertical, X } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { listMyConversations, listCoworkers, getOrCreateDirect, setConversationPreference, searchMessages } from "../../services/chatService";
import { useAsync } from "../../hooks/useAsync";
import { usePolling } from "../../hooks/usePolling";

const LIST_POLL_MS = 12000;

function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ConversationRow({ conversation, onOpen, onMore }) {
  const isWarnings = conversation.type === "WARNINGS";
  const isGroup = conversation.type === "MARKET_GROUP";
  const Icon = isWarnings ? ShieldAlert : isGroup ? Users2 : MessageCircle;

  return (
    <div
      className={`w-full flex items-center gap-3 rounded-xl p-3.5 border transition-colors ${
        isWarnings
          ? "bg-amber-500/[0.06] border-amber-500/20 hover:border-amber-500/35"
          : "bg-[#1A1F33]/70 border-white/[0.06] hover:border-[#F47A20]/25"
      }`}
    >
      <button type="button" onClick={() => onOpen(conversation)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
        <span
          className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isWarnings ? "bg-amber-500/15 text-amber-400" : "bg-[#F47A20]/10 text-[#F47A20]"
          }`}
        >
          <Icon size={18} />
          {conversation.pinned && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <Pin size={9} className="text-[#F47A20]" fill="currentColor" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-medium truncate flex items-center gap-1.5 ${isWarnings ? "text-amber-300" : "text-white"}`}>
              {conversation.title}
              {conversation.muted && <BellOff size={11} className="text-[#4C5266] shrink-0" />}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {conversation.lastMessage && <span className="text-[10px] text-[#4C5266]">{timeLabel(conversation.lastMessage.createdAt)}</span>}
              {conversation.unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#F47A20] text-white text-[10px] font-bold flex items-center justify-center">
                  {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-[#8B93A8] truncate mt-0.5">
            {conversation.lastMessage ? (conversation.lastMessage.deleted ? "Message deleted" : conversation.lastMessage.body || "Sent an attachment") : "No messages yet"}
          </p>
        </div>
      </button>
      <button type="button" onClick={() => onMore(conversation)} className="p-1.5 text-[#4C5266] hover:text-white shrink-0" aria-label="More options">
        <MoreVertical size={16} />
      </button>
    </div>
  );
}

function ConversationOptionsSheet({ conversation, onClose, onTogglePin, onToggleMute }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm sm:mx-4 rounded-t-2xl sm:rounded-2xl bg-[#1F2436] border border-white/10 shadow-2xl animate-fade-up overflow-hidden py-1.5">
        <button type="button" onClick={onTogglePin} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/[0.05]">
          {conversation.pinned ? <PinOff size={16} /> : <Pin size={16} />} {conversation.pinned ? "Unpin" : "Pin"} conversation
        </button>
        <button type="button" onClick={onToggleMute} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/[0.05]">
          {conversation.muted ? <Bell size={16} /> : <BellOff size={16} />} {conversation.muted ? "Unmute" : "Mute"} notifications
        </button>
      </div>
    </div>,
    document.body
  );
}

// ChatListScreen.jsx — the Chat tab's content: Market Group, Warnings
// (visually distinct, amber), the Supervisor conversation, and any Direct
// conversations, pinned ones first (real state — see
// chatController.listMyConversations's own sort), then a coworker list
// to start a new one. A search box filters this list by name/last
// message instantly (client-side — the list is always small) and, once
// 2+ characters are typed, also queries the backend for matching message
// text across the employee's own conversations (never loads full history
// into the browser just to filter it). Opening a conversation navigates
// to a real route (:conversationId) instead of flipping local state —
// see ConversationRoute.jsx for the other half. Polling-based (12s) — no
// WebSocket in this app.
export default function ChatListScreen({ currentEmployeeId, basePath }) {
  const { data: conversations, setData: setConversations, error, loading, reload } = useAsync(listMyConversations, { deps: [] });
  const { data: coworkers } = useAsync(listCoworkers, { deps: [] });
  const [startingId, setStartingId] = useState(null);
  const [optionsFor, setOptionsFor] = useState(null);
  const [query, setQuery] = useState("");
  const { data: searchResults, loading: searching } = useAsync(
    () => (query.trim().length >= 2 ? searchMessages(query.trim()) : Promise.resolve(null)),
    { deps: [query] }
  );
  const navigate = useNavigate();

  usePolling(() => reload(), LIST_POLL_MS, []);

  async function handleStartDirect(coworker) {
    setStartingId(coworker.id);
    try {
      const conversation = await getOrCreateDirect(coworker.id);
      navigate(`${basePath}/chat/${conversation.id}`);
    } finally {
      setStartingId(null);
    }
  }

  async function handleTogglePin(conversation) {
    setOptionsFor(null);
    const next = !conversation.pinned;
    setConversations((prev) => prev?.map((c) => (c.id === conversation.id ? { ...c, pinned: next } : c)));
    try {
      await setConversationPreference(conversation.id, { pinned: next });
      reload();
    } catch {
      reload();
    }
  }

  async function handleToggleMute(conversation) {
    setOptionsFor(null);
    const next = !conversation.muted;
    setConversations((prev) => prev?.map((c) => (c.id === conversation.id ? { ...c, muted: next } : c)));
    try {
      await setConversationPreference(conversation.id, { muted: next });
    } catch {
      reload();
    }
  }

  const q = query.trim().toLowerCase();
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!q) return conversations;
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.lastMessage?.body ?? "").toLowerCase().includes(q)
    );
  }, [conversations, q]);

  const directs = conversations?.filter((c) => c.type === "DIRECT") ?? [];
  const directPartnerIds = new Set(directs.map((c) => c.otherEmployeeId));

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Chat</h1>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations or messages..."
          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] pl-10 pr-9 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4C5266] hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonCard className="h-40" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          <div className="space-y-2">
            {filteredConversations.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                onOpen={(conv) => navigate(`${basePath}/chat/${conv.id}`)}
                onMore={setOptionsFor}
              />
            ))}
            {q && filteredConversations.length === 0 && (
              <p className="text-center text-xs text-[#4C5266] py-6">No conversations found.</p>
            )}
          </div>

          {q.length >= 2 && (
            <section className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Messages</h2>
              {searching ? (
                <SkeletonCard className="h-16" />
              ) : searchResults?.messages?.length ? (
                <div className="space-y-2">
                  {searchResults.messages.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => navigate(`${basePath}/chat/${m.conversationId}`)}
                      className="w-full text-left rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25"
                    >
                      <p className="text-xs font-medium text-[#F47A20]">{m.senderEmployee?.name || m.senderUser?.name}</p>
                      <p className="text-sm text-white truncate mt-0.5">{m.body}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-[#4C5266] py-4">No messages found.</p>
              )}
            </section>
          )}

          {!q && coworkers?.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Employees</h2>
              <div className="space-y-2">
                {coworkers
                  .filter((cw) => !directPartnerIds.has(cw.id))
                  .map((cw) => (
                    <button
                      key={cw.id}
                      type="button"
                      onClick={() => handleStartDirect(cw)}
                      disabled={startingId === cw.id}
                      className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 disabled:opacity-50 transition-colors"
                    >
                      <span className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                        {cw.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-medium text-white truncate">{cw.name}</p>
                        <p className="text-xs text-[#8B93A8]">{cw.position || cw.role}</p>
                      </div>
                      <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
                    </button>
                  ))}
              </div>
            </section>
          )}
        </>
      )}

      {optionsFor && (
        <ConversationOptionsSheet
          conversation={optionsFor}
          onClose={() => setOptionsFor(null)}
          onTogglePin={() => handleTogglePin(optionsFor)}
          onToggleMute={() => handleToggleMute(optionsFor)}
        />
      )}
    </div>
  );
}
