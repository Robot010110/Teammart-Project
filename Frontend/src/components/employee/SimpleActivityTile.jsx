import { Sparkles, Palette, ClipboardList, Tag, PackagePlus } from "lucide-react";

// SimpleActivityTile.jsx — one cube/tile for a category whose submission
// is just the generic notes+photo form (SubmitTaskModal), same visual
// markup as TaskSubmissionGrid's buttons — extracted so
// WorkerActivityTab.jsx can render these interleaved with
// DailyStatusTile.jsx (Cleaning Shelves/Facing/Refilling) in ONE grid
// instead of two separate grid containers, per the Activity-page
// unification. TaskSubmissionGrid.jsx itself is left unchanged (still
// used as a self-contained grid wherever a caller wants exactly that).

const ICONS = {
  SHELF_CLEANING: Sparkles,
  PRODUCT_CUSTOMIZATION: Palette,
  DAILY_CLEANING: PackagePlus,
  ITEM_COUNTING: ClipboardList,
  LABEL_CHECKING: Tag,
};

export default function SimpleActivityTile({ option, onSelect }) {
  const Icon = ICONS[option.category] || Sparkles;
  return (
    <button
      onClick={() => onSelect(option)}
      className="flex flex-col items-center gap-2 rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.05]
                 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#F47A20]/35
                 hover:bg-[#1F2436] active:scale-[0.97] cursor-pointer text-center"
    >
      <div className="h-10 w-10 rounded-lg bg-[#F47A20]/10 grid place-items-center">
        <Icon size={18} className="text-[#F47A20]" />
      </div>
      <span className="text-xs font-medium text-white leading-tight">{option.label}</span>
    </button>
  );
}
