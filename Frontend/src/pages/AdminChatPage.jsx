import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UsersRound, ArrowLeft } from "lucide-react";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ConversationScreen from "../components/employee/ConversationScreen";
import GroupInfoModal from "../components/employee/GroupInfoModal";
import ConversationOptionsSheet from "../components/common/ConversationOptionsSheet";
import ChatConversationCard from "../components/common/ChatConversationCard";
import ChatViewTabs from "../components/common/ChatViewTabs";
import AdminCreateGroupModal from "./AdminCreateGroupModal";
import { listMyAdminConversations, postZoneAnnouncement, setConversationPreference } from "../services/chatService";
import { useAsync } from "../hooks/useAsync";
import { usePolling } from "../hooks/usePolling";

const LIST_POLL_MS = 15000;

// AdminChatPage.jsx — Phase 3.5: the missing Admin Chat screen, built on
// the exact same conversation architecture and endpoints as every other
// role (listMyAdminConversations -> GET /api/conversations/admin, backed
// by chatController.buildAdminConversationList — no new backend chat
// system). Admin has no employee-1:1 conversation type in this app (see
// that endpoint's own comment), so "Individuals" here is staff-to-staff
// only (STAFF_DIRECT via Important People) — an accurate reflection of
// what the backend actually supports, not an invented capability.
export default function AdminChatPage({ session }) {
  const { data: conversations, setData: setConversations, error, loading, reload } = useAsync(listMyAdminConversations, { deps: [] });
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
    navigate(`/admin/chat/${conversation.id}`);
  }

  async function handleOpenImportantContact(conversation) {
    await reload();
    navigate(`/admin/chat/${conversation.id}`);
  }

  if (conversationId) {
    if (loading) return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-64" /></div>;
    if (!openConversation) {
      return (
        <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
          <ErrorBanner message="This conversation could not be found." onRetry={() => navigate("/admin/chat")} />
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <button type="button" onClick={() => navigate("/admin/chat")} className="mt-4 flex items-center gap-1.5 text-xs text-[#9AA1B4] hover:text-white">
          <ArrowLeft size={13} /> Back to Chat
        </button>
        <div className="h-[calc(100vh-140px)]">
          <ConversationScreen
            conversation={openConversation}
            currentUserId={session.staffId}
            currentUserKind="staff"
            onBack={() => navigate("/admin/chat")}
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
            groupOpenJoin={openConversation.openJoin}
            currentUserId={session.staffId}
            currentUserKind="staff"
            onClose={() => setGroupInfoOpen(false)}
            onRenamed={() => reload()}
            onDeleted={() => { setGroupInfoOpen(false); reload(); navigate("/admin/chat"); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">Chat</h1>
        <p className="text-sm text-[#8B93A8] mt-0.5">Company-wide communication hub</p>
      </div>

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
          renderRow={(c) => <ChatConversationCard key={c.id} conversation={c} onOpen={() => navigate(`/admin/chat/${c.id}`)} onMore={setOptionsFor} />}
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

      {creatingGroup && <AdminCreateGroupModal session={session} onClose={() => setCreatingGroup(false)} onCreated={handleGroupCreated} />}

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
