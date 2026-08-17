import { MapPinned, Users2, UserCheck, Star, CalendarClock } from "lucide-react";
import StatusPill from "../common/StatusPill";

function titleCaseStatus(status) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function lastVisitLabel(iso) {
  if (!iso) return "No visits yet";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? "Today" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// MarketCard.jsx — spec §5: enough at a glance to decide whether to open
// a market. Every value here is real (from GET /api/markets — see
// marketsController.listMarkets), nothing decorative/placeholder.
export default function MarketCard({ market, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl
                 hover:border-[#F47A20]/30 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-white truncate">{market.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[#8B93A8]">
            <MapPinned size={11} /> Zone {market.zoneNumber} &middot; Supervisor: {market.supervisor}
          </p>
        </div>
        <StatusPill status={titleCaseStatus(market.status)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-lg px-3 py-2 bg-white/[0.03] border border-white/[0.05]">
          <p className="flex items-center gap-1.5 text-white font-semibold text-sm">
            <Users2 size={13} className="text-[#8B93A8]" /> {market.employeesCount}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mt-0.5">Employees</p>
        </div>
        <div className="rounded-lg px-3 py-2 bg-white/[0.03] border border-white/[0.05]">
          <p className="flex items-center gap-1.5 text-emerald-400 font-semibold text-sm">
            <UserCheck size={13} /> {market.activeCount}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mt-0.5">Active Now</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[#9AA1B4]">
          <Star size={12} className={market.currentRating != null ? "text-amber-400" : "text-[#4C5266]"} />
          {market.currentRating != null ? `${market.currentRating}/10` : "Not rated yet"}
        </span>
        <span className="flex items-center gap-1.5 text-[#9AA1B4]">
          <CalendarClock size={12} /> {lastVisitLabel(market.lastVisitDate)}
        </span>
      </div>
    </button>
  );
}
