import { useState } from "react";
import { Bell, BellOff, CheckCheck, ClipboardList, ChevronRight } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ProfileHeaderCard from "./ProfileHeaderCard";
import PerformanceCircle from "./PerformanceCircle";
import PerformanceHistoryScreen from "./PerformanceHistoryScreen";
import AttendanceSection from "./AttendanceSection";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getProfile } from "../../services/profileService";
import { getPerformanceSummary } from "../../services/activityService";
import { listSuddenTasks } from "../../services/suddenTaskService";
import { listMyNotifications, markNotificationRead, markAllNotificationsRead } from "../../services/notificationService";

function TaskCountTile({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 flex flex-col items-center justify-center gap-2 rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl active:bg-[#1A1F33] transition-colors"
    >
      <span className="w-11 h-11 rounded-full bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
        <ClipboardList size={18} />
      </span>
      <span className="flex items-center gap-1 text-lg font-bold text-white">
        {count == null ? "—" : count}
        <ChevronRight size={14} className="text-[#4C5266]" />
      </span>
      <span className="text-xs font-medium text-[#9AA1B4]">Active Tasks</span>
    </button>
  );
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationRow({ notification, onRead }) {
  return (
    <button
      type="button"
      onClick={() => !notification.read && onRead(notification.id)}
      className={`w-full text-left rounded-xl p-3.5 border transition-colors ${
        notification.read
          ? "bg-[#1A1F33]/40 border-white/[0.05]"
          : "bg-[#1A1F33]/70 border-[#F47A20]/20"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {!notification.read ? <span className="mt-1.5 w-2 h-2 rounded-full bg-[#F47A20] shrink-0" /> : <span className="mt-1.5 w-2 h-2 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{notification.title}</p>
          <p className="text-xs text-[#9AA1B4] mt-0.5 line-clamp-2">{notification.body}</p>
          <p className="text-[11px] text-[#4C5266] mt-1">{timeAgo(notification.createdAt)}</p>
        </div>
      </div>
    </button>
  );
}

// HomeTab.jsx — the Worker/Cashier personal dashboard:
// Profile header (identity, department, WhatsApp)
//   -> Performance (real circular indicator, tap for history)
//   -> Attendance (the full monthly summary + calendar + day-off request,
//      visible right here rather than requiring navigation elsewhere)
//   -> Notifications preview.
//
// Chat and Wasted Overall shortcuts used to live here as a quick-action
// row — removed per the homepage cleanup pass (Home was getting
// cluttered with entry points that duplicate the bottom-nav Chat tab and
// the Activity tab's own Wasted Overall button). Neither feature was
// touched: Chat is still the Chat tab, Wasted Overall is still on the
// Activity tab exactly as before — only this second shortcut is gone.
//
// The old prominent Sudden Tasks section is deliberately gone from this
// page (spec: Home should no longer be dominated by tasks) — Sudden
// Tasks are still fully available via the bottom-nav Tasks tab, nothing
// about that feature was removed, only its Home-page prominence.
export default function HomeTab({ onNavigate }) {
  const { data: profile, error: profileError, loading: profileLoading, reload: reloadProfile } = useAsync(getProfile, { deps: [] });
  const { data: performance } = useAsync(getPerformanceSummary, { deps: [] });
  const { data: suddenTasks } = useAsync(() => listSuddenTasks({ status: "ASSIGNED" }), { deps: [] });
  const {
    data: notificationsData,
    error: notificationsError,
    loading: notificationsLoading,
    setData: setNotificationsData,
    reload: reloadNotifications,
  } = useAsync(() => listMyNotifications({ limit: 30 }), { deps: [] });

  const [showAll, setShowAll] = useState(false);
  const [showPerformanceHistory, setShowPerformanceHistory] = useState(false);

  const notifications = notificationsData?.notifications ?? [];
  const unreadCount = notificationsData?.unreadCount ?? 0;
  const visibleNotifications = showAll ? notifications : notifications.slice(0, 3);

  async function handleMarkRead(id) {
    setNotificationsData((prev) =>
      prev
        ? {
            notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
            unreadCount: Math.max(prev.unreadCount - 1, 0),
          }
        : prev
    );
    try {
      await markNotificationRead(id);
    } catch {
      reloadNotifications();
    }
  }

  async function handleMarkAllRead() {
    setNotificationsData((prev) =>
      prev ? { notifications: prev.notifications.map((n) => ({ ...n, read: true })), unreadCount: 0 } : prev
    );
    try {
      await markAllNotificationsRead();
    } catch {
      reloadNotifications();
    }
  }

  if (showPerformanceHistory) {
    return (
      <div className="min-h-full bg-[#1A1A1A]">
        <PerformanceHistoryScreen onBack={() => setShowPerformanceHistory(false)} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      {profileLoading ? (
        <SkeletonCard className="h-[124px]" />
      ) : profileError ? (
        <ErrorBanner message={profileError} onRetry={reloadProfile} />
      ) : (
        <ProfileHeaderCard profile={profile} />
      )}

      <div className="mt-4 flex gap-3 items-stretch">
        {profile?.role !== "CASHIER" && (
          <PerformanceCircle rate={performance?.rate} onClick={() => setShowPerformanceHistory(true)} />
        )}
        <TaskCountTile count={suddenTasks?.length ?? null} onClick={() => onNavigate?.("tasks")} />
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Attendance</h2>
        <AttendanceSection />
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Notifications</h2>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-[#F47A20] hover:text-[#ff8b36]"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          ) : null}
        </div>

        {notificationsLoading ? (
          <SkeletonCard className="h-24" />
        ) : notificationsError ? (
          <ErrorBanner message={notificationsError} onRetry={reloadNotifications} />
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
            <BellOff size={22} className="mx-auto text-[#4C5266] mb-2" />
            <p className="text-sm text-[#8B93A8]">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleNotifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onRead={handleMarkRead} />
            ))}
            {!showAll && notifications.length > 3 ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-[#9AA1B4] hover:text-white"
              >
                <Bell size={14} /> View all ({notifications.length})
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
