import { Sunrise, Sunset, Moon, Gift, TrendingUp, AlertTriangle } from "lucide-react";
import AttendanceStatusPill from "../common/AttendanceStatusPill";

// AttendanceCalendar.jsx — one row per day this month that has an
// AttendanceRecord (list view rather than a grid calendar — simpler to
// read on a phone-width Employee workspace, same day-level detail the
// spec asks for). Days with no record yet (not imported) simply don't
// appear, same "only show real data" principle as the rest of this app.

const SHIFT_ICON = { MORNING: Sunrise, EVENING: Sunset, NIGHT: Moon };
const SHIFT_LABEL = { MORNING: "Morning", EVENING: "Evening", NIGHT: "Night" };
const SHIFT_HOURS = 8; // all three company shifts are fixed 8-hour shifts (spec-defined, not a guess)

const dateLabel = (isoString) =>
  new Date(isoString).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeLabel = (isoString) =>
  isoString ? new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";

function AdjustmentCallout({ adjustment }) {
  const isReward = adjustment.type === "REWARD";
  const Icon = isReward ? Gift : TrendingUp;
  const tone = isReward ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" : "text-amber-400 bg-amber-500/5 border-amber-500/15";
  const requiredHours = isReward ? Math.max(SHIFT_HOURS - adjustment.hours, 0) : SHIFT_HOURS + adjustment.hours;

  return (
    <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] ${tone}`}>
      <p className="flex items-center gap-1.5 font-medium">
        <Icon size={11} />
        {isReward ? "Reward Hour Applied" : adjustment.type === "PENALTY" ? "Penalty Hours Applied" : "Extra Hours Applied"}
      </p>
      <p className="mt-1 opacity-90">
        Scheduled Hours: {SHIFT_HOURS} · {isReward ? "Worked Hours Required" : "Extra Hours"}: {isReward ? requiredHours : adjustment.hours}
      </p>
      <p className="opacity-90">Reason: {adjustment.reason}</p>
    </div>
  );
}

export default function AttendanceCalendar({ days }) {
  if (days.length === 0) {
    return (
      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <p className="text-sm text-[#4C5266] text-center py-4">No attendance imported for this month yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {days.map((day) => {
          const ShiftIcon = SHIFT_ICON[day.shift];
          return (
            <div key={day.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-white">{dateLabel(day.date)}</span>
                <AttendanceStatusPill status={day.status} />
              </div>

              {day.status !== "DAY_OFF" && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9AA1B4]">
                  {day.shift && (
                    <span className="flex items-center gap-1">
                      {ShiftIcon && <ShiftIcon size={12} />} {SHIFT_LABEL[day.shift]}
                    </span>
                  )}
                  <span>In {timeLabel(day.checkIn)}</span>
                  <span>Out {timeLabel(day.checkOut)}</span>
                  {day.workingHours != null && <span>{day.workingHours.toFixed(1)}h worked</span>}
                </div>
              )}
              {day.status === "DAY_OFF" && day.dayOffType && (
                <p className="mt-1.5 text-xs text-[#9AA1B4]">{day.dayOffType.charAt(0) + day.dayOffType.slice(1).toLowerCase()} off day</p>
              )}
              {day.status === "ABSENT" && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle size={11} /> No check-in recorded
                </p>
              )}

              {day.adjustments.map((adj) => (
                <AdjustmentCallout key={adj.id} adjustment={adj} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
