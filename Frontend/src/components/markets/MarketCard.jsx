import { ArrowRight, Users2, Store } from "lucide-react";
import StatusPill from "../common/StatusPill";

// MarketCard.jsx — represents a single supermarket branch inside a zone.

export default function MarketCard({ market, onOpen, index = 0 }) {
  return (
    <div
      style={{ animationDelay: `${index * 70}ms` }}
      className="animate-fade-up group relative rounded-2xl p-6
                 bg-[#1F2436]/70 border border-white/[0.06] backdrop-blur-xl
                 shadow-[0_6px_20px_rgba(0,0,0,0.3)]
                 transition-all duration-300 ease-out
                 hover:-translate-y-1 hover:border-[#F47A20]/35
                 hover:shadow-[0_16px_36px_rgba(244,122,32,0.12)]
                 active:scale-[0.99] cursor-pointer"
      onClick={() => onOpen?.(market)}
    >
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-xl bg-[#1D2D5C] grid place-items-center">
          <Store size={20} className="text-[#F47A20]" strokeWidth={1.8} />
        </div>
        <StatusPill status={market.status} />
      </div>

      <h4 className="mt-5 font-display text-lg font-semibold text-white">
        {market.name}
      </h4>

      <div className="mt-2 flex items-center gap-2 text-sm text-[#9AA1B4]">
        <Users2 size={15} />
        <span>{market.employees} Employees</span>
      </div>

      <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-[#F47A20] opacity-90 group-hover:gap-2.5 transition-all duration-200">
        Open
        <ArrowRight size={15} />
      </div>
    </div>
  );
}
