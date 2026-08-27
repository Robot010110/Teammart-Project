import { createPortal } from "react-dom";
import { Pin, PinOff, Bell, BellOff } from "lucide-react";

// ConversationOptionsSheet.jsx — Pin/Mute for a conversation, shared by
// every Chat list screen (Employee/Cashier's own ChatListScreen.jsx
// already had this; extracted here so Supervisor/Regional Manager/Admin
// get the exact same feature through the same component rather than
// three more copies of it). Both actions are real, persisted per-caller
// preferences (PATCH /api/conversations/:id/preference ->
// ConversationRead.pinned/muted — already dual-nullable-FK'd for
// employee AND staff callers, see that model's own schema comment), not
// local-only UI state.
export default function ConversationOptionsSheet({ conversation, onClose, onTogglePin, onToggleMute }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm sm:mx-4 rounded-t-2xl sm:rounded-2xl bg-[#1F2436] border border-white/10 shadow-2xl animate-fade-up overflow-hidden py-1.5">
        <button type="button" onClick={onTogglePin} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/[0.05]">
          {conversation.pinned ? <PinOff size={16} /> : <Pin size={16} />} {conversation.pinned ? "Unpin" : "Pin"} conversation
        </button>
        <button type="button" onClick={onToggleMute} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/[0.05]">
          {conversation.muted ? <Bell size={16} /> : <BellOff size={16} />} {conversation.muted ? "Unmute" : "Mute"} notifications
        </button>
      </div>
    </div>,
    document.body
  );
}
