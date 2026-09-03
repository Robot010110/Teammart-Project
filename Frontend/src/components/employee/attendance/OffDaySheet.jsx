import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X, CalendarOff, CalendarClock, AlertTriangle, Check, Loader2 } from "lucide-react";
import { createLeaveRequest, getOffDayQuota } from "../../../services/leaveRequestService";
import { useAsync } from "../../../hooks/useAsync";
import { ApiError } from "../../../services/apiClient";

// OffDaySheet.jsx — "Attendance -> Calendar -> Tap Date -> Choose Off
// Type", the real create flow for the three calendar-picked off types
// (WEEKLY_OFF / MONTHLY_OFF / EMERGENCY_OFF). PERSONAL_LEAVE and
// EARNED_DAY_OFF are NOT offered here — they're a different, still-real
// workflow with its own review step, reachable from the "More leave
// options" link this page's Off Days section adds (see
// AttendanceSection.jsx) — mixing them into this three-choice sheet
// would misrepresent them as instant/informational when they're not.
//
// Built on the same createPortal + body-scroll-lock + Escape-key
// mechanics Modal.jsx already uses (see that file's own comment on why
// a portal is required — this app's cards use backdrop-blur/transform
// pervasively, which breaks plain `fixed` positioning for any nested
// overlay). Presented as a bottom sheet rather than Modal's centered
// card, per the design brief, so it isn't built on top of Modal itself.
//
// Every rule enforced here — quota, past-date, conflict — is UX only.
// The backend (leaveRequestsController.createCalendarOffDay) re-checks
// every one of them inside its own transaction and is the only thing
// that can actually be trusted; this sheet exists so a doomed request
// never gets a chance to reach the server in the first place.
const OFF_TYPES = [
  {
    type: "WEEKLY_OFF",
    label: "Weekly Off",
    icon: CalendarOff,
    tone: { text: "text-[#F9A03C]", bg: "bg-[#F47A20]/[0.12]", ring: "border-[#F47A20]/30", glow: "shadow-[0_0_14px_-2px_rgba(244,122,32,0.55)]" },
    describe: (q) => `Use your ${q?.weekly?.max ?? 1} weekly off for this week.`,
    unavailable: (q) => (q?.weekly && !q.weekly.available ? "Already used this week." : null),
  },
  {
    type: "MONTHLY_OFF",
    label: "Monthly Off",
    icon: CalendarClock,
    tone: { text: "text-violet-400", bg: "bg-violet-500/[0.12]", ring: "border-violet-500/30", glow: "shadow-[0_0_14px_-2px_rgba(167,139,250,0.55)]" },
    describe: (q) => `Use 1 of ${q?.monthly?.max ?? 2} monthly off days.`,
    unavailable: (q) => (q?.monthly && !q.monthly.available ? "Both monthly off days have already been used." : null),
  },
  {
    type: "EMERGENCY_OFF",
    label: "Emergency Off",
    icon: AlertTriangle,
    tone: { text: "text-[#FF5C5C]", bg: "bg-red-500/[0.12]", ring: "border-red-500/30", glow: "shadow-[0_0_14px_-2px_rgba(255,92,92,0.55)]" },
    describe: () => "For urgent or unexpected situations.",
    // No quota exists for Emergency Off in this app's business rules —
    // deliberately never disabled here, and never labelled "Unlimited"
    // either (see leaveRequestsController.getOffDayQuota's own comment:
    // inventing either claim would be worse than the honest absence of
    // one).
    unavailable: () => null,
  },
];

function formatFullDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function OffDaySheet({ date, onClose, onCreated }) {
  const titleId = useId();
  // "choose" -> "confirm" -> "success"
  const [stage, setStage] = useState("choose");
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);
  // Emergency Off only — the backend now requires a real reason for
  // this type (createLeaveRequestSchema's own refine), since "why" is
  // exactly what an urgent/unexpected absence needs to communicate to
  // the Supervisor. Weekly/Monthly stay reason-free — they're routine.
  const [reason, setReason] = useState("");
  const reasonRequired = selected?.type === "EMERGENCY_OFF";
  const canConfirm = !reasonRequired || reason.trim().length >= 2;

  const isoDate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

  const { data: quota, error: quotaError, loading: quotaLoading } = useAsync(() => getOffDayQuota(isoDate), {
    deps: [isoDate],
    fallbackError: "Could not load your off-day quota.",
  });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createLeaveRequest({
        date: isoDate,
        type: selected.type,
        reason: reasonRequired ? reason.trim() : undefined,
      });
      setResult(created);
      setStage("success");
      onCreated?.(created);
    } catch (err) {
      // Real server messages ("Past dates cannot be selected.", "You
      // already used your weekly off this week.", etc.) are shown
      // verbatim — they already match the wording this flow needs,
      // since the backend is the authoritative source for exactly these
      // rules.
      setSubmitError(err instanceof ApiError ? err.message : "Unable to create your off day. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={stage === "success" ? undefined : onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[24px] bg-[#12172A] border border-white/10 shadow-2xl animate-slide-in sm:animate-modal-in max-h-[88vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        {/* Grab handle — mobile bottom-sheet affordance only. */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <span className="h-1 w-10 rounded-full bg-white/15" />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 sm:pt-5">
          <div>
            <h3 id={titleId} className="font-display text-[17px] font-bold text-white">
              {stage === "success" ? "" : "Choose Off Type"}
            </h3>
            {stage !== "success" && <p className="mt-0.5 text-[12.5px] text-[#9AA1B4]">{formatFullDate(date)}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 h-9 w-9 rounded-full grid place-items-center bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="px-5 pb-6 pt-3">
          {stage === "choose" && (
            <div className="space-y-2.5">
              {quotaError && <p className="text-xs text-red-400 mb-1">{quotaError}</p>}
              {OFF_TYPES.map((t) => {
                const blockedReason = !quotaLoading ? t.unavailable(quota) : null;
                const disabled = quotaLoading || !!blockedReason;
                const Icon = t.icon;
                return (
                  <button
                    key={t.type}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setSelected(t);
                      setStage("confirm");
                    }}
                    className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 ${
                      disabled
                        ? "opacity-40 cursor-not-allowed border-white/[0.06] bg-white/[0.02]"
                        : `${t.tone.ring} bg-white/[0.03] hover:bg-white/[0.06] active:scale-[0.98]`
                    }`}
                  >
                    <span className={`shrink-0 w-10 h-10 rounded-xl grid place-items-center ${t.tone.bg} ${t.tone.text} ${!disabled ? t.tone.glow : ""}`}>
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-white">{t.label}</p>
                      <p className="mt-0.5 text-[12px] text-[#9AA1B4]">
                        {blockedReason ?? t.describe(quota)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {stage === "confirm" && selected && (
            <div className="animate-fade-in">
              <div className={`rounded-2xl border ${selected.tone.ring} bg-white/[0.03] p-5 text-center`}>
                <span className={`mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center ${selected.tone.bg} ${selected.tone.text} ${selected.tone.glow}`}>
                  <selected.icon size={22} strokeWidth={2} />
                </span>
                <p className="font-display text-[18px] font-bold text-white">{selected.label}</p>
                <p className="mt-1 text-[13px] text-[#9AA1B4]">{formatFullDate(date)}</p>
              </div>

              {reasonRequired && (
                <div className="mt-4">
                  <label htmlFor="emergency-off-reason" className="block text-[12.5px] font-medium text-[#9AA1B4] mb-1.5">
                    Reason <span className="text-[#FF5C5C]">*</span>
                  </label>
                  <textarea
                    id="emergency-off-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="What's the urgent or unexpected situation?"
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-[#5C6479] focus:outline-none focus:border-red-500/40 resize-none"
                  />
                  <p className="mt-1 text-[11px] text-[#5C6479]">
                    Required — this is shared with your Supervisor's notification.
                  </p>
                </div>
              )}

              {submitError && (
                <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-red-400">
                  <AlertTriangle size={13} className="shrink-0" /> {submitError}
                </p>
              )}

              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setStage("choose");
                    setSubmitError(null);
                    setReason("");
                  }}
                  disabled={submitting}
                  className="flex-1 rounded-xl px-4 py-3 text-[13.5px] font-semibold text-[#9AA1B4] bg-white/[0.04] hover:bg-white/[0.07] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting || !canConfirm}
                  className="flex-[2] flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13.5px] font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:scale-[0.98] shadow-[0_0_18px_-3px_rgba(244,122,32,0.7)] transition-all disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Confirm
                </button>
              </div>
            </div>
          )}

          {stage === "success" && selected && result && (
            <div className="animate-fade-in text-center py-2">
              <span className={`mx-auto mb-4 w-16 h-16 rounded-full grid place-items-center ${selected.tone.bg} ${selected.tone.text} ${selected.tone.glow}`}>
                <Check size={30} strokeWidth={2.4} />
              </span>
              <p className="font-display text-[19px] font-bold text-white">{selected.label} Added</p>
              <p className="mt-1 text-[13.5px] text-[#9AA1B4]">{formatFullDate(date)}</p>

              {/* Never claims a notification that didn't actually happen
                  — `notified` comes straight from the backend response,
                  which only sets it true after createNotificationForUser
                  genuinely succeeds. Weekly Off never shows this row at
                  all, since no notification is ever sent for it. */}
              {selected.type !== "WEEKLY_OFF" && (
                <p className="mt-3 text-[12.5px] text-[#8B93A8]">
                  {result.notified ? "Notification sent to your supervisor." : "Recorded — your supervisor was not notified."}
                </p>
              )}

              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-xl px-4 py-3 text-[13.5px] font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:scale-[0.98] shadow-[0_0_18px_-3px_rgba(244,122,32,0.7)] transition-all"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
