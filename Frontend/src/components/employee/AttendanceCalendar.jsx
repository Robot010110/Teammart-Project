import { Sunrise, Sunset, Moon, SlidersHorizontal, AlertTriangle, MinusCircle } from "lucide-react";
import AttendanceStatusPill from "../common/AttendanceStatusPill";

// AttendanceCalendar.jsx — one row per day this month that has an
// AttendanceRecord (list view rather than a grid calendar — simpler to
// read on a phone-width Employee workspace, same day-level detail the
// spec asks for). Days with no record yet (not imported) simply don't
// appear, same "only show real data" principle as the rest of this app.

const SHIFT_ICON = { MORNING: Sunrise, EVENING: Sunset, NIGHT: Moon };
const SHIFT_LABEL = { MORNING: "Morning", EVENING: "Evening", NIGHT: "Night" };
const OFF_STATUSES = ["DAY_OFF", "APPROVED_LEAVE"];

const dateLabel = (isoString) =>
  new Date(isoString).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeLabel = (isoString) =>
  isoString ? new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";

// One RequiredHoursAdjustment for the day — a direct override (previous
// -> new required hours), not a +/- delta, so there's a single
// informational tone rather than a reward/penalty color split.
function AdjustmentCallout({ adjustment }) {
  return (
    <div className="mt-2 rounded-lg border px-2.5 py-2 text-[11px] text-[#F47A20] bg-[#F47A20]/5 border-[#F47A20]/15">
      <p className="flex items-center gap-1.5 font-medium">
        <SlidersHorizontal size={11} /> Required Hours Adjusted
      </p>
      <p className="mt-1 opacity-90">
        {adjustment.previousRequiredHours}h → {adjustment.newRequiredHours}h
      </p>
      <p className="opacity-90">Reason: {adjustment.reason}</p>
    </div>
  );
}

// A day's penalty hours — same treatment as AdjustmentCallout above (the
// reward/extra side), so a penalty's reason is exactly as visible to the
// employee as an adjustment's reason is. Previously the reason was
// entered by the supervisor but only ever written to the backend audit
// log, never returned to the employee — this is the fix for that.
function PenaltyCallout({ hours, reason }) {
  return (
    <div className="mt-2 rounded-lg border px-2.5 py-2 text-[11px] text-red-400 bg-red-500/5 border-red-500/15">
      <p className="flex items-center gap-1.5 font-medium">
        <MinusCircle size={11} /> Penalty: -{hours.toFixed(1)}h
      </p>
      {reason && <p className="mt-1 opacity-90">Reason: {reason}</p>}
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
          const isOff = OFF_STATUSES.includes(day.status);
          return (
            <div key={day.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-white">{dateLabel(day.date)}</span>
                <AttendanceStatusPill status={day.status} />
              </div>

              {!isOff && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9AA1B4]">
                  {day.shift && (
                    <span className="flex items-center gap-1">
                      {ShiftIcon && <ShiftIcon size={12} />} {SHIFT_LABEL[day.shift]}
                    </span>
                  )}
                  <span>In {timeLabel(day.checkIn)}</span>
                  <span>Out {timeLabel(day.checkOut)}</span>
                  {day.workingHours != null && <span>{day.workingHours.toFixed(1)}h worked</span>}
                  <span>{day.requiredHours}h required</span>
                  {day.extraHours > 0 && <span className="text-emerald-400">+{day.extraHours.toFixed(1)}h extra</span>}
                  {day.punishmentHours > 0 && <span className="text-red-400">-{day.punishmentHours.toFixed(1)}h penalty</span>}
                </div>
              )}
              {day.status === "DAY_OFF" && day.dayOffType && (
                <p className="mt-1.5 text-xs text-[#9AA1B4]">{day.dayOffType.charAt(0) + day.dayOffType.slice(1).toLowerCase()} off day</p>
              )}
              {day.status === "APPROVED_LEAVE" && (
                <p className="mt-1.5 text-xs text-[#9AA1B4]">Approved leave</p>
              )}
              {day.status === "ABSENT" && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle size={11} /> No check-in recorded
                </p>
              )}
              {(day.status === "INCOMPLETE" || day.status === "PENDING_REVIEW") && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle size={11} /> {day.status === "INCOMPLETE" ? "Missing check-in or check-out" : "Awaiting supervisor review"}
                </p>
              )}

              {day.adjustments.map((adj) => (
                <AdjustmentCallout key={adj.id} adjustment={adj} />
              ))}
              {day.punishmentHours > 0 && (
                <PenaltyCallout hours={day.punishmentHours} reason={day.punishmentReason} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
