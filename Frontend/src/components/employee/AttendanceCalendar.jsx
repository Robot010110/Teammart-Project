import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sunrise, Sunset, Moon, SlidersHorizontal, AlertTriangle, MinusCircle, Trash2, Loader2 } from "lucide-react";
import AttendanceStatusPill from "../common/AttendanceStatusPill";
import { deleteMyRequiredHoursAdjustment, deleteMyPunishment } from "../../services/attendanceService";
import { ApiError } from "../../services/apiClient";

// AttendanceCalendar.jsx — one row per day this month that has an
// AttendanceRecord (list view rather than a grid calendar — simpler to
// read on a phone-width Employee workspace, same day-level detail the
// spec asks for). Days with no record yet (not imported) simply don't
// appear, same "only show real data" principle as the rest of this app.

const SHIFT_ICON = { MORNING: Sunrise, EVENING: Sunset, NIGHT: Moon };
const SHIFT_LABEL = { MORNING: "emp.morning", EVENING: "emp.evening", NIGHT: "emp.night" };
const OFF_STATUSES = ["DAY_OFF", "APPROVED_LEAVE"];
const MANUAL_CLEAR_AFTER_DAYS = 14;

const dateLabel = (isoString) =>
  new Date(isoString).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeLabel = (isoString) =>
  isoString ? new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
const daysSince = (isoString) => (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24);

// One RequiredHoursAdjustment for the day — a direct override (previous
// -> new required hours), not a +/- delta, so there's a single
// informational tone rather than a reward/penalty color split.
//
// onDismiss — only supplied by the employee's own AttendanceSection (see
// AttendanceCalendar's own onChanged prop below); Supervisor Mode's
// EmployeeAttendanceScreen renders this same component without it, so
// the dismiss button never appears there — a staff member manages an
// employee's adjustments through the existing admin forms, not this
// employee-only self-service delete.
function AdjustmentCallout({ adjustment, onDismiss, busy }) {
  const { t } = useTranslation();
  const canDismiss = onDismiss && daysSince(adjustment.date) >= MANUAL_CLEAR_AFTER_DAYS;
  return (
    <div className="mt-2 rounded-lg border px-2.5 py-2 text-[11px] text-[#F47A20] bg-[#F47A20]/5 border-[#F47A20]/15">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <SlidersHorizontal size={11} /> {t("emp.requiredHoursAdjusted")}
        </p>
        {canDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(adjustment)}
            disabled={busy}
            aria-label={t("emp.dismiss")}
            className="shrink-0 p-1 -m-1 rounded text-[#F47A20]/70 hover:text-red-400 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          </button>
        )}
      </div>
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
function PenaltyCallout({ hours, reason, onDismiss, busy, dismissable }) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 rounded-lg border px-2.5 py-2 text-[11px] text-red-400 bg-red-500/5 border-red-500/15">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <MinusCircle size={11} /> Penalty: -{hours.toFixed(1)}h
        </p>
        {onDismiss && dismissable && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            aria-label={t("emp.dismiss")}
            className="shrink-0 p-1 -m-1 rounded text-red-400/70 hover:text-red-400 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          </button>
        )}
      </div>
      {reason && <p className="mt-1 opacity-90">Reason: {reason}</p>}
    </div>
  );
}

// onChanged — optional; only the employee's own AttendanceSection passes
// it, enabling self-service dismiss buttons on already-old (see
// MANUAL_CLEAR_AFTER_DAYS) adjustments/penalties and reloading the month
// on success. Supervisor Mode's EmployeeAttendanceScreen renders this
// same component read-only, unaffected.
export default function AttendanceCalendar({ days, onChanged }) {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function handleDismissAdjustment(adjustment) {
    setBusyId(adjustment.id);
    setActionError(null);
    try {
      await deleteMyRequiredHoursAdjustment(adjustment.id);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("emp.couldNotDismissThis"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismissPenalty(day) {
    setBusyId(day.id);
    setActionError(null);
    try {
      await deleteMyPunishment(day.id);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("emp.couldNotDismissThis"));
    } finally {
      setBusyId(null);
    }
  }

  if (days.length === 0) {
    return (
      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <p className="text-sm text-[#4C5266] text-center py-4">{t("emp.noAttendanceImportedForThisMonth")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      {actionError && <p className="mb-2.5 text-xs text-red-400">{actionError}</p>}
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pe-1">
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
                      {ShiftIcon && <ShiftIcon size={12} />} {SHIFT_LABEL[day.shift] ? t(SHIFT_LABEL[day.shift]) : day.shift}
                    </span>
                  )}
                  <span>{t("emp.checkedInAtTime", { time: timeLabel(day.checkIn) })}</span>
                  <span>{t("emp.checkedOutAtTime", { time: timeLabel(day.checkOut) })}</span>
                  {day.workingHours != null && <span>{t("emp.hoursWorkedSuffix", { hours: day.workingHours.toFixed(1) })}</span>}
                  <span>{t("emp.hoursRequiredSuffix", { hours: day.requiredHours })}</span>
                  {day.extraHours > 0 && <span className="text-emerald-400">+{t("emp.hoursExtraSuffix", { hours: day.extraHours.toFixed(1) })}</span>}
                  {day.punishmentHours > 0 && <span className="text-red-400">-{t("emp.hoursPenaltySuffix", { hours: day.punishmentHours.toFixed(1) })}</span>}
                  {/* Attendance + Shift Timing §11 — the separately-visible
                      breakdown behind the two numbers above: exactly how
                      late, how much of the post-shift time was penalty
                      recovery vs. genuinely extra, and any break overrun.
                      Every value comes straight from day.timing (see
                      attendanceController.buildMonthResponse), never
                      recomputed here. */}
                  {day.timing?.lateMinutes > 0 && (
                    <span className="text-amber-400">{t("emp.lateByMinutes", { minutes: day.timing.lateMinutes })}</span>
                  )}
                  {day.timing?.penaltyRecoveryHours > 0 && (
                    <span className="text-[#F9A03C]">{t("emp.penaltyRecoverySuffix", { hours: day.timing.penaltyRecoveryHours.toFixed(1) })}</span>
                  )}
                  {day.timing?.breakOverrunMinutes > 0 && (
                    <span className="text-red-400">{t("emp.breakOverrunSuffix", { minutes: day.timing.breakOverrunMinutes })}</span>
                  )}
                </div>
              )}
              {day.status === "DAY_OFF" && day.dayOffType && (
                <p className="mt-1.5 text-xs text-[#9AA1B4]">{day.dayOffType.charAt(0) + day.dayOffType.slice(1).toLowerCase()} off day</p>
              )}
              {day.status === "APPROVED_LEAVE" && (
                <p className="mt-1.5 text-xs text-[#9AA1B4]">{t("emp.approvedLeave")}</p>
              )}
              {day.status === "ABSENT" && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle size={11} /> {t("emp.noCheckInRecorded")}
                </p>
              )}
              {(day.status === "INCOMPLETE" || day.status === "PENDING_REVIEW") && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle size={11} /> {day.status === "INCOMPLETE" ? t("emp.missingCheckInOrCheckOut") : t("emp.awaitingSupervisorReview")}
                </p>
              )}

              {day.adjustments.map((adj) => (
                <AdjustmentCallout
                  key={adj.id}
                  adjustment={adj}
                  onDismiss={onChanged ? handleDismissAdjustment : undefined}
                  busy={busyId === adj.id}
                />
              ))}
              {day.punishmentHours > 0 && (
                <PenaltyCallout
                  hours={day.punishmentHours}
                  reason={day.punishmentReason}
                  dismissable={daysSince(day.date) >= MANUAL_CLEAR_AFTER_DAYS}
                  onDismiss={onChanged ? () => handleDismissPenalty(day) : undefined}
                  busy={busyId === day.id}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
