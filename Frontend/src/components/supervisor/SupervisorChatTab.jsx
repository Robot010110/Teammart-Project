import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Users2, ShieldAlert, MessageCircle, ChevronRight, UsersRound } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { usePolling } from "../../hooks/usePolling";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import ConversationScreen from "../employee/ConversationScreen";
import GroupInfoModal from "../employee/GroupInfoModal";
import CreateGroupModal from "./CreateGroupModal";
import StaffEmployeeConversationRoute from "./StaffEmployeeConversationRoute";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { listMyStaffConversations, postWarningBroadcast } from "../../services/chatService";
import { initialsOf } from "../../utils/initials";

const CHANNEL_ICON = { MARKET_GROUP: Users2, CUSTOM_GROUP: Users2, WARNINGS: ShieldAlert, SUPERVISOR_DIRECT: MessageCircle };
const EMPLOYEE_CHANNEL_PREFIX = "employee-";
const LIST_POLL_MS = 12000;

function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChannelRow({ conversation, onOpen }) {
  const Icon = CHANNEL_ICON[conversation.type] || MessageCircle;
  const isWarnings = conversation.type === "WARNINGS";
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
          {conversation.lastMessage && <span className="text-[10px] text-[#4C5266] shrink-0">{timeLabel(conversation.lastMessage.createdAt)}</span>}
        </div>
        <p className="text-xs text-[#8B93A8] truncate mt-0.5">
          {conversation.lastMessage ? (conversation.lastMessage.body || "Sent an attachment") : isWarnings ? "Send an announcement to your market" : "No messages yet"}
        </p>
      </div>
      <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
    </button>
  );
}

// SupervisorChatTab.jsx — the Chat tab. Every channel here is now real
// (listMyStaffConversations — Market Group, Warnings, each employee's
// SUPERVISOR_DIRECT, and any Custom Group this Supervisor created), the
// exact same backend-persisted conversations the Employee Chat tab and
// individual-employee conversations already used (see
// StaffEmployeeConversationRoute's own comment on why that matters: both
// sides render the same messages from the same backend row). Warnings
// keeps its dedicated broadcast endpoint (market-wide notification
// fan-out) via ConversationScreen's onBroadcast prop rather than the
// generic composer. Create Group / rename / add / remove member (spec
// §6-8) reuse this exact same Conversation/Message architecture through
// a new CUSTOM_GROUP type — see chatController.createGroup and friends.
export default function SupervisorChatTab({ session, basePath }) {
  const { data: conversations, error, loading, reload } = useAsync(listMyStaffConversations, { deps: [] });
  const { data: employees } = useAsync(() => listEmployeesByMarket(session.marketId), { deps: [session.marketId] });
  const { channelId } = useParams();
  const navigate = useNavigate();

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);

  usePolling(() => reload(), LIST_POLL_MS, []);

  const chatBase = `${basePath}/chat`;
  const isEmployeeChannel = channelId?.startsWith(EMPLOYEE_CHANNEL_PREFIX);
  const employeeId = isEmployeeChannel ? channelId.slice(EMPLOYEE_CHANNEL_PREFIX.length) : null;
  const openConversation = channelId && !isEmployeeChannel ? conversations?.find((c) => c.id === channelId) : null;

  function openEmployeeChat(employee) {
    navigate(`${chatBase}/${EMPLOYEE_CHANNEL_PREFIX}${employee.id}`);
  }

  function handleGroupCreated(conversation) {
    setCreatingGroup(false);
    reload();
    navigate(`${chatBase}/${conversation.id}`);
  }

  if (isEmployeeChannel) {
    return (
      <StaffEmployeeConversationRoute
        employeeId={employeeId}
        currentStaffUserId={session.staffId}
        onBack={() => navigate(chatBase)}
      />
    );
  }

  if (channelId) {
    if (loading) return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-40" /></div>;
    if (!openConversation) {
      return (
        <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
          <ErrorBanner message="This conversation could not be found." onRetry={() => navigate(chatBase)} />
        </div>
      );
    }
    return (
      <>
        <ConversationScreen
          conversation={openConversation}
          currentUserId={session.staffId}
          currentUserKind="staff"
          onBack={() => navigate(chatBase)}
          onBroadcast={openConversation.type === "WARNINGS" ? (body) => postWarningBroadcast(session.marketId, body) : undefined}
          onOpenGroupInfo={openConversation.type === "CUSTOM_GROUP" ? () => setGroupInfoOpen(true) : undefined}
        />
        {groupInfoOpen && (
          <GroupInfoModal
            conversationId={openConversation.id}
            groupName={openConversation.title}
            groupPictureUrl={openConversation.pictureUrl}
            marketId={openConversation.marketId}
            currentUserId={session.staffId}
            currentUserKind="staff"
            onClose={() => setGroupInfoOpen(false)}
            onRenamed={() => reload()}
          />
        )}
      </>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-white">Chat</h1>
        <button
          type="button"
          onClick={() => setCreatingGroup(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
        >
          <UsersRound size={14} /> Create Group
        </button>
      </div>

      {loading ? (
        <SkeletonCard className="h-40" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <ChannelRow key={c.id} conversation={c} onOpen={(conversation) => navigate(`${chatBase}/${conversation.id}`)} />
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

      {creatingGroup && (
        <CreateGroupModal marketId={session.marketId} onClose={() => setCreatingGroup(false)} onCreated={handleGroupCreated} />
      )}
    </div>
  );
}
