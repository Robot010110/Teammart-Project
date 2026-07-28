import { useState } from "react";
import { Store, ArrowRight, Search } from "lucide-react";
import { getAllMarkets } from "../../data/auth";

// MarketPicker.jsx — Supervisor selects which single market they oversee.

export default function MarketPicker({ onSelect }) {
  const [query, setQuery] = useState("");
  const markets = getAllMarkets().filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your market..."
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-8 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 transition-colors duration-200"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
        {markets.map((market, i) => (
          <button
            key={market.id}
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => onSelect(market)}
            className="animate-fade-up group text-left rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.06]
                       transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F47A20]/40 active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <Store size={16} className="text-[#F47A20]" />
              <ArrowRight size={14} className="text-[#4C5266] group-hover:text-[#F47A20] transition-colors duration-200" />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">{market.name}</p>
            <p className="text-xs text-[#8B93A8]">Zone {market.zoneNumber}</p>
          </button>
        ))}
        {markets.length === 0 && <p className="text-sm text-[#4C5266] py-6 col-span-2 text-center">No markets match "{query}".</p>}
      </div>
    </div>
  );
}
