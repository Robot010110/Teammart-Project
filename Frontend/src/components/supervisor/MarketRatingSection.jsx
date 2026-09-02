import { useState } from "react";
import { Star, User, ChevronDown, ChevronUp } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { listMarketRatings } from "../../services/marketManagementService";

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function shortDateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RatingRow({ rating }) {
  return (
    <div className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Star size={13} className="text-amber-400 fill-current" /> {rating.rating}/10
        </span>
        <span className="text-xs text-[#4C5266]">{shortDateLabel(rating.createdAt)}</span>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#8B93A8]">
        <User size={11} /> {rating.regionalManager?.name ?? "Regional Manager"}
      </p>
      {rating.notes && <p className="mt-1.5 text-xs text-[#9AA1B4] italic">&ldquo;{rating.notes}&rdquo;</p>}
    </div>
  );
}

// MarketRatingSection.jsx — Supervisor <-> Regional Manager connectivity
// fix: the Supervisor's own view of their market's rating. Real data —
// GET /api/markets/:id/ratings (already Supervisor-accessible, market-
// scoped server-side via assertMarketAccess — see marketManagementController.
// listMarketRatings, unchanged) — never supervisorMockData.js, never a
// second rating system. Every rating the Regional Manager has ever given
// is a real, un-overwritten row (spec: "old ratings are NOT destroyed"),
// so the latest is just ratings[0] and the rest is real history, not a
// separate feature.
export default function MarketRatingSection({ marketId }) {
  const { data: ratings, error, loading, reload } = useAsync(() => listMarketRatings(marketId), { deps: [marketId] });
  const [showHistory, setShowHistory] = useState(false);

  if (loading) return <SkeletonCard className="h-32" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  if (!ratings || ratings.length === 0) {
    return (
      <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
        <Star size={20} className="mx-auto text-[#4C5266] mb-2" />
        <p className="text-sm text-[#8B93A8]">Your market hasn't been rated yet.</p>
      </div>
    );
  }

  const [latest, ...history] = ratings;

  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-display font-extrabold text-white">{latest.rating}</span>
        <span className="text-sm text-[#8B93A8]">/ 10</span>
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8B93A8]">
        <User size={12} /> Rated by {latest.regionalManager?.name ?? "Regional Manager"}
      </p>
      <p className="text-xs text-[#4C5266] mt-0.5">{dateLabel(latest.createdAt)}</p>
      {latest.notes && (
        <p className="mt-3 text-sm text-[#D5D9E5] italic leading-relaxed">&ldquo;{latest.notes}&rdquo;</p>
      )}

      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#9AA1B4] hover:text-white"
          >
            {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showHistory ? "Hide" : "View"} Rating History ({history.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {history.map((r) => <RatingRow key={r.id} rating={r} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
