import { Users2, ShieldAlert, MessageCircle, ChevronRight, Pin, BellOff, MoreVertical } from "lucide-react";
import AuthenticatedImage from "./AuthenticatedImage";

const GROUP_TYPES = new Set(["MARKET_GROUP", "ZONE_GROUP", "CUSTOM_GROUP"]);
const ANNOUNCEMENT_TYPES = new Set(["WARNINGS", "ZONE_ANNOUNCEMENTS"]);

function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ChatConversationCard.jsx — Chat UI redesign §26: the ONE conversation-
// list card every role's Chat screen now renders (previously four
// near-identical copies — ConversationRow in ChatListScreen.jsx/
// RmChatPage.jsx/AdminChatPage.jsx, ChannelRow in SupervisorChatTab.jsx —
// each drifting slightly). Purely presentational: `conversation` is
// already the exact shaped object every role's real list endpoint
// returns (listMyConversations/listMyStaffConversations/
// listMyRegionalManagerConversations/listMyAdminConversations — all the
// same shape, see chatController.js), so this card never needs to know
// which role is looking at it.
export default function ChatConversationCard({ conversation, onOpen, onMore }) {
  const isAnnouncement = ANNOUNCEMENT_TYPES.has(conversation.type);
  const isGroup = GROUP_TYPES.has(conversation.type);
  const Icon = isAnnouncement ? ShieldAlert : isGroup ? Users2 : MessageCircle;

  const preview = conversation.lastMessage
    ? conversation.lastMessage.deleted
      ? "Message deleted"
      : conversation.lastMessage.body || "Sent an attachment"
    : isAnnouncement
      ? "No announcements yet"
      : "No messages yet";

  return (
    <div
      className={`w-full flex items-center gap-3 rounded-2xl p-3.5 border transition-colors ${
        isAnnouncement ? "bg-amber-500/[0.06] border-amber-500/20 hover:border-amber-500/35" : "bg-[#171C2E]/80 border-white/[0.06] hover:border-[#F47A20]/25"
      }`}
    >
      <button type="button" onClick={() => onOpen(conversation)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
        <span
          className={`relative w-11 h-11 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
            isAnnouncement ? "bg-amber-500/15 text-amber-400" : "bg-[#F47A20]/10 text-[#F47A20]"
          }`}
        >
          {conversation.pictureUrl ? (
            <AuthenticatedImage src={conversation.pictureUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon size={19} />
          )}
          {conversation.pinned && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <Pin size={9} className="text-[#F47A20]" fill="currentColor" />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold truncate flex items-center gap-1.5 ${isAnnouncement ? "text-amber-300" : "text-white"}`}>
              {conversation.title}
              {conversation.muted && <BellOff size={11} className="text-[#4C5266] shrink-0" />}
              {conversation.groupType === "WARNING" && (
                <span className="shrink-0 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400">
                  <ShieldAlert size={9} /> Announce
                </span>
              )}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {conversation.lastMessage && <span className="text-[10px] text-[#4C5266]">{timeLabel(conversation.lastMessage.createdAt)}</span>}
              {conversation.unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#F47A20] text-white text-[10px] font-bold flex items-center justify-center">
                  {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-[#8B93A8] truncate mt-0.5">{preview}</p>
        </div>
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
