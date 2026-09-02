import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, UsersRound, Search } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { usePolling } from "../../hooks/usePolling";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import ConversationScreen from "../employee/ConversationScreen";
import GroupInfoModal from "../employee/GroupInfoModal";
import ConversationOptionsSheet from "../common/ConversationOptionsSheet";
import ChatConversationCard from "../common/ChatConversationCard";
import CreateGroupModal from "./CreateGroupModal";
import StaffEmployeeConversationRoute from "./StaffEmployeeConversationRoute";
import ChatViewTabs from "../common/ChatViewTabs";
import ReportsProblemsSection from "./ReportsProblemsSection";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { listMyStaffConversations, postWarningBroadcast, setConversationPreference } from "../../services/chatService";
import { initialsOf } from "../../utils/initials";

const EMPLOYEE_CHANNEL_PREFIX = "employee-";
const LIST_POLL_MS = 12000;

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
  const { data: conversations, setData: setConversations, error, loading, reload } = useAsync(listMyStaffConversations, { deps: [] });
  const { data: employees } = useAsync(() => listEmployeesByMarket(session.marketId), { deps: [session.marketId] });
  const { channelId } = useParams();
  const navigate = useNavigate();

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [optionsFor, setOptionsFor] = useState(null);

  async function handleTogglePin(conversation) {
    setOptionsFor(null);
    const next = !conversation.pinned;
    setConversations((prev) => prev?.map((c) => (c.id === conversation.id ? { ...c, pinned: next } : c)));
    try {
      await setConversationPreference(conversation.id, { pinned: next });
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

  async function handleOpenImportantContact(conversation) {
    await reload();
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
            groupOpenJoin={openConversation.openJoin}
            currentUserId={session.staffId}
            currentUserKind="staff"
            onClose={() => setGroupInfoOpen(false)}
            onRenamed={() => reload()}
            onDeleted={() => { setGroupInfoOpen(false); reload(); navigate(chatBase); }}
          />
        )}
      </>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">Chat</h1>
        <p className="text-sm text-[#8B93A8] mt-0.5">Your market's communication hub</p>
      </div>

      {loading ? (
        <SkeletonCard className="h-40" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <ChatViewTabs
          conversations={conversations}
          onOpenImportantContact={handleOpenImportantContact}
          reportsContent={<ReportsProblemsSection marketId={session.marketId} />}
          renderRow={(c) => <ChatConversationCard key={c.id} conversation={c} onOpen={(conversation) => navigate(`${chatBase}/${conversation.id}`)} onMore={setOptionsFor} />}
          individualsExtra={
            employees?.length > 0 && (
              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8B93A8]">Start a new chat</h2>
                <div className="relative mb-2.5">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
                  <input
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search employees"
                    className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
                  />
                </div>
                <div className="space-y-2">
                  {employees
                    .filter((e) => e.name.toLowerCase().includes(employeeSearch.trim().toLowerCase()))
                    .map((e) => (
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
            )
          }
          groupsHeaderAction={
            <button
              type="button"
              onClick={() => setCreatingGroup(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 mb-1 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
            >
              <UsersRound size={14} /> Create Group
            </button>
          }
        />
      )}

      {creatingGroup && (
        <CreateGroupModal marketId={session.marketId} onClose={() => setCreatingGroup(false)} onCreated={handleGroupCreated} />
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
