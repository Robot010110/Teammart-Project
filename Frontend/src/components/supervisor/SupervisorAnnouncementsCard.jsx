import { useNavigate } from "react-router-dom";
import { Megaphone, ChevronRight } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "../common/SkeletonCard";
import { getZoneAnnouncements, listMessages } from "../../services/chatService";

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

// SupervisorAnnouncementsCard.jsx — Repair Pass §5: "Important
// information" on the redesigned homepage. Real data — the same Zone
// Announcements conversation (getZoneAnnouncements/listMessages,
// chatService.js) an Employee's Chat tab already reads, not the
// previous mock ZoneManagerNotificationCard (which had no real backend
// behind it at all — see that file's own now-stale comment). A
// Supervisor is always read-only here (posting is Regional Manager/
// Admin-only, enforced server-side) — tapping opens the real
// conversation via the existing chat route, it doesn't try to reproduce
// posting here.
export default function SupervisorAnnouncementsCard({ session, basePath }) {
  const navigate = useNavigate();
  const { data: conversation } = useAsync(
    () => (session.zoneId ? getZoneAnnouncements(session.zoneId) : Promise.resolve(null)),
    { deps: [session.zoneId] }
  );
  const { data: messages, loading } = useAsync(
    () => (conversation ? listMessages(conversation.id) : Promise.resolve(null)),
    { deps: [conversation?.id] }
  );

  if (!session.zoneId) return null;
  if (loading || !conversation) return <SkeletonCard className="h-24" />;

  const latest = messages?.messages?.[messages.messages.length - 1];

  return (
    <button
      type="button"
      onClick={() => navigate(`${basePath}/chat/${conversation.id}`)}
      className="w-full text-left rounded-2xl p-4 sm:p-5 border backdrop-blur-xl transition-colors bg-amber-500/[0.06] border-amber-500/20 hover:border-amber-500/35"
    >
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400">
          <Megaphone size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Zone Announcements</p>
          {latest ? (
            <>
              <p className="text-xs text-[#9AA1B4] mt-0.5 line-clamp-2">{latest.body || "(attachment)"}</p>
              <p className="text-[11px] text-[#4C5266] mt-1">
                {(latest.senderUser?.name || latest.senderEmployee?.name) ?? "Unknown"} · {timeAgo(latest.createdAt)}
              </p>
            </>
          ) : (
            <p className="text-xs text-[#8B93A8] mt-0.5">No announcements yet.</p>
          )}
        </div>
        <ChevronRight size={16} className="text-amber-400/60 shrink-0 mt-1" />
      </div>
    </button>
  );
}
