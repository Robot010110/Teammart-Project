import { useState } from "react";
import { Bell, CheckCircle2, Clock3, AlertTriangle, Loader2, CreditCard } from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { useAsync } from "../hooks/useAsync";
import { getZoneCardSalesSummary, sendCardSalesReminder } from "../services/cardSalesService";
import { ApiError } from "../services/apiClient";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function minutesAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const STATUS_STYLE = {
  COMPLETED: { label: "Completed", icon: CheckCircle2, tone: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" },
  PENDING: { label: "Pending", icon: Clock3, tone: "text-[#9AA1B4] bg-white/[0.06] ring-white/10" },
  PENDING_REMINDER: { label: "Reminder Sent", icon: Bell, tone: "text-amber-400 bg-amber-500/10 ring-amber-500/20" },
  NOT_COMPLETED: { label: "Not Completed", icon: AlertTriangle, tone: "text-red-400 bg-red-500/10 ring-red-500/20" },
};

function MarketCardSalesRow({ market, onRemind, reminding }) {
  const style = STATUS_STYLE[market.status] ?? STATUS_STYLE.PENDING;
  const Icon = style.icon;

  return (
    <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{market.name}</p>
          <p className="text-xs text-[#8B93A8] mt-0.5">{market.completedCount} of {market.totalShifts} shifts reported</p>
          {market.lastReminderAt && (
            <p className="text-[11px] text-[#4C5266] mt-1">Reminder sent {minutesAgo(market.lastReminderAt)}</p>
          )}
        </div>
        <span className={`shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${style.tone}`}>
          <Icon size={12} /> {style.label}
        </span>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
          style={{ width: `${(market.completedCount / market.totalShifts) * 100}%` }}
        />
      </div>

      {market.status !== "COMPLETED" && (
        <button
          type="button"
          onClick={() => onRemind(market.marketId)}
          disabled={reminding}
          className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {reminding ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
          {reminding ? "Sending..." : "Send Reminder"}
        </button>
      )}
    </div>
  );
}

// RmCardSalesZoneStatusPage.jsx — Market Activities §3-4's Card Sales
// detail screen: every market in the zone, how many of today's 3 shifts
// are reported, and a real "Send Reminder" action
// (cardSalesService.sendCardSalesReminder -> POST /api/card-sales/remind)
// that notifies the market's Supervisor/Overlooking and starts the
// 10-minute grace window the backend derives NOT_COMPLETED from — see
// cardSalesController.getZoneCardSalesSummary's own comment. No frontend
// timer/fake state: reloading this screen (or reload() after sending)
// always reflects the backend's own computed status.
export default function RmCardSalesZoneStatusPage({ onBack }) {
  const { data, error, loading, reload } = useAsync(() => getZoneCardSalesSummary({ date: todayIso() }), { deps: [] });
  const [remindingId, setRemindingId] = useState(null);
  const [remindError, setRemindError] = useState(null);

  async function handleRemind(marketId) {
    setRemindingId(marketId);
    setRemindError(null);
    try {
      await sendCardSalesReminder({ marketId, date: todayIso() });
      await reload();
    } catch (err) {
      setRemindError(err instanceof ApiError ? err.message : "Could not send the reminder. Please try again.");
    } finally {
      setRemindingId(null);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto animate-fade-up pb-10">
      <Breadcrumb items={[{ label: "Market Activities", onClick: onBack }, { label: "Card Sales" }]} />

      <div className="mt-4 flex items-center gap-2">
        <span className="grid place-items-center h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400">
          <CreditCard size={17} />
        </span>
        <h1 className="text-xl font-bold text-white">Card Sales — Today</h1>
      </div>

      {remindError && <p className="mt-3 text-xs text-red-400">{remindError}</p>}

      <div className="mt-4 space-y-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[130px]" />)
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : data.markets.length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
            No markets are assigned to you yet.
          </div>
        ) : (
          data.markets.map((m) => (
            <MarketCardSalesRow key={m.marketId} market={m} onRemind={handleRemind} reminding={remindingId === m.marketId} />
          ))
        )}
      </div>
    </div>
  );
}
