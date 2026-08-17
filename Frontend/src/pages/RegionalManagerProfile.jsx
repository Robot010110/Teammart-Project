import { useMemo, useState } from "react";
import {
  Building2, MapPinned, Store, ClipboardList, MessageCircle, ShieldAlert, Sparkles, CalendarCheck,
  CheckCheck, BellOff,
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { listMarkets } from "../services/marketService";
import { listMyNotifications, markNotificationRead, markAllNotificationsRead } from "../services/notificationService";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Visual state per notification type (spec §3: unread/read/important/
// warning/positive/system all need to look distinct, not just a bold/
// unbold difference).
const TYPE_STYLE = {
  MARKET_FEEDBACK: { icon: ShieldAlert, tone: "text-amber-400 bg-amber-500/10" }, // refined per-row below (Warning vs Recognition)
  CHAT_MESSAGE: { icon: MessageCircle, tone: "text-[#F47A20] bg-[#F47A20]/10" },
  SUDDEN_TASK: { icon: ClipboardList, tone: "text-sky-400 bg-sky-500/10" },
  SUBMISSION_REVIEWED: { icon: CheckCheck, tone: "text-emerald-400 bg-emerald-500/10" },
  WASTED_OVERALL: { icon: ClipboardList, tone: "text-[#9AA1B4] bg-white/[0.06]" },
  ANNOUNCEMENT: { icon: Sparkles, tone: "text-amber-400 bg-amber-500/10" },
  LEAVE_REVIEWED: { icon: CalendarCheck, tone: "text-sky-400 bg-sky-500/10" },
};

function styleFor(n) {
  if (n.type === "MARKET_FEEDBACK") {
    const isWarning = /^warning/i.test(n.title);
    return isWarning
      ? { icon: ShieldAlert, tone: "text-red-400 bg-red-500/10" }
      : { icon: Sparkles, tone: "text-emerald-400 bg-emerald-500/10" };
  }
  return TYPE_STYLE[n.type] ?? { icon: ClipboardList, tone: "text-[#9AA1B4] bg-white/[0.06]" };
}

function NotificationRow({ n, onRead }) {
  const { icon: Icon, tone } = styleFor(n);
  return (
    <button
      type="button"
      onClick={() => !n.read && onRead(n.id)}
      className={`w-full text-left flex items-start gap-3 rounded-xl p-3.5 border transition-colors ${
        n.read ? "bg-[#171C2E]/50 border-white/[0.05]" : "bg-[#171C2E]/90 border-[#F47A20]/25"
      }`}
    >
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-white truncate">{n.title}</p>
          {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#F47A20] shrink-0" />}
        </div>
        <p className="text-xs text-[#9AA1B4] mt-0.5 line-clamp-2">{n.body}</p>
        <p className="text-[11px] text-[#4C5266] mt-1">{timeAgo(n.createdAt)}</p>
      </div>
    </button>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <span className="w-9 h-9 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20] shrink-0">
        <Icon size={17} />
      </span>
      <div className="leading-tight">
        <p className="text-white font-bold text-lg">{value}</p>
        <p className="text-[11px] uppercase tracking-wide text-[#8B93A8]">{label}</p>
      </div>
    </div>
  );
}

// RegionalManagerProfile.jsx — the specialized RM profile (spec §2/§3):
// header with dynamically-computed market count and assigned zones (both
// derived from the real markets list, never hardcoded), and a real
// notification feed below it, visually distinct by type.
export default function RegionalManagerProfile({ session }) {
  const { data: markets, error: marketsError, loading: marketsLoading, reload: reloadMarkets } = useAsync(listMarkets, { deps: [] });
  const {
    data: notifData,
    error: notifError,
    loading: notifLoading,
    setData: setNotifData,
    reload: reloadNotifs,
  } = useAsync(() => listMyNotifications({ limit: 30 }), { deps: [] });

  const [showAll, setShowAll] = useState(false);

  const zoneNumbers = useMemo(() => {
    if (!markets) return [];
    return [...new Set(markets.map((m) => m.zoneNumber))].sort((a, b) => a - b);
  }, [markets]);

  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;
  const visible = showAll ? notifications : notifications.slice(0, 6);

  async function handleRead(id) {
    setNotifData((prev) =>
      prev
        ? { notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)), unreadCount: Math.max(prev.unreadCount - 1, 0) }
        : prev
    );
    try {
      await markNotificationRead(id);
    } catch {
      reloadNotifs();
    }
  }

  async function handleMarkAllRead() {
    setNotifData((prev) => (prev ? { notifications: prev.notifications.map((n) => ({ ...n, read: true })), unreadCount: 0 } : prev));
    try {
      await markAllNotificationsRead();
    } catch {
      reloadNotifs();
    }
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto animate-fade-up">
      <div className="rounded-2xl p-6 bg-gradient-to-br from-[#171C2E] to-[#1A1F33] border border-white/[0.06] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#1D2D5C] to-[#324a8f] grid place-items-center ring-1 ring-white/10 shrink-0">
            <span className="text-xl font-bold text-white">{session.initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#F47A20]">Regional Manager</p>
            <h1 className="font-display text-2xl font-bold text-white truncate">{session.displayName}</h1>
            {marketsLoading ? (
              <p className="text-xs text-[#4C5266] mt-1">Loading zones...</p>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#9AA1B4]">
                <MapPinned size={12} />
                {zoneNumbers.length > 0 ? zoneNumbers.map((n) => `Zone ${n}`).join(" • ") : "No zones assigned"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={Store} label="Markets" value={marketsLoading ? "—" : markets?.length ?? 0} />
          <StatCard icon={MapPinned} label="Zones" value={marketsLoading ? "—" : zoneNumbers.length} />
          <StatCard
            icon={Building2}
            label="Employees"
            value={marketsLoading ? "—" : markets?.reduce((sum, m) => sum + m.employeesCount, 0) ?? 0}
          />
        </div>
      </div>

      {marketsError && <div className="mt-4"><ErrorBanner message={marketsError} onRetry={reloadMarkets} /></div>}

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Notifications</h2>
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs font-medium text-[#F47A20] hover:text-[#ff8b36]">
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>

        {notifLoading ? (
          <SkeletonCard className="h-32" />
        ) : notifError ? (
          <ErrorBanner message={notifError} onRetry={reloadNotifs} />
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl p-8 bg-[#171C2E]/80 border border-white/[0.06] text-center">
            <BellOff size={22} className="mx-auto text-[#4C5266] mb-2" />
            <p className="text-sm text-[#8B93A8]">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((n) => <NotificationRow key={n.id} n={n} onRead={handleRead} />)}
            {!showAll && notifications.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full py-2.5 text-xs font-medium text-[#9AA1B4] hover:text-white"
              >
                View all ({notifications.length})
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
