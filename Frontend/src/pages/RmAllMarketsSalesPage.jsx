import { useMemo, useState } from "react";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { useAsync } from "../hooks/useAsync";
import { getZoneSalesSummary } from "../services/totalSalesService";
import { CURRENCIES, formatCurrency } from "../utils/currency";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ChangeBadge({ pct }) {
  if (pct === 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-[#8B93A8]">
        <Minus size={12} /> 0%
      </span>
    );
  }
  const positive = pct > 0;
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {positive ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function MarketSalesCard({ market, currency }) {
  return (
    <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white truncate">{market.name}</p>
        <ChangeBadge pct={market.changePct} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[#8B93A8]">Today</p>
          <p className="mt-0.5 text-lg font-display font-bold text-white">{formatCurrency(market.today, currency)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[#8B93A8]">Yesterday</p>
          <p className="mt-0.5 text-lg font-display font-bold text-[#9AA1B4]">{formatCurrency(market.yesterday, currency)}</p>
        </div>
      </div>
    </div>
  );
}

// RmAllMarketsSalesPage.jsx — Market Activities §2's "View All Markets"
// detail screen: every market in the Regional Manager's zone(s), each
// with today vs yesterday and the same real totalSalesService data the
// landing card's chart/top-3 came from (getZoneSalesSummary now also
// returns the full per-market breakdown — see that controller's own
// comment), never a second fetch of raw reports re-aggregated here.
export default function RmAllMarketsSalesPage({ onBack }) {
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState("USD");
  const { data, error, loading, reload } = useAsync(() => getZoneSalesSummary({ date: todayIso(), days: 2 }), { deps: [] });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.markets;
    return data.markets.filter((m) => m.name.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto animate-fade-up pb-10">
      <Breadcrumb items={[{ label: "Market Activities", onClick: onBack }, { label: "All Markets" }]} />

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">All Markets — Sales</h1>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-xs font-semibold text-white outline-none focus:border-[#F47A20]/50"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code} className="bg-[#1F2436]">{c.code}</option>
          ))}
        </select>
      </div>

      <div className="relative mt-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets..."
          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
        />
      </div>

      <div className="mt-4 space-y-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[100px]" />)
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
            {query ? "No markets match your search." : "No markets are assigned to you yet."}
          </div>
        ) : (
          filtered.map((m) => <MarketSalesCard key={m.marketId} market={m} currency={currency} />)
        )}
      </div>
    </div>
  );
}
