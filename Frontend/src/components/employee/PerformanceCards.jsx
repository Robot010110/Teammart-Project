import {
  CheckCircle2, Trash2, Tag, Sparkles, Palette, CalendarCheck, Timer,
} from "lucide-react";

// PerformanceCards.jsx — summary metric cards for the Employee Profile page.

export default function PerformanceCards({ stats, onOpenCompletedTasks }) {
  const items = [
    { icon: CheckCircle2, label: "Completed Tasks", value: stats.completedTasks, onClick: onOpenCompletedTasks },
    { icon: Trash2, label: "Expired Items Removed", value: stats.expiredItemsRemoved },
    { icon: Tag, label: "Labels Checked", value: stats.labelsChecked },
    { icon: Sparkles, label: "Shelves Cleaned", value: stats.shelvesCleaned },
    { icon: Palette, label: "Customizations", value: stats.customizations },
    { icon: CalendarCheck, label: "Attendance", value: `${stats.attendanceRate}%` },
    { icon: Timer, label: "Avg. Completion Time", value: stats.avgCompletionTime },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map(({ icon: Icon, label, value, onClick }, i) => {
        const Wrapper = onClick ? "button" : "div";
        return (
          <Wrapper
            key={label}
            onClick={onClick}
            style={{ animationDelay: `${i * 50}ms` }}
            className={`animate-fade-up text-left rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl hover:border-[#F47A20]/25 transition-all duration-200 ${
              onClick ? "cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]" : ""
            }`}
          >
            <div className="h-9 w-9 rounded-lg bg-[#F47A20]/10 grid place-items-center mb-3">
              <Icon size={16} className="text-[#F47A20]" />
            </div>
            <p className="text-xl font-display font-bold text-white">{value}</p>
            <p className="mt-0.5 text-[11px] text-[#8B93A8] leading-tight">
              {label}
              {onClick && <span className="text-[#F47A20]"> · View history</span>}
            </p>
          </Wrapper>
        );
      })}
    </div>
  );
}
