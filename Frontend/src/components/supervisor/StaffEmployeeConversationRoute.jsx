import { useEffect, useState } from "react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import ConversationScreen from "../employee/ConversationScreen";
import { getOrCreateEmployeeConversationForSupervisor } from "../../services/chatService";
import { ApiError } from "../../services/apiClient";

// StaffEmployeeConversationRoute.jsx — the Supervisor side of an
// Employee<->Supervisor 1:1 conversation. Reuses the exact same
// ConversationScreen the Employee Chat tab uses (real polling, real
// send/read, real attachments) instead of a separate mock-backed thread
// view — this is what makes "Supervisor sends a message -> Employee sees
// it, and vice versa" actually true: both sides render the same messages
// fetched from the same backend conversation row.
export default function StaffEmployeeConversationRoute({ employeeId, currentStaffUserId, onBack }) {
  const [conversation, setConversation] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setConversation(null);
    setError(null);
    getOrCreateEmployeeConversationForSupervisor(employeeId)
      .then((conv) => { if (!cancelled) setConversation(conv); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not open this conversation."); });
    return () => { cancelled = true; };
  }, [employeeId]);

  if (error) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><ErrorBanner message={error} onRetry={onBack} /></div>;
  }
  if (!conversation) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-40" /></div>;
  }

  return (
    <ConversationScreen
      conversation={conversation}
      currentUserId={currentStaffUserId}
      currentUserKind="staff"
      onBack={onBack}
    />
  );
}
