import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "./SkeletonCard";
import ErrorBanner from "./ErrorBanner";
import { listMyNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteAllNotifications } from "../../services/notificationService";
import { notificationDestination } from "../../utils/notificationLinks";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Row({ n, onOpen, onDelete }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl p-3.5 border transition-colors ${
        n.read ? "bg-[#1A1F33]/40 border-white/[0.05]" : "bg-[#1A1F33]/70 border-[#F47A20]/20"
      }`}
    >
      <button type="button" onClick={() => onOpen(n)} className="flex-1 min-w-0 text-left flex items-start gap-2.5">
        {!n.read ? <span className="mt-1.5 w-2 h-2 rounded-full bg-[#F47A20] shrink-0" /> : <span className="mt-1.5 w-2 h-2 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{n.title}</p>
          <p className="text-xs text-[#9AA1B4] mt-0.5 line-clamp-2">{n.body}</p>
          <p className="text-[11px] text-[#4C5266] mt-1">{timeAgo(n.createdAt)}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
        aria-label="Delete notification"
        className="shrink-0 p-1.5 mt-0.5 rounded-lg text-[#4C5266] hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// NotificationsPreviewSection.jsx — a real, delete-capable notification
// preview for a homepage, shared by Supervisor and Admin (neither had
// one at all before — Employee/HomeTab.jsx and RegionalManagerProfile.jsx
// each already had their own, now separately given the same delete
// capability, left as their own distinct implementations rather than
// migrated onto this one to avoid an unrequested visual change to an
// already-working screen). Same real backend as the notification bell
// (GET /api/notifications, PATCH .../read, PATCH .../read-all,
// DELETE /api/notifications/:id) — no second notification architecture.
export default function NotificationsPreviewSection({ basePath, previewCount = 3 }) {
  const navigate = useNavigate();
  const { data, error, loading, setData, reload } = useAsync(() => listMyNotifications({ limit: 30 }), { deps: [] });
  const [showAll, setShowAll] = useState(false);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const visible = showAll ? notifications : notifications.slice(0, previewCount);

  async function handleRead(id) {
    setData((prev) =>
      prev
        ? { notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)), unreadCount: Math.max(prev.unreadCount - 1, 0) }
        : prev
    );
    try {
      await markNotificationRead(id);
    } catch {
      reload();
    }
  }

  async function handleMarkAllRead() {
    setData((prev) => (prev ? { notifications: prev.notifications.map((n) => ({ ...n, read: true })), unreadCount: 0 } : prev));
    try {
      await markAllNotificationsRead();
    } catch {
      reload();
    }
  }

  async function handleDelete(id) {
    const wasUnread = notifications.find((n) => n.id === id)?.read === false;
    setData((prev) =>
      prev
        ? { notifications: prev.notifications.filter((n) => n.id !== id), unreadCount: wasUnread ? Math.max(prev.unreadCount - 1, 0) : prev.unreadCount }
        : prev
    );
    try {
      await deleteNotification(id);
    } catch {
      reload();
    }
  }

  async function handleDeleteAll() {
    setData({ notifications: [], unreadCount: 0 });
    try {
      await deleteAllNotifications();
    } catch {
      reload();
    }
  }

  function handleOpen(n) {
    if (!n.read) handleRead(n.id);
    const destination = notificationDestination(n, basePath);
    if (destination) navigate(destination);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Notifications</h2>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs font-medium text-[#F47A20] hover:text-[#ff8b36]">
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button type="button" onClick={handleDeleteAll} className="flex items-center gap-1 text-xs font-medium text-[#9AA1B4] hover:text-red-400">
              <Trash2 size={13} /> Delete all
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonCard className="h-24" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
          <BellOff size={22} className="mx-auto text-[#4C5266] mb-2" />
          <p className="text-sm text-[#8B93A8]">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((n) => (
            <Row key={n.id} n={n} onOpen={handleOpen} onDelete={handleDelete} />
          ))}
          {!showAll && notifications.length > previewCount && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-[#9AA1B4] hover:text-white"
            >
              <Bell size={14} /> View all ({notifications.length})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
