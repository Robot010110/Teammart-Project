import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search, X } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import ChatViewTabs from "../common/ChatViewTabs";
import ChatConversationCard from "../common/ChatConversationCard";
import ConversationOptionsSheet from "../common/ConversationOptionsSheet";
import { listMyConversations, listCoworkers, getOrCreateDirect, setConversationPreference, searchMessages } from "../../services/chatService";
import { useAsync } from "../../hooks/useAsync";
import { usePolling } from "../../hooks/usePolling";

const LIST_POLL_MS = 12000;

// ChatListScreen.jsx — the Chat tab's content, shared by BOTH Employee
// and Cashier (EmployeeWorkspace.jsx/CashierWorkspace.jsx both mount
// this exact component — see their own route definitions) so the two
// roles automatically get identical Chat UI alignment with zero
// role-specific code here; only the backend data (listMyConversations/
// listCoworkers, already scoped to the caller's own market/permissions)
// differs by role. Organized via the same ChatViewTabs (Important/
// Groups/Individuals/Unread) Supervisor/RM/Admin Chat already use —
// Important People stays a real, honest empty state here rather than an
// unauthorized call, since Employee/Cashier tokens have no Important
// People backend support (see ChatViewTabs' own comment).
//
// The top search box is richer than Supervisor/RM's: it filters the
// conversation list by name/last message instantly (client-side — the
// list is always small) and, once 2+ characters are typed, also queries
// the backend for matching message text across the employee's own
// conversations (never loads full history into the browser just to
// filter it) — an existing capability, kept as-is rather than removed
// to "match" Supervisor/RM exactly. Typing a query switches the view
// from the four organized tabs to this flat filtered list, same as
// before. Opening a conversation navigates to a real route
// (:conversationId) instead of flipping local state — see
// ConversationRoute.jsx for the other half. Polling-based (12s) — no
// WebSocket in this app.
export default function ChatListScreen({ currentEmployeeId, basePath }) {
  const { data: conversations, setData: setConversations, error, loading, reload } = useAsync(listMyConversations, { deps: [] });
  const { data: coworkers } = useAsync(listCoworkers, { deps: [] });
  const [startingId, setStartingId] = useState(null);
  const [optionsFor, setOptionsFor] = useState(null);
  const [query, setQuery] = useState("");
  const [coworkerSearch, setCoworkerSearch] = useState("");
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
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">Chat</h1>
        <p className="text-sm text-[#8B93A8] mt-0.5">Your team's communication hub</p>
      </div>

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
      ) : q ? (
        <>
          <div className="space-y-2">
            {filteredConversations.map((c) => (
              <ChatConversationCard
                key={c.id}
                conversation={c}
                onOpen={(conv) => navigate(`${basePath}/chat/${conv.id}`)}
                onMore={setOptionsFor}
              />
            ))}
            {filteredConversations.length === 0 && (
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
        </>
      ) : (
        <ChatViewTabs
          conversations={conversations}
          showImportantPeople={false}
          renderRow={(c) => (
            <ChatConversationCard
              key={c.id}
              conversation={c}
              onOpen={(conv) => navigate(`${basePath}/chat/${conv.id}`)}
              onMore={setOptionsFor}
            />
          )}
          individualsExtra={
            coworkers?.filter((cw) => !directPartnerIds.has(cw.id)).length > 0 && (
              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8B93A8]">Start a new chat</h2>
                <div className="relative mb-2.5">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
                  <input
                    value={coworkerSearch}
                    onChange={(e) => setCoworkerSearch(e.target.value)}
                    placeholder="Search employees"
                    className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
                  />
                </div>
                <div className="space-y-2">
                  {coworkers
                    .filter((cw) => !directPartnerIds.has(cw.id))
                    .filter((cw) => cw.name.toLowerCase().includes(coworkerSearch.trim().toLowerCase()))
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
            )
          }
        />
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
