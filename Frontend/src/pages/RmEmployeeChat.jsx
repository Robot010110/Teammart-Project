import { useEffect, useState } from "react";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ConversationScreen from "../components/employee/ConversationScreen";
import { getOrCreateEmployeeConversationForRegionalManager } from "../services/chatService";
import { ApiError } from "../services/apiClient";

// RmEmployeeChat.jsx — the Regional Manager side of an RM<->Employee DM.
// Reuses the exact same ConversationScreen the Employee and Supervisor
// Chat tabs already use (real polling, reactions, reply, edit, delete —
// see chatController.js) instead of a separate simplified RM chat
// widget. Per the spec, a fuller RM Chat *section* (conversation list,
// etc.) is being designed separately later — this is just the one
// working entry point the architecture needs to support today: opening
// this creates the conversation (still locked until the RM's first
// message — see chatService's own comment) and sends through it.
export default function RmEmployeeChat({ employeeId, currentStaffUserId, onBack }) {
  const [conversation, setConversation] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setConversation(null);
    setError(null);
    getOrCreateEmployeeConversationForRegionalManager(employeeId)
      .then((conv) => { if (!cancelled) setConversation(conv); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not open this conversation."); });
    return () => { cancelled = true; };
  }, [employeeId]);

  if (error) {
    return <div className="px-6 md:px-10 py-8 max-w-3xl mx-auto"><ErrorBanner message={error} onRetry={onBack} /></div>;
  }
  if (!conversation) {
    return <div className="px-6 md:px-10 py-8 max-w-3xl mx-auto"><SkeletonCard className="h-64" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ConversationScreen conversation={conversation} currentUserId={currentStaffUserId} currentUserKind="staff" onBack={onBack} />
    </div>
  );
}
