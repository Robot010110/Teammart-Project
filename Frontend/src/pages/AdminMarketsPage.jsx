import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import MarketCard from "../components/markets/MarketCard";
import { listMarkets } from "../services/marketService";

// AdminMarketsPage.jsx — every market company-wide (GET /api/markets is
// unscoped for ADMIN — see marketsController.listMarkets). Opening a
// market goes to AdminMarketDetailPage.jsx, which reuses
// RmMarketOverview.jsx entirely and adds only the explicit Market
// Visit/Administrative Inspection action bar (Admin Phase 3 §1/§6) — a
// plain click here is normal navigation, never itself a recorded visit.
export default function AdminMarketsPage() {
  const { data: markets, error, loading, reload } = useAsync(listMarkets, { deps: [] });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!markets) return [];
    const q = query.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter(
      (m) => m.name.toLowerCase().includes(q) || m.supervisor.toLowerCase().includes(q) || `zone ${m.zoneNumber}`.includes(q)
    );
  }, [markets, query]);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Markets</h1>
          <p className="mt-1 text-sm text-[#9AA1B4]">
            {loading ? "Loading..." : `${markets?.length ?? 0} market${markets?.length === 1 ? "" : "s"} company-wide`}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5266]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets, supervisors, zones..."
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[180px]" />)}
          </div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
            {query ? "No markets match your search." : "No markets exist yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((m) => <MarketCard key={m.id} market={m} onOpen={() => navigate(`/admin/markets/${m.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
