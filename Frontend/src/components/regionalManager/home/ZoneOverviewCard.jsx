import { ChevronRight } from "lucide-react";
import ZoneFieldVisual from "./ZoneFieldVisual";

function formatCount(n) {
  return typeof n === "number" ? n.toLocaleString("en-US") : "—";
}

// ZoneOverviewCard.jsx — "which zone do I manage, and is it healthy?"
// answered in one glance.
//
// Every value is real: the title and counts come from GET /api/zones
// (scoped server-side to this Regional Manager's own zones), the points
// inside the visual are the real markets from GET /api/markets, and the
// status line below is derived from real market status + real open
// MarketProblem rows — it says "All Systems Operational" only when that
// is actually true, and names the real problem count when it isn't.
export default function ZoneOverviewCard({ zoneLabel, marketCount, employeeCount, markets, problemMarketIds, openProblemCount, offlineCount, onOpen, loading }) {
  const healthy = openProblemCount === 0 && offlineCount === 0;

  const statusText = healthy
    ? "All Systems Operational"
    : openProblemCount > 0
      ? `${openProblemCount} open ${openProblemCount === 1 ? "report" : "reports"}${offlineCount ? ` · ${offlineCount} market${offlineCount === 1 ? "" : "s"} offline` : ""}`
      : `${offlineCount} market${offlineCount === 1 ? "" : "s"} not active`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-[20px] border border-white/[0.07] bg-gradient-to-b from-[#0E1729]/95 to-[#0A1120]/95 text-left backdrop-blur-xl shadow-[0_10px_36px_-18px_rgba(0,0,0,0.9)] transition-colors duration-300 hover:border-[#F47A20]/25"
    >
      <div className="absolute inset-0" aria-hidden="true">
        <ZoneFieldVisual markets={markets ?? []} problemMarketIds={problemMarketIds} />
      </div>
      {/* Readability scrim over the visual — the field is atmosphere,
          the numbers are the message. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A1120]/95 via-[#0A1120]/70 to-transparent" aria-hidden="true" />

      <div className="relative px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-bold leading-tight text-white">{loading ? "…" : zoneLabel}</h2>
            <p className="mt-1 text-[12.5px] text-[#9AA1B4]">
              {loading ? "Loading zone…" : `${formatCount(marketCount)} Markets · ${formatCount(employeeCount)} Employees`}
            </p>
          </div>
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[#9AA1B4] transition-colors group-hover:text-white">
            <ChevronRight size={15} />
          </span>
        </div>

        <div className="mt-9 flex items-center gap-2">
          <span className={`relative flex h-2 w-2 shrink-0 ${healthy ? "" : ""}`}>
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-glow-pulse ${healthy ? "bg-emerald-400" : "bg-amber-400"}`}
            />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${healthy ? "bg-emerald-400" : "bg-amber-400"}`} />
          </span>
          <p className={`text-[12px] font-medium ${healthy ? "text-emerald-400" : "text-amber-400"}`}>
            {loading ? "Checking zone status…" : statusText}
          </p>
        </div>
      </div>
    </button>
  );
}
