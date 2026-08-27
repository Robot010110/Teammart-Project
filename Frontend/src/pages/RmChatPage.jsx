import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Users2, MessageCircle, ChevronRight, UsersRound, ArrowLeft, ShieldAlert, Pin, BellOff, MoreVertical } from "lucide-react";
import ErrorBanner from "../components/common/ErrorBanner";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ConversationScreen from "../components/employee/ConversationScreen";
import GroupInfoModal from "../components/employee/GroupInfoModal";
import ConversationOptionsSheet from "../components/common/ConversationOptionsSheet";
import ChatViewTabs from "../components/common/ChatViewTabs";
import RmCreateGroupModal from "./RmCreateGroupModal";
import { listMyRegionalManagerConversations, postZoneAnnouncement, setConversationPreference } from "../services/chatService";
import { useAsync } from "../hooks/useAsync";
import { usePolling } from "../hooks/usePolling";

const LIST_POLL_MS = 15000;

function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ConversationRow({ conversation, onOpen, onMore }) {
  const Icon = conversation.type === "CUSTOM_GROUP" ? Users2 : MessageCircle;
  return (
    <div className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors">
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 text-left">
        <span className="relative w-10 h-10 rounded-full bg-[#F47A20]/10 text-[#F47A20] flex items-center justify-center shrink-0 overflow-hidden">
          {conversation.pictureUrl ? <AuthenticatedImage src={conversation.pictureUrl} alt="" className="w-full h-full object-cover" /> : <Icon size={18} />}
          {conversation.pinned && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <Pin size={9} className="text-[#F47A20]" fill="currentColor" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
              {conversation.title}
              {conversation.muted && <BellOff size={11} className="text-[#4C5266] shrink-0" />}
              {conversation.groupType === "WARNING" && (
                <span className="shrink-0 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400">
                  <ShieldAlert size={9} /> Announce
                </span>
              )}
            </p>
            {conversation.lastMessage && <span className="text-[10px] text-[#4C5266] shrink-0">{timeLabel(conversation.lastMessage.createdAt)}</span>}
          </div>
          <p className="text-xs text-[#8B93A8] truncate mt-0.5">{conversation.lastMessage ? conversation.lastMessage.body || "Sent an attachment" : "No messages yet"}</p>
        </div>
        {conversation.unreadCount > 0 && (
          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F47A20] text-white text-[10px] font-semibold flex items-center justify-center">
            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
          </span>
        )}
      </button>
      {onMore && (
        <button type="button" onClick={() => onMore(conversation)} className="p-1.5 text-[#4C5266] hover:text-white shrink-0" aria-label="More options">
          <MoreVertical size={16} />
        </button>
      )}
      <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
    </div>
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
  const { data: conversations, setData: setConversations, error, loading, reload } = useAsync(listMyRegionalManagerConversations, { deps: [] });
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [optionsFor, setOptionsFor] = useState(null);

  usePolling(() => reload(), LIST_POLL_MS, []);

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

  const openConversation = conversationId ? conversations?.find((c) => c.id === conversationId) : null;

  function handleGroupCreated(conversation) {
    setCreatingGroup(false);
    reload();
    navigate(`/rm/chat/${conversation.id}`);
  }

  async function handleOpenImportantContact(conversation) {
    await reload();
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
            onBroadcast={
              openConversation.type === "ZONE_ANNOUNCEMENTS"
                ? (body) => postZoneAnnouncement(openConversation.zoneId, body)
                : undefined
            }
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
            onDeleted={() => { setGroupInfoOpen(false); reload(); navigate("/rm/chat"); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto animate-fade-up">
      <h1 className="font-display text-2xl font-bold text-white mb-6">Chat</h1>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[72px]" />)}
        </div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <ChatViewTabs
          conversations={conversations}
          onOpenImportantContact={handleOpenImportantContact}
          renderRow={(c) => <ConversationRow key={c.id} conversation={c} onOpen={() => navigate(`/rm/chat/${c.id}`)} onMore={setOptionsFor} />}
          groupsHeaderAction={
            <button
              type="button"
              onClick={() => setCreatingGroup(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 mb-1 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
            >
              <UsersRound size={15} /> Create Group
            </button>
          }
        />
      )}

      {creatingGroup && <RmCreateGroupModal session={session} onClose={() => setCreatingGroup(false)} onCreated={handleGroupCreated} />}

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
