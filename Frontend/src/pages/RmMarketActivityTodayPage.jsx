import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import MarketActivityFeed from "../components/regionalManager/market/MarketActivityFeed";
import { isToday } from "../components/regionalManager/market/activityMeta";
import { listActivitiesForMarket } from "../services/activityService";
import { getMarketOverview } from "../services/marketManagementService";

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// RmMarketActivityTodayPage.jsx — the full chronological feed behind
// "Market Activity Today → See All".
//
// Two layers of scoping, both real: the request itself is
// GET /api/activities/market?marketId=… (access re-checked server-side
// against this market), and the rows are then narrowed to today in the
// viewer's own timezone. Nothing from another market, zone or day can
// reach this list.
export default function RmMarketActivityTodayPage({ marketId, onBack }) {
  const { data: overview } = useAsync(() => getMarketOverview(marketId), { deps: [marketId] });
  const { data: activities, error, loading, reload } = useAsync(
    () => listActivitiesForMarket({ marketId }),
    { deps: [marketId] }
  );

  const todays = useMemo(
    () =>
      (activities ?? [])
        .filter((a) => isToday(a.date))
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [activities]
  );

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-4 pt-4 sm:max-w-3xl sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to market"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/10 active:scale-95"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[22px] font-bold leading-tight text-white">Market Activity Today</h1>
          <p className="truncate text-[12px] text-[#8B93A8]">
            {overview?.name ? `${overview.name} · ` : ""}
            {todayLabel()}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between px-1">
        <p className="text-[12px] text-[#8B93A8]">
          {loading ? "Loading…" : `${todays.length} activit${todays.length === 1 ? "y" : "ies"} logged today`}
        </p>
      </div>

      {error ? (
        <div className="mt-3">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : (
        <div className="mt-2 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 px-3.5 backdrop-blur-xl">
          <MarketActivityFeed activities={todays} loading={loading} />
        </div>
      )}
    </div>
  );
}
