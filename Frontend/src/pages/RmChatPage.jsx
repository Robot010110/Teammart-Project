import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Users2, MessageCircle, ChevronRight, UsersRound, ArrowLeft } from "lucide-react";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ConversationScreen from "../components/employee/ConversationScreen";
import GroupInfoModal from "../components/employee/GroupInfoModal";
import RmCreateGroupModal from "./RmCreateGroupModal";
import { listMyRegionalManagerConversations } from "../services/chatService";
import { useAsync } from "../hooks/useAsync";
import { usePolling } from "../hooks/usePolling";

const LIST_POLL_MS = 15000;

function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ConversationRow({ conversation, onOpen }) {
  const Icon = conversation.type === "CUSTOM_GROUP" ? Users2 : MessageCircle;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors text-left"
    >
      <span className="w-10 h-10 rounded-full bg-[#F47A20]/10 text-[#F47A20] flex items-center justify-center shrink-0 overflow-hidden">
        {conversation.pictureUrl ? <img src={conversation.pictureUrl} alt="" className="w-full h-full object-cover" /> : <Icon size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white truncate">{conversation.title}</p>
          {conversation.lastMessage && <span className="text-[10px] text-[#4C5266] shrink-0">{timeLabel(conversation.lastMessage.createdAt)}</span>}
        </div>
        <p className="text-xs text-[#8B93A8] truncate mt-0.5">{conversation.lastMessage ? conversation.lastMessage.body || "Sent an attachment" : "No messages yet"}</p>
      </div>
      <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
    </button>
  );
}

// RmChatPage.jsx — spec §9-13/§16: the Regional Manager's own Chat page.
// Deliberately shows ONLY what /api/conversations/rm returns — every
// CUSTOM_GROUP the RM is an explicit member of, plus any RM_DIRECT
// threads they've opened with an employee. No market's Market Group/
// Warnings is ever auto-included here (spec §12 — see the backend
// endpoint's own comment). "Create Group" opens RmCreateGroupModal,
// which can scope a new group to one market or an entire zone.
export default function RmChatPage({ session }) {
  const { data: conversations, error, loading, reload } = useAsync(listMyRegionalManagerConversations, { deps: [] });
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);

  usePolling(() => reload(), LIST_POLL_MS, []);

  const openConversation = conversationId ? conversations?.find((c) => c.id === conversationId) : null;

  function handleGroupCreated(conversation) {
    setCreatingGroup(false);
    reload();
    navigate(`/rm/chat/${conversation.id}`);
  }

  if (conversationId) {
    if (loading) return <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto"><SkeletonCard className="h-64" /></div>;
    if (!openConversation) {
      return (
        <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto">
          <ErrorBanner message="This conversation could not be found." onRetry={() => navigate("/rm/chat")} />
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <button type="button" onClick={() => navigate("/rm/chat")} className="mt-4 flex items-center gap-1.5 text-xs text-[#9AA1B4] hover:text-white md:hidden">
          <ArrowLeft size={13} /> Back to Chat
        </button>
        <div className="h-[calc(100vh-64px)]">
          <ConversationScreen
            conversation={openConversation}
            currentUserId={session.staffId}
            currentUserKind="staff"
            onBack={() => navigate("/rm/chat")}
            onOpenGroupInfo={openConversation.type === "CUSTOM_GROUP" ? () => setGroupInfoOpen(true) : undefined}
          />
        </div>
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
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Chat</h1>
        <button
          type="button"
          onClick={() => setCreatingGroup(true)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
        >
          <UsersRound size={15} /> Create Group
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[72px]" />)}
        </div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
          No conversations yet. Create a group to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <ConversationRow key={c.id} conversation={c} onOpen={() => navigate(`/rm/chat/${c.id}`)} />
          ))}
        </div>
      )}

      {creatingGroup && <RmCreateGroupModal session={session} onClose={() => setCreatingGroup(false)} onCreated={handleGroupCreated} />}
    </div>
  );
}
