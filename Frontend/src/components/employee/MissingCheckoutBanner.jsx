import { useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { confirmStillWorking } from "../../services/attendanceService";
import { listMyNotifications, markNotificationRead } from "../../services/notificationService";
import { useAsync } from "../../hooks/useAsync";

// MissingCheckoutBanner.jsx — spec §7: "Check-out not detected. Are you
// still working?" Shows for any unread MISSING_CHECKOUT notification
// (see attendanceController.detectMissingCheckout, which runs lazily off
// the employee's own attendance page load — there's no live fingerprint
// feed to push this in real time, see that function's own comment).
// Confirming just acknowledges the prompt (stillWorkingConfirmedAt) and
// marks the notification read; it isn't itself a source of extra-hours
// data.
export default function MissingCheckoutBanner() {
  const { data, setData, loading } = useAsync(() => listMyNotifications({ limit: 20 }), { deps: [] });
  const [busyId, setBusyId] = useState(null);

  const flagged = (data?.notifications ?? []).filter((n) => n.type === "MISSING_CHECKOUT" && !n.read);

  async function handleConfirm(notification) {
    setBusyId(notification.id);
    try {
      if (notification.linkId) await confirmStillWorking(notification.linkId);
      await markNotificationRead(notification.id);
      setData((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      }));
    } catch {
      // Non-fatal — the banner just stays up for another try.
    } finally {
      setBusyId(null);
    }
  }

  if (loading || flagged.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {flagged.map((n) => (
        <div key={n.id} className="rounded-xl p-3.5 bg-amber-500/[0.08] border border-amber-500/25 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">Check-out not detected</p>
            <p className="text-xs text-[#9AA1B4] mt-0.5">Are you still working?</p>
          </div>
          <button
            type="button"
            onClick={() => handleConfirm(n)}
            disabled={busyId === n.id}
            className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-amber-500/80 hover:bg-amber-500 disabled:opacity-50 transition-colors duration-150"
          >
            {busyId === n.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Yes, still working
          </button>
        </div>
      ))}
    </div>
  );
}
