import { CalendarCheck, CalendarOff, Clock3, ListChecks, Zap, AlertTriangle } from "lucide-react";

// TodayOverviewGrid.jsx — the six real monthly metrics from
// GET /api/attendance/month's `summary`, exactly the values
// AttendanceSummaryCards.jsx already displays (that component is left
// untouched — it is shared with Supervisor Mode's
// EmployeeAttendanceScreen.jsx, so this page gets its own presentation
// rather than a modification that would change the supervisor's screen
// too).
//
// Attendance Rate is deliberately NOT one of these tiles here: it gets
// its own ring card below (AttendanceRateRing.jsx), matching the design.
//
// Responsive: 3 columns on a phone (readable down to 360px), 6 across on
// desktop, per the two references' different compositions.

const hours = (v) => `${Number(v ?? 0).toFixed(1)}h`;

const TONES = {
  orange: { text: "text-[#F9A03C]", bg: "bg-[#F47A20]/[0.12]", glow: "shadow-[0_0_12px_-1px_rgba(244,122,32,0.5)]" },
  slate: { text: "text-[#8B93A8]", bg: "bg-white/[0.05]", glow: "" },
  blue: { text: "text-sky-400", bg: "bg-sky-500/[0.12]", glow: "shadow-[0_0_12px_-1px_rgba(56,189,248,0.5)]" },
  violet: { text: "text-violet-400", bg: "bg-violet-500/[0.12]", glow: "shadow-[0_0_12px_-1px_rgba(167,139,250,0.5)]" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/[0.12]", glow: "shadow-[0_0_12px_-1px_rgba(52,211,153,0.5)]" },
  red: { text: "text-[#FF5C5C]", bg: "bg-red-500/[0.12]", glow: "shadow-[0_0_12px_-1px_rgba(255,92,92,0.5)]" },
};

export default function TodayOverviewGrid({ summary }) {
  const items = [
    { icon: CalendarCheck, label: "Working Days", sub: "This Month", value: summary.totalWorkingDays, tone: "orange" },
    { icon: CalendarOff, label: "Days Off", sub: "This Month", value: summary.daysOff, tone: "slate" },
    { icon: Clock3, label: "Total Hours Worked", sub: "This Month", value: hours(summary.totalHoursWorked), tone: "blue" },
    { icon: ListChecks, label: "Total Required Hours", sub: "This Month", value: hours(summary.totalRequiredHours), tone: "orange" },
    {
      icon: Zap,
      label: "Extra Hours",
      sub: "This Month",
      value: hours(summary.extraHours),
      // Only tinted when there actually are extra hours — a flat 0.0h
      // shouldn't read as an achievement.
      tone: summary.extraHours > 0 ? "emerald" : "blue",
    },
    {
      icon: AlertTriangle,
      label: "Punishment Hours",
      sub: "This Month",
      value: hours(summary.punishmentHours),
      tone: summary.punishmentHours > 0 ? "red" : "violet",
    },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
      {items.map(({ icon: Icon, label, sub, value, tone }, i) => {
        const t = TONES[tone];
        return (
          <article
            key={label}
            style={{ animationDelay: `${i * 45}ms` }}
            className="animate-fade-up card-premium rounded-2xl p-2.5 sm:p-3.5 bg-[#0D1223]/80 border border-white/[0.06] shadow-[0_8px_28px_-14px_rgba(0,0,0,0.9)]"
          >
            <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg grid place-items-center ${t.bg} ${t.glow} ${t.text}`}>
              <Icon size={14} strokeWidth={2.1} />
            </span>
            <p className="mt-2 font-display text-[17px] sm:text-[21px] font-bold text-white leading-none tabular-nums">
              {value}
            </p>
            <p className="mt-1.5 text-[10px] sm:text-[11px] leading-tight text-[#8B93A8]">{label}</p>
            <p className="text-[9.5px] sm:text-[10px] leading-tight text-[#4C5266]">{sub}</p>
          </article>
        );
      })}
    </div>
  );
}
