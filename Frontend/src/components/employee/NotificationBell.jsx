import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, CheckCheck, X } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { listMyNotifications, markNotificationRead, markAllNotificationsRead } from "../../services/notificationService";

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
        notification.read ? "bg-[#1A1F33]/40 border-white/[0.05]" : "bg-[#1A1F33]/70 border-[#F47A20]/20"
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

// Rendered via a portal for the same reason Modal.jsx is (see its own
// comment): this bell sits inside the top bar's backdrop-blur-xl
// container, which would otherwise silently break its popup's
// `fixed inset-0` positioning.
// NotificationBell.jsx — a real, working notification bell for the
// Employee/Cashier mobile top bar (previously there was none at all in
// the mobile shell; the only bell icon in this codebase, in
// layout/Header.jsx, is decorative and only ever rendered for the
// Regional Manager's desktop view, which has no real notifications
// backend). This connects to the exact same real backend
// notifications system HomeTab.jsx's own notifications section already
// uses (GET /api/notifications, PATCH .../read, PATCH .../read-all) — no
// second notification architecture, just a second, always-reachable
// entry point into the same data, appropriate for a bell that should
// work from anywhere in the app, not only the Home tab.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const {
    data,
    error,
    loading,
    setData,
    reload,
  } = useAsync(() => listMyNotifications({ limit: 30 }), { deps: [] });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  async function handleMarkRead(id) {
    setData((prev) =>
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

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Notifications"
        className="relative h-9 w-9 rounded-full grid place-items-center bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors duration-200"
      >
        <Bell size={17} className="text-[#E8E8E8]" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#F47A20] text-[10px] font-bold text-white grid place-items-center ring-2 ring-[#1A1A1A]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-md sm:mx-4 max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#171C2E] border border-white/[0.08] shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] shrink-0">
              <h2 className="text-sm font-semibold text-white">Notifications</h2>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button type="button" onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs font-medium text-[#F47A20] hover:text-[#ff8b36]">
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="p-1 text-[#9AA1B4] hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <SkeletonCard className="h-24" />
              ) : error ? (
                <ErrorBanner message={error} onRetry={reload} />
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <BellOff size={22} className="mx-auto text-[#4C5266] mb-2" />
                  <p className="text-sm text-[#8B93A8]">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => <NotificationRow key={n.id} notification={n} onRead={handleMarkRead} />)
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
