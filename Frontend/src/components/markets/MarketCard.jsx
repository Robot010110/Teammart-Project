import { ChevronRight, MapPin, UserRound, Users2 } from "lucide-react";
import MarketPhoto from "./MarketPhoto";

const STATUS = {
  ACTIVE: { label: "Active", dot: "bg-emerald-400", text: "text-emerald-400", ring: "ring-emerald-500/20", bg: "bg-emerald-500/10" },
  MAINTENANCE: { label: "Maintenance", dot: "bg-amber-400", text: "text-amber-400", ring: "ring-amber-500/20", bg: "bg-amber-500/10" },
  CLOSED: { label: "Inactive", dot: "bg-red-400", text: "text-red-400", ring: "ring-red-500/20", bg: "bg-red-500/10" },
};

// MarketCard.jsx — one market, scannable in about a second.
//
// Every value is real, straight from GET /api/markets
// (marketsController.listMarkets): name, status, zone number, assigned
// supervisor, employee count, and activeCount — employees actually
// checked in and not yet checked out today. The thumbnail is the
// market's own Market.photoUrl through the existing MarketPhoto/
// AuthenticatedImage pipeline (private files need an auth header, so a
// plain <img> would not work here), falling back to the branded glyph
// when a market has no photo yet.
//
// Deliberately compact: the brief asks a Regional Manager to be able to
// scan five or six markets at a glance, so rating/last-visit moved to
// the market's own detail page rather than crowding this row.
export default function MarketCard({ market, onOpen, index = 0 }) {
  const status = STATUS[market.status] ?? STATUS.ACTIVE;
  const isLive = market.activeCount > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className="animate-fade-up group w-full rounded-[18px] border border-white/[0.07] bg-[#111A2D]/80 p-3 text-left backdrop-blur-xl
                 transition-all duration-200 ease-out hover:border-[#F47A20]/30 hover:bg-[#131E33]/90
                 active:scale-[0.985] focus:outline-none focus-visible:border-[#F47A20]/50"
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <MarketPhoto photoUrl={market.photoUrl} size="sm" />
          {/* Keeps the thumbnail sitting inside the card's own tonal
              range instead of punching a bright hole in it. */}
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-[#0A1120]/55 to-transparent" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-white">{market.name}</h3>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-medium ring-1 ring-inset ${status.bg} ${status.text} ${status.ring}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>

          <p className="mt-1 flex items-center gap-1.5 truncate text-[11.5px] text-[#8B93A8]">
            <MapPin size={11} className="shrink-0" />
            Zone {market.zoneNumber}
            <span className="text-[#3A4155]">·</span>
            <UserRound size={11} className="shrink-0" />
            <span className="truncate">Sup. {market.supervisor}</span>
          </p>
        </div>

        <ChevronRight size={16} className="shrink-0 text-[#4C5266] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#F47A20]" />
      </div>

      <div className="mt-2.5 flex items-center gap-4 border-t border-white/[0.05] pt-2.5">
        <span className="flex items-center gap-1.5 text-[11.5px] text-[#9AA1B4]">
          <Users2 size={12} className="text-[#5C6479]" />
          <span className="font-semibold tabular-nums text-white">{market.employeesCount}</span> Employees
        </span>
        <span className={`flex items-center gap-1.5 text-[11.5px] ${isLive ? "text-[#9AA1B4]" : "text-[#6B7488]"}`}>
          <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
            {isLive && <span className="absolute h-2 w-2 rounded-full bg-emerald-400/60 animate-glow-pulse" />}
            <span className={`relative h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-[#3A4155]"}`} />
          </span>
          <span className={`font-semibold tabular-nums ${isLive ? "text-emerald-400" : "text-[#8B93A8]"}`}>{market.activeCount}</span> Active Now
        </span>
      </div>
    </button>
  );
}
