import { CupSoda, Snowflake, Leaf, UtensilsCrossed, Package, PackageOpen, ShoppingBasket, Nut, Check, Clock3, X } from "lucide-react";
import { MARKET_SECTIONS } from "../../data/supervisorMockData";

// Icon/tone per department — purely presentational, keyed off the same
// MARKET_SECTIONS.key values the rest of the app already uses. This tone
// is the tile's icon-chip color at rest (BLUE/not-reported); a real
// report status (YELLOW/GREEN/RED — see STATUS_STYLE below) overrides
// the tile's border/background, but the department icon itself always
// keeps its own identity color so the grid stays recognizable at a
// glance regardless of report state.
const SECTION_STYLE = {
  DRINKS: { icon: CupSoda, tone: "bg-sky-500/10 text-sky-400" },
  FREEZER: { icon: Snowflake, tone: "bg-cyan-500/10 text-cyan-400" },
  FRESH: { icon: Leaf, tone: "bg-emerald-500/10 text-emerald-400" },
  FOOD: { icon: UtensilsCrossed, tone: "bg-[#F47A20]/10 text-[#F47A20]" },
  NON_FOOD_1: { icon: Package, tone: "bg-violet-500/10 text-violet-400" },
  NON_FOOD_2: { icon: PackageOpen, tone: "bg-violet-500/10 text-violet-400" },
  SNACKS: { icon: ShoppingBasket, tone: "bg-amber-500/10 text-amber-400" },
  NUTS: { icon: Nut, tone: "bg-amber-500/10 text-amber-400" },
};

// Department Reporting §4/§10 — the four daily report states a tile can
// be in. BLUE (not reported) is just the tile's normal resting look, no
// badge needed; YELLOW/GREEN/RED each get a border/background tint AND a
// small corner badge icon, never color alone, so the state reads clearly
// even for a colorblind supervisor glancing at the grid.
const STATUS_STYLE = {
  YELLOW: { border: "border-amber-500/40 hover:border-amber-500/60", bg: "bg-amber-500/[0.07]", badge: "bg-amber-500/20 text-amber-400", icon: Clock3, label: "Pending" },
  GREEN: { border: "border-emerald-500/30 hover:border-emerald-500/50", bg: "bg-emerald-500/[0.06]", badge: "bg-emerald-500/20 text-emerald-400", icon: Check, label: "Approved" },
  RED: { border: "border-red-500/40 hover:border-red-500/60", bg: "bg-red-500/[0.07]", badge: "bg-red-500/20 text-red-400", icon: X, label: "Declined" },
};

// MarketStructureGrid.jsx — the market's eight physical department tiles.
// Since the Department Reporting redesign, this grid IS the department
// reporting board (see DepartmentReportBoard.jsx, its one caller):
// `sectionStatus[key]` is "BLUE" | "YELLOW" | "GREEN" | "RED", derived
// from the real DEPARTMENT_CLOSING Activity each department's assigned
// employee submitted today — never a supervisor-set checkbox. Visual
// layout (2 cols mobile / 4 from tablet up, icon-tile shape) is
// unchanged from before this redesign.
export default function MarketStructureGrid({ sectionStatus, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {MARKET_SECTIONS.map((section) => {
        const status = sectionStatus?.[section.key] ?? "BLUE";
        const style = SECTION_STYLE[section.key];
        const Icon = style.icon;
        const statusStyle = STATUS_STYLE[status];
        const BadgeIcon = statusStyle?.icon;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect?.(section)}
            className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-4 min-h-[92px] text-center transition-colors ${
              statusStyle ? `${statusStyle.bg} ${statusStyle.border}` : "bg-[#171C2E]/80 border-white/[0.06] hover:border-[#F47A20]/25"
            }`}
          >
            {statusStyle && (
              <span className={`absolute top-2 right-2 grid place-items-center h-4 w-4 rounded-full ${statusStyle.badge}`}>
                <BadgeIcon size={11} strokeWidth={3} />
              </span>
            )}
            <span className={`grid place-items-center h-10 w-10 rounded-xl ${style.tone}`}>
              <Icon size={18} />
            </span>
            <span className="text-xs font-semibold text-white">{section.label}</span>
            {statusStyle && <span className={`text-[10px] font-medium ${status === "YELLOW" ? "text-amber-400" : status === "GREEN" ? "text-emerald-400" : "text-red-400"}`}>{statusStyle.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
