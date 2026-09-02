import { Megaphone, ChevronRight } from "lucide-react";

// AnnouncementCard.jsx — Home tab's "Team Announcement" card. Renders
// the single most recent real Communication of type ANNOUNCEMENT this
// employee can see (see HomeTab.jsx — listMyCommunications(), filtered
// and sorted server-side newest-first already), or an honest empty
// state when there isn't one. Tapping navigates to the same real
// CommunicationDetailScreen every notification/chat announcement link
// already opens — never a dead card.
export default function AnnouncementCard({ announcement, onClick }) {
  if (!announcement) {
    return (
      <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center text-[#4C5266] shrink-0">
          <Megaphone size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">No new announcements</p>
          <p className="text-xs text-[#8B93A8] mt-0.5">You're up to date.</p>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-premium w-full flex items-center gap-3 rounded-2xl p-4 bg-gradient-to-br from-[#F47A20]/[0.12] to-[#171C2E]/80 border border-[#F47A20]/20 backdrop-blur-xl hover:border-[#F47A20]/35 active:scale-[0.99] transition-all duration-150"
    >
      <span className="w-10 h-10 rounded-xl bg-[#F47A20]/15 flex items-center justify-center text-[#F47A20] glow-amber animate-glow-pulse shrink-0">
        <Megaphone size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">Team Announcement</p>
        <p className="text-xs text-[#9AA1B4] mt-0.5 line-clamp-2">{announcement.message}</p>
      </div>
      <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
    </button>
  );
}
