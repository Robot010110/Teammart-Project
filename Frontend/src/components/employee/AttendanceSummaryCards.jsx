import { CalendarCheck, CalendarOff, Clock3, Gift, TrendingUp, Gauge } from "lucide-react";

// AttendanceSummaryCards.jsx — the Monthly Attendance Summary tiles:
// Working Days, Days Off, Total Hours Worked, Reward Hours, Extra Hours,
// and Attendance Rate. Same stat-tile shell as PerformanceCards.jsx
// (icon chip, big value, small label).
//
// Attendance Rate thresholds per spec: 100 = perfect, 98-99 = excellent,
// 95-97 = acceptable, below 95 = flagged for supervisor review. Reuses
// the same "color communicates severity" convention as every pill in
// this app rather than inventing a new one.
function rateTone(rate) {
  if (rate == null) return "text-[#9AA1B4]";
  if (rate >= 98) return "text-emerald-400";
  if (rate >= 95) return "text-amber-400";
  return "text-red-400";
}

const formatHours = (hours) => `${Number(hours).toFixed(1)}h`;

export default function AttendanceSummaryCards({ summary }) {
  const { totalWorkingDays, daysOff, totalHoursWorked, rewardHours, extraHours, attendanceRate } = summary;

  const items = [
    { icon: CalendarCheck, label: "Working Days", value: totalWorkingDays },
    { icon: CalendarOff, label: "Days Off", value: daysOff },
    { icon: Clock3, label: "Total Hours Worked", value: formatHours(totalHoursWorked) },
    { icon: Gift, label: "Reward Hours", value: formatHours(rewardHours) },
    { icon: TrendingUp, label: "Extra Hours", value: formatHours(extraHours) },
    {
      icon: Gauge,
      label: "Attendance Rate",
      value: attendanceRate == null ? "—" : `${attendanceRate.toFixed(1)}%`,
      valueClass: rateTone(attendanceRate),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(({ icon: Icon, label, value, valueClass }, i) => (
        <div
          key={label}
          style={{ animationDelay: `${i * 50}ms` }}
          className="animate-fade-up rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl"
        >
          <div className="h-9 w-9 rounded-lg bg-[#F47A20]/10 grid place-items-center mb-3">
            <Icon size={16} className="text-[#F47A20]" />
          </div>
          <p className={`text-xl font-display font-bold ${valueClass || "text-white"}`}>{value}</p>
          <p className="mt-0.5 text-[11px] text-[#8B93A8] leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}
