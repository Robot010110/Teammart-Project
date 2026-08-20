import { useState } from "react";
import { ShieldAlert, Users2, MessageCircle, Loader2, Check } from "lucide-react";
import Modal from "../common/Modal";
import { listMyConversations, listMyStaffConversations, forwardMessage } from "../../services/chatService";
import { useAsync } from "../../hooks/useAsync";
import { ApiError } from "../../services/apiClient";

// ForwardMessageModal.jsx — spec §5: pick a destination conversation and
// forward the message there. The destination list comes from the same
// real listMyConversations/listMyStaffConversations endpoints the Chat
// tab itself uses (currentUserKind decides which), so this can only ever
// show conversations the caller is actually a member of — the backend
// re-checks source-message access independently anyway (see
// chatController.sendMessage's forwardMessageId handling), but the list
// itself never offers a destination the user isn't authorized to send
// into in the first place. Warnings is excluded — employees can't post
// there at all, and a Supervisor forwarding into Warnings would bypass
// the dedicated broadcast/notification-fanout path, so it's simply not a
// valid forward target for anyone.
export default function ForwardMessageModal({ message, currentUserKind, onClose }) {
  const { data: conversations, loading } = useAsync(
    () => (currentUserKind === "staff" ? listMyStaffConversations() : listMyConversations()),
    { deps: [currentUserKind] }
  );
  const [sendingTo, setSendingTo] = useState(null);
  const [sentTo, setSentTo] = useState(new Set());
  const [error, setError] = useState(null);

  const destinations = (conversations ?? []).filter((c) => c.type !== "WARNINGS" && c.id !== message.conversationId);

  async function handleForward(conversation) {
    setSendingTo(conversation.id);
    setError(null);
    try {
      await forwardMessage(conversation.id, message.id);
      setSentTo((prev) => new Set(prev).add(conversation.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not forward this message.");
    } finally {
      setSendingTo(null);
    }
  }

  return (
    <Modal open onClose={onClose} title="Forward Message">
      <div className="mb-3 rounded-lg p-2.5 bg-white/[0.04] border border-white/[0.06]">
        <p className="text-xs text-[#9AA1B4] truncate">{message.body || "Attachment"}</p>
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {loading ? (
        <p className="text-center text-xs text-[#4C5266] py-6">Loading conversations...</p>
      ) : destinations.length === 0 ? (
        <p className="text-center text-xs text-[#4C5266] py-6">No other conversations to forward to.</p>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {destinations.map((c) => {
            const Icon = c.type === "MARKET_GROUP" || c.type === "CUSTOM_GROUP" ? Users2 : c.type === "WARNINGS" ? ShieldAlert : MessageCircle;
            const isSending = sendingTo === c.id;
            const isSent = sentTo.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleForward(c)}
                disabled={isSending || isSent}
                className="w-full flex items-center gap-3 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 disabled:opacity-70 transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-[#F47A20]/10 text-[#F47A20] flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </span>
                <span className="flex-1 min-w-0 text-left text-sm font-medium text-white truncate">{c.title}</span>
                {isSending && <Loader2 size={16} className="animate-spin text-[#9AA1B4]" />}
                {isSent && <Check size={16} className="text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
