import { useState } from "react";
import { Users2, ShieldAlert, MessageCircle, ChevronRight } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import SupervisorConversationScreen from "./SupervisorConversationScreen";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { postWarningBroadcast } from "../../services/chatService";
import { ApiError } from "../../services/apiClient";
import {
  listMockConversations,
  getOrCreateEmployeeConversation,
  sendMockMessage,
  sendEmployeeMessage,
} from "../../data/supervisorMockData";
import { initialsOf } from "../../utils/initials";

const CHANNEL_ICON = { ZONE_MANAGER_GROUP: Users2, MARKET_GROUP: Users2, WARNINGS: ShieldAlert, ZONE_MANAGER_DIRECT: MessageCircle, OVERLOOKING_DIRECT: MessageCircle };

function ChannelRow({ conversation, onOpen }) {
  const Icon = CHANNEL_ICON[conversation.type] || MessageCircle;
  const isWarnings = conversation.type === "WARNINGS";
  const last = conversation.messages[conversation.messages.length - 1];
  return (
    <button
      type="button"
      onClick={() => onOpen(conversation)}
      className={`w-full flex items-center gap-3 rounded-xl p-3.5 border transition-colors ${
        isWarnings ? "bg-amber-500/[0.06] border-amber-500/20 hover:border-amber-500/35" : "bg-[#1A1F33]/70 border-white/[0.06] hover:border-[#F47A20]/25"
      }`}
    >
      <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isWarnings ? "bg-amber-500/15 text-amber-400" : "bg-[#F47A20]/10 text-[#F47A20]"}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium truncate ${isWarnings ? "text-amber-300" : "text-white"}`}>{conversation.title}</p>
          {conversation.unreadCount > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F47A20] text-white text-[10px] font-bold flex items-center justify-center">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        <p className="text-xs text-[#8B93A8] truncate mt-0.5">{last ? last.body : isWarnings ? "Send an announcement to your market" : "No messages yet"}</p>
      </div>
      <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
    </button>
  );
}

// SupervisorChatTab.jsx — the Chat tab: 5 structurally-separate channel
// types (spec §13/§14) plus individual employee chats. Only Warnings has
// a real backend send path today (postWarningBroadcast) — everything
// else is local mock state clearly scoped to this session, per
// data/supervisorMockData.js's own doc comment on why (no messaging
// backend exists yet for Zone Manager / Overlooking / Market Group reads
// from a staff token — see chatController.js, gated requireEmployeeAuth).
export default function SupervisorChatTab({ session }) {
  const { data: conversations, setData: setConversations, error, loading, reload } = useAsync(listMockConversations, { deps: [] });
  const { data: employees } = useAsync(() => listEmployeesByMarket(session.marketId), { deps: [session.marketId] });

  const [openChannel, setOpenChannel] = useState(null); // { kind: "channel", conversation } | { kind: "employee", employeeId, name }
  const [employeeConvo, setEmployeeConvo] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  async function openEmployeeChat(employee) {
    const convo = await getOrCreateEmployeeConversation(employee.id, employee.name);
    setEmployeeConvo(convo);
    setOpenChannel({ kind: "employee", employeeId: employee.id });
  }

  async function handleSend(body) {
    setSending(true);
    setSendError(null);
    try {
      if (openChannel.kind === "employee") {
        await sendEmployeeMessage(openChannel.employeeId, body);
        const fresh = await getOrCreateEmployeeConversation(openChannel.employeeId, employeeConvo.title);
        setEmployeeConvo(fresh);
        return true;
      }
      const conversation = openChannel.conversation;
      if (conversation.type === "WARNINGS") {
        await postWarningBroadcast(session.marketId, body);
        // No staff read-back exists (chatController is employee-only for
        // GET) — reflect what was just sent locally so the Supervisor
        // sees confirmation, honestly labeled as "sent" not "synced".
        conversation.messages = [...conversation.messages, { id: `m-${Date.now()}`, from: "Me", body, createdAt: new Date().toISOString(), fromMe: true }];
        setConversations((prev) => prev.map((c) => (c.id === conversation.id ? { ...conversation } : c)));
      } else {
        await sendMockMessage(conversation.id, body);
        const fresh = await listMockConversations();
        setConversations(fresh);
        setOpenChannel({ kind: "channel", conversation: fresh.find((c) => c.id === conversation.id) });
      }
      return true;
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Could not send this message.");
      return false;
    } finally {
      setSending(false);
    }
  }

  if (openChannel?.kind === "channel") {
    return (
      <SupervisorConversationScreen
        title={openChannel.conversation.title}
        isWarnings={openChannel.conversation.type === "WARNINGS"}
        messages={openChannel.conversation.messages}
        onSend={handleSend}
        sending={sending}
        sendError={sendError}
        onBack={() => { setOpenChannel(null); setSendError(null); }}
      />
    );
  }
  if (openChannel?.kind === "employee" && employeeConvo) {
    return (
      <SupervisorConversationScreen
        title={employeeConvo.title}
        isWarnings={false}
        messages={employeeConvo.messages}
        onSend={handleSend}
        sending={sending}
        sendError={sendError}
        onBack={() => { setOpenChannel(null); setSendError(null); }}
      />
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Chat</h1>

      {loading ? (
        <SkeletonCard className="h-40" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <ChannelRow key={c.id} conversation={c} onOpen={(conversation) => setOpenChannel({ kind: "channel", conversation })} />
          ))}
        </div>
      )}

      {employees?.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Individual Employees</h2>
          <div className="space-y-2">
            {employees.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => openEmployeeChat(e)}
                className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                  {initialsOf(e.name)}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-white truncate">{e.name}</p>
                  <p className="text-xs text-[#8B93A8]">{e.position}</p>
                </div>
                <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
