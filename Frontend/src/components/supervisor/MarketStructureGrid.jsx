import { MARKET_SECTIONS } from "../../data/supervisorMockData";

// MarketStructureGrid.jsx — the market's physical layout, preserving the
// relative row/column placement from the reference architecture (spec
// §17): Drinks/Freezer/Fresh across the front, Food spanning two columns,
// Non-Food 1/2 and Snacks/Nuts behind it. No Children's Items section —
// the current reference doesn't have one (spec §18). Tapping a section
// calls onSelect(section) so this can later grow into per-section
// status/checks/photos/assignments without changing this component's
// shape — see DailySectionChecks.jsx for the first consumer of that.
export default function MarketStructureGrid({ sectionStatus, onSelect }) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "72px" }}
    >
      {MARKET_SECTIONS.map((section) => {
        const status = sectionStatus?.[section.key];
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect?.(section)}
            style={{ gridRow: section.row, gridColumn: `${section.col} / span ${section.span}` }}
            className={`rounded-xl border flex flex-col items-center justify-center gap-1 text-center px-2 transition-colors ${
              status === "checked"
                ? "bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/40"
                : "bg-[#1A1F33]/70 border-white/[0.06] hover:border-[#F47A20]/25"
            }`}
          >
            <span className="text-xs font-semibold text-white">{section.label}</span>
            {status === "checked" && <span className="text-[10px] text-emerald-400">Checked</span>}
          </button>
        );
      })}
    </div>
  );
}
