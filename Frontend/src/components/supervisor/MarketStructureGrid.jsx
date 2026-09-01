import { CupSoda, Snowflake, Leaf, UtensilsCrossed, Package, PackageOpen, ShoppingBasket, Nut, Check } from "lucide-react";
import { MARKET_SECTIONS } from "../../data/supervisorMockData";

// Icon/tone per department — purely presentational, keyed off the same
// MARKET_SECTIONS.key values the rest of the app already uses.
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

// MarketStructureGrid.jsx — the market's eight physical department tiles,
// an even responsive grid (2 columns on mobile, 4 from tablet up) rather
// than the earlier row/col physical-layout mapping — the reference design
// this was rebuilt against uses a uniform icon-tile grid, not a floor
// plan. Tapping a section still calls onSelect(section), unchanged.
export default function MarketStructureGrid({ sectionStatus, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {MARKET_SECTIONS.map((section) => {
        const status = sectionStatus?.[section.key];
        const checked = status === "checked";
        const style = SECTION_STYLE[section.key];
        const Icon = style.icon;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect?.(section)}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 min-h-[92px] text-center transition-colors ${
              checked
                ? "bg-emerald-500/[0.06] border-emerald-500/25 hover:border-emerald-500/40"
                : "bg-[#171C2E]/80 border-white/[0.06] hover:border-[#F47A20]/25"
            }`}
          >
            {checked && (
              <span className="absolute top-2 right-2 grid place-items-center h-4 w-4 rounded-full bg-emerald-500/15 text-emerald-400">
                <Check size={11} strokeWidth={3} />
              </span>
            )}
            <span className={`grid place-items-center h-10 w-10 rounded-xl ${style.tone}`}>
              <Icon size={18} />
            </span>
            <span className="text-xs font-semibold text-white">{section.label}</span>
          </button>
        );
      })}
    </div>
  );
}
