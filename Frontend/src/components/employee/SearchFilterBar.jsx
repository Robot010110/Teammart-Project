import { Search, SlidersHorizontal } from "lucide-react";

// SearchFilterBar.jsx — search + quick filters for the Activity Timeline.

const RANGE_OPTIONS = ["Today", "This Week", "This Month", "Custom Range"];

export default function SearchFilterBar({ query, onQuery, range, onRange, typeFilter, onTypeFilter, types }) {
  return (
    <div className="flex flex-col md:flex-row gap-3 md:items-center">
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search activities..."
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 transition-colors duration-200"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
        <SlidersHorizontal size={14} className="text-[#4C5266] shrink-0" />
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => onRange(r)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              range === r ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] hover:bg-white/[0.09]"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <select
        value={typeFilter}
        onChange={(e) => onTypeFilter(e.target.value)}
        className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-xs text-[#D6D9E3] outline-none focus:border-[#F47A20]/50 transition-colors duration-200"
      >
        <option value="All">All Task Types</option>
        {types.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}
