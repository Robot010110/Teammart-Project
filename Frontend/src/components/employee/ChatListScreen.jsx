import { useState } from "react";
import { Users2, ShieldAlert, MessageCircle, ChevronRight } from "lucide-react";
import ConversationScreen from "./ConversationScreen";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { listMyConversations, listCoworkers, getOrCreateDirect } from "../../services/chatService";
import { useAsync } from "../../hooks/useAsync";
import { usePolling } from "../../hooks/usePolling";

const LIST_POLL_MS = 12000;

function ConversationRow({ conversation, onOpen }) {
  const isWarnings = conversation.type === "WARNINGS";
  const isGroup = conversation.type === "MARKET_GROUP";
  const Icon = isWarnings ? ShieldAlert : isGroup ? Users2 : MessageCircle;

  return (
    <button
      type="button"
      onClick={() => onOpen(conversation)}
      className={`w-full flex items-center gap-3 rounded-xl p-3.5 border transition-colors ${
        isWarnings
          ? "bg-amber-500/[0.06] border-amber-500/20 hover:border-amber-500/35"
          : "bg-[#1A1F33]/70 border-white/[0.06] hover:border-[#F47A20]/25"
      }`}
    >
      <span
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isWarnings ? "bg-amber-500/15 text-amber-400" : "bg-[#F47A20]/10 text-[#F47A20]"
        }`}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium truncate ${isWarnings ? "text-amber-300" : "text-white"}`}>
            {conversation.title}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F47A20] text-white text-[10px] font-bold flex items-center justify-center">
              {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
            </span>
          )}
        </div>
        <p className="text-xs text-[#8B93A8] truncate mt-0.5">
          {conversation.lastMessage ? conversation.lastMessage.body : "No messages yet"}
        </p>
      </div>
      <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
    </button>
  );
}

// ChatListScreen.jsx — the Chat tab's content: Market Group + Warnings
// (visually distinct, amber) pinned at the top, then any Direct
// conversations, then a coworker list to start a new one. Polling-based
// (12s) same as ConversationScreen — no WebSocket in this app.
export default function ChatListScreen({ currentEmployeeId }) {
  const { data: conversations, setData: setConversations, error, loading, reload } = useAsync(
    listMyConversations,
    { deps: [] }
  );
  const { data: coworkers } = useAsync(listCoworkers, { deps: [] });
  const [selected, setSelected] = useState(null);
  const [startingId, setStartingId] = useState(null);

  usePolling(() => reload(), LIST_POLL_MS, []);

  async function handleStartDirect(coworker) {
    setStartingId(coworker.id);
    try {
      const conversation = await getOrCreateDirect(coworker.id);
      setSelected({ ...conversation, title: coworker.name, unreadCount: 0, lastMessage: null });
      reload();
    } finally {
      setStartingId(null);
    }
  }

  if (selected) {
    return (
      <ConversationScreen
        conversation={selected}
        currentEmployeeId={currentEmployeeId}
        onBack={() => {
          setSelected(null);
          reload();
        }}
      />
    );
  }

  const directs = conversations?.filter((c) => c.type === "DIRECT") ?? [];
  const pinned = conversations?.filter((c) => c.type !== "DIRECT") ?? [];
  const directPartnerIds = new Set(directs.map((c) => c.otherEmployeeId));

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Chat</h1>

      {loading ? (
        <SkeletonCard className="h-40" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          <div className="space-y-2">
            {pinned.map((c) => (
              <ConversationRow key={c.id} conversation={c} onOpen={setSelected} />
            ))}
            {directs.map((c) => (
              <ConversationRow key={c.id} conversation={c} onOpen={setSelected} />
            ))}
          </div>

          {coworkers?.length > 0 && (
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
                    </button>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
