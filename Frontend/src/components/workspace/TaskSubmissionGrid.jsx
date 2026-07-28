import {
  Trash2, Sparkles, Palette, ClipboardList, Tag, PackagePlus,
} from "lucide-react";

// TaskSubmissionGrid.jsx — one button per submittable daily-activity
// category. Clicking opens SubmitTaskModal for that category.

const ICONS = {
  EXPIRED_ITEMS: Trash2,
  SHELF_CLEANING: Sparkles,
  PRODUCT_CUSTOMIZATION: Palette,
  DAILY_CLEANING: PackagePlus,
  ITEM_COUNTING: ClipboardList,
  LABEL_CHECKING: Tag,
};

export default function TaskSubmissionGrid({ options, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {options.map((option, i) => {
        const Icon = ICONS[option.category] || Sparkles;
        return (
          <button
            key={option.category}
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => onSelect(option)}
            className="animate-fade-up flex flex-col items-center gap-2 rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.05]
                       transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#F47A20]/35
                       hover:bg-[#1F2436] active:scale-[0.97] cursor-pointer text-center"
          >
            <div className="h-10 w-10 rounded-lg bg-[#F47A20]/10 grid place-items-center">
              <Icon size={18} className="text-[#F47A20]" />
            </div>
            <span className="text-xs font-medium text-white leading-tight">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
