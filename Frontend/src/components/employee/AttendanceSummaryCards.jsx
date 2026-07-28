import { Sun, CalendarRange, CalendarDays } from "lucide-react";

// AttendanceSummaryCards.jsx — Today / This Week / This Month worked
// hours. Same stat-tile shell as PerformanceCards.jsx (icon chip, big
// value, small label) rather than inventing a new tile pattern.

const formatHours = (hours) => `${Number(hours).toFixed(1)}h`;

export default function AttendanceSummaryCards({ summary }) {
  const items = [
    { icon: Sun, label: "Today", value: formatHours(summary.today.hours) },
    { icon: CalendarRange, label: "This Week", value: formatHours(summary.week.hours) },
    { icon: CalendarDays, label: "This Month", value: formatHours(summary.month.hours) },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ icon: Icon, label, value }, i) => (
        <div
          key={label}
          style={{ animationDelay: `${i * 50}ms` }}
          className="animate-fade-up rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl"
        >
          <div className="h-9 w-9 rounded-lg bg-[#F47A20]/10 grid place-items-center mb-3">
            <Icon size={16} className="text-[#F47A20]" />
          </div>
          <p className="text-xl font-display font-bold text-white">{value}</p>
          <p className="mt-0.5 text-[11px] text-[#8B93A8] leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}
