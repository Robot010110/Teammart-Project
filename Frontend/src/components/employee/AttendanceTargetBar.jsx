import { Target, TrendingUp } from "lucide-react";

// AttendanceTargetBar.jsx — required vs. worked hours for the month, plus
// remaining/overtime. requiredMonthlyHours is nullable (no Supervisor has
// set it yet for this employee) — shown honestly as "not set" rather than
// assuming a default like 160, which the spec explicitly said not to do.

export default function AttendanceTargetBar({ summary }) {
  const { month, requiredMonthlyHours, remainingHours, overtimeHours } = summary;

  if (requiredMonthlyHours == null) {
    return (
      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <div className="flex items-center gap-2 text-sm text-[#9AA1B4]">
          <Target size={14} /> Monthly target not set yet.
        </div>
      </div>
    );
  }

  const pct = Math.min((month.hours / requiredMonthlyHours) * 100, 100);

  return (
    <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center justify-between text-xs text-[#9AA1B4] mb-2">
        <span className="flex items-center gap-1.5"><Target size={13} /> Monthly Target</span>
        <span>{month.hours.toFixed(1)}h / {requiredMonthlyHours}h</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#F47A20] to-[#ff8b36] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2.5 flex items-center gap-4 text-xs text-[#9AA1B4]">
        {overtimeHours > 0 ? (
          <span className="flex items-center gap-1 text-emerald-400">
            <TrendingUp size={12} /> {overtimeHours.toFixed(1)}h overtime
          </span>
        ) : (
          <span>{remainingHours.toFixed(1)}h remaining to reach target</span>
        )}
      </div>
    </div>
  );
}
