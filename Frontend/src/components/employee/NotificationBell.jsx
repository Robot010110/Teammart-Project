import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Bell, BellOff, CheckCheck, X, ClipboardList, MessageCircle, ShieldAlert,
  PackageX, CalendarOff, CheckCircle2, XCircle, Megaphone, Trash2,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { listMyNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteAllNotifications } from "../../services/notificationService";
import { notificationDestination } from "../../utils/notificationLinks";

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// One notification's icon + tone — every real NotificationType this
// backend ever writes (grep-verified against
// backend/prisma/schema.prisma's NotificationType enum), not a guessed
// superset.
const TYPE_STYLE = {
  SUDDEN_TASK: { icon: ClipboardList, tone: "text-[#F47A20] bg-[#F47A20]/10" },
  LEAVE_REVIEWED: { icon: CalendarOff, tone: "text-sky-400 bg-sky-500/10" },
  CHAT_MESSAGE: { icon: MessageCircle, tone: "text-[#F47A20] bg-[#F47A20]/10" },
  ANNOUNCEMENT: { icon: Megaphone, tone: "text-amber-400 bg-amber-500/10" },
  WASTED_OVERALL: { icon: PackageX, tone: "text-[#F47A20] bg-[#F47A20]/10" },
  SUBMISSION_REVIEWED: { icon: CheckCircle2, tone: "text-emerald-400 bg-emerald-500/10" },
};

function iconFor(notification) {
  if (notification.type === "SUBMISSION_REVIEWED" && /reject/i.test(notification.title)) {
    return { icon: XCircle, tone: "text-red-400 bg-red-500/10" };
  }
  return TYPE_STYLE[notification.type] ?? { icon: Bell, tone: "text-[#9AA1B4] bg-white/[0.06]" };
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Groups newest-first notifications into Today / Yesterday / Earlier —
// the same three buckets regardless of how far back the list goes, so
// the center never needs a "This Week" edge case for a 30-row page.
function groupByDay(notifications) {
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (isSameDay(d, now)) groups.Today.push(n);
    else if (isSameDay(d, yesterday)) groups.Yesterday.push(n);
    else groups.Earlier.push(n);
  }
  return groups;
}

function NotificationRow({ notification, onOpen, onDelete }) {
  const { icon: Icon, tone } = iconFor(notification);
  return (
    <div
      className={`group w-full flex items-start gap-3 rounded-xl p-3.5 border transition-colors ${
        notification.read ? "bg-[#1A1F33]/40 border-white/[0.05]" : "bg-[#1A1F33]/70 border-[#F47A20]/20"
      }`}
    >
      <button type="button" onClick={() => onOpen(notification)} className="flex items-start gap-3 min-w-0 flex-1 text-left">
        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white truncate">{notification.title}</p>
            {!notification.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#F47A20] shrink-0" />}
          </div>
          <p className="text-xs text-[#9AA1B4] mt-0.5 line-clamp-2">{notification.body}</p>
          <p className="text-[11px] text-[#4C5266] mt-1">{timeLabel(notification.createdAt)}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        aria-label="Delete notification"
        className="shrink-0 p-1.5 mt-0.5 rounded-lg text-[#4C5266] hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// Rendered via a portal for the same reason Modal.jsx is (see its own
// comment): this bell sits inside the top bar's backdrop-blur-xl
// container, which would otherwise silently break its popup's
// `fixed inset-0` positioning.
//
// NotificationBell.jsx — the Notification Center: grouped by Today/
// Yesterday/Earlier and actionable (tapping a notification navigates to
// what it's about — a task, a conversation, Performance History, or
// Attendance — via notificationLinks.js, instead of being a dead end).
// Same real backend as before (GET /api/notifications, PATCH .../read,
// PATCH .../read-all) — no second notification architecture, this is
// still the one always-reachable entry point into that data.
export default function NotificationBell({ basePath }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data, error, loading, setData, reload } = useAsync(() => listMyNotifications({ limit: 30 }), { deps: [] });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const groups = useMemo(() => groupByDay(notifications), [notifications]);

  async function markReadLocal(id) {
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

  // Repair Pass §6 — a real, persisted delete (soft-deleted server-side;
  // see notificationsController.deleteNotification's own comment).
  // Optimistically removed from this list immediately; reload() rolls
  // back the optimistic removal if the request actually fails, same
  // pattern as markReadLocal above.
  async function handleDelete(id) {
    const wasUnread = notifications.find((n) => n.id === id)?.read === false;
    setData((prev) =>
      prev
        ? {
            notifications: prev.notifications.filter((n) => n.id !== id),
            unreadCount: wasUnread ? Math.max(prev.unreadCount - 1, 0) : prev.unreadCount,
          }
        : prev
    );
    try {
      await deleteNotification(id);
    } catch {
      reload();
    }
  }

  // Bulk "Delete All" — same real soft-delete as handleDelete above, one
  // request for the whole feed instead of one per notification.
  async function handleDeleteAll() {
    setData({ notifications: [], unreadCount: 0 });
    try {
      await deleteAllNotifications();
    } catch {
      reload();
    }
  }

  function handleOpen(notification) {
    if (!notification.read) markReadLocal(notification.id);
    const destination = notificationDestination(notification, basePath);
    if (destination) {
      setOpen(false);
      navigate(destination);
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
                {notifications.length > 0 && (
                  <button type="button" onClick={handleDeleteAll} className="flex items-center gap-1 text-xs font-medium text-[#9AA1B4] hover:text-red-400">
                    <Trash2 size={13} /> Delete all
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="p-1 text-[#9AA1B4] hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {loading ? (
                <SkeletonCard className="h-24" />
              ) : error ? (
                <ErrorBanner message={error} onRetry={reload} />
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <BellOff size={22} className="mx-auto text-[#4C5266] mb-2" />
                  <p className="text-sm text-white font-medium">You're all caught up</p>
                  <p className="text-xs text-[#8B93A8] mt-1">No notifications right now.</p>
                </div>
              ) : (
                ["Today", "Yesterday", "Earlier"].map((label) =>
                  groups[label].length > 0 ? (
                    <div key={label}>
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8B93A8]">{label}</h3>
                      <div className="space-y-2">
                        {groups[label].map((n) => (
                          <NotificationRow key={n.id} notification={n} onOpen={handleOpen} onDelete={handleDelete} />
                        ))}
                      </div>
                    </div>
                  ) : null
                )
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
