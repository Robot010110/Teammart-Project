import { Megaphone } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "../common/SkeletonCard";
import { getZoneManagerNotification, markZoneManagerNotificationRead } from "../../data/supervisorMockData";

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// ZoneManagerNotificationCard.jsx — high-priority management
// communication from the Zone Manager, kept visually distinct from
// "Today's Activity" (spec: automatically-received employee activity vs.
// management communication are two different information categories,
// never mixed). No Zone Manager <-> Supervisor messaging backend exists
// yet — see data/supervisorMockData.js's own doc comment for why this is
// local/mock, structured to match a future real notification shape.
export default function ZoneManagerNotificationCard() {
  const { data: notification, setData, loading } = useAsync(getZoneManagerNotification, { deps: [] });

  if (loading) return <SkeletonCard className="h-24" />;
  if (!notification) return null;

  return (
    <button
      type="button"
      onClick={() => !notification.read && markZoneManagerNotificationRead().then(setData)}
      className={`w-full text-left rounded-2xl p-4 sm:p-5 border backdrop-blur-xl transition-colors ${
        notification.read
          ? "bg-[#171C2E]/80 border-white/[0.06]"
          : "bg-amber-500/[0.07] border-amber-500/25"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${notification.read ? "bg-white/[0.06] text-[#9AA1B4]" : "bg-amber-500/15 text-amber-400"}`}>
          <Megaphone size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">{notification.from}</p>
            {!notification.read && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
          </div>
          <p className="text-sm font-medium text-white mt-1">{notification.title}</p>
          <p className="text-xs text-[#9AA1B4] mt-1">{notification.body}</p>
          <p className="text-[11px] text-[#4C5266] mt-1.5">{timeAgo(notification.createdAt)}</p>
        </div>
      </div>
    </button>
  );
}
