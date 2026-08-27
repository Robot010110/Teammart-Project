import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import ConversationScreen from "./ConversationScreen";
import GroupInfoModal from "./GroupInfoModal";
import { listMyConversations } from "../../services/chatService";
import { useAsync } from "../../hooks/useAsync";

// ConversationRoute.jsx — route wrapper for "chat/:conversationId".
// There's no GET /api/conversations/:id on the backend (only the list
// endpoint), so this finds the conversation by id from
// listMyConversations() — the same data ChatListScreen already has,
// just re-fetched here since a direct/refreshed route load starts with
// nothing in memory. ConversationScreen itself is unchanged.
export default function ConversationRoute({ currentEmployeeId, basePath }) {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { data: conversations, error, loading, reload } = useAsync(listMyConversations, { deps: [] });
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);

  if (loading) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-40" /></div>;
  }
  if (error) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><ErrorBanner message={error} onRetry={reload} /></div>;
  }

  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) {
    return (
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <ErrorBanner message="This conversation could not be found." onRetry={() => navigate(`${basePath}/chat`)} />
      </div>
    );
  }

  return (
    <>
      <ConversationScreen
        conversation={conversation}
        currentUserId={currentEmployeeId}
        currentUserKind="employee"
        onBack={() => navigate(`${basePath}/chat`)}
        onOpenGroupInfo={conversation.type === "CUSTOM_GROUP" ? () => setGroupInfoOpen(true) : undefined}
      />
      {groupInfoOpen && (
        <GroupInfoModal
          conversationId={conversation.id}
          groupName={conversation.title}
          groupPictureUrl={conversation.pictureUrl}
          marketId={conversation.marketId}
          currentUserId={currentEmployeeId}
          currentUserKind="employee"
          onClose={() => setGroupInfoOpen(false)}
          onDeleted={() => { setGroupInfoOpen(false); navigate(`${basePath}/chat`); }}
        />
      )}
    </>
  );
}
