import { ChevronRight } from "lucide-react";

// QuickReportRow.jsx — one row in the Activity tab's "Quick Reports"
// list. Purely presentational — every row's onClick opens the exact same
// real flow component (ItemReportFlow/ShelfLabelFlow/
// DepartmentClosingFlow/WastedOverallFlow) WorkerActivityTab already
// used before this redesign, just re-styled as a compact list row
// instead of four separate full-width sections.
export default function QuickReportRow({ icon: Icon, title, subtitle, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-premium w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl hover:border-[#F47A20]/25 active:scale-[0.99] transition-all duration-150"
    >
      <span className="w-10 h-10 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20] glow-orange shrink-0">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <p className="text-sm font-semibold text-white truncate">{title}</p>
        <p className="text-xs text-[#8B93A8] truncate">{subtitle}</p>
      </span>
      {badge > 0 && (
        <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#F47A20] text-white text-[10px] font-bold flex items-center justify-center glow-orange">
          {badge}
        </span>
      )}
      <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
    </button>
  );
}
