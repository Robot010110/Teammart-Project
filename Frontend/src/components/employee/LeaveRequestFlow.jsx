import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Zap } from "lucide-react";
import Modal from "../common/Modal";
import { createLeaveRequest } from "../../services/leaveRequestService";
import { getExtraHoursBalance } from "../../services/attendanceService";
import { ApiError } from "../../services/apiClient";

// LeaveRequestFlow.jsx — submit an Off Day / Leave request. Monthly Off
// doesn't need a reason (it's the employee's regular scheduled day off);
// Personal Leave requires a written reason; Earned Day Off spends the
// employee's extra-hours balance (see attendanceController's
// computeExtraHoursBalance) at a fixed 8h-per-day exchange rate, shown
// here so the Worker can see whether they have enough before submitting
// — the authoritative check happens server-side at both request and
// (again, authoritatively) approval time.

const EXTRA_HOURS_PER_DAY_OFF = 8;

const TYPES = [
  { value: "MONTHLY_OFF", label: "Monthly Off Day" },
  { value: "PERSONAL_LEAVE", label: "Personal Leave" },
  { value: "EARNED_DAY_OFF", label: "Earned Day Off" },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LeaveRequestFlow({ open, onClose, onSaved }) {
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState("MONTHLY_OFF");
  const [reason, setReason] = useState("");
  const [reasonInvalid, setReasonInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBalanceLoading(true);
    getExtraHoursBalance()
      .then((res) => setBalance(res.balanceHours))
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [open]);

  const hasEnoughBalance = balance != null && balance >= EXTRA_HOURS_PER_DAY_OFF;

  const reset = () => {
    setDate(todayIso());
    setType("MONTHLY_OFF");
    setReason("");
    setReasonInvalid(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (type === "PERSONAL_LEAVE" && !reason.trim()) {
      setReasonInvalid(true);
      setError("A reason is required for Personal Leave.");
      return;
    }
    if (type === "EARNED_DAY_OFF" && !hasEnoughBalance) {
      setError(`You need ${EXTRA_HOURS_PER_DAY_OFF}h of extra work hours to request a day off.`);
      return;
    }
    setReasonInvalid(false);
    setSubmitting(true);
    setError(null);
    try {
      const request = await createLeaveRequest({
        date,
        type,
        reason: type === "PERSONAL_LEAVE" ? reason.trim() : undefined,
      });
      onSaved(request, "Leave request submitted.");
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit this request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Request Off Day / Leave">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white outline-none focus:border-[#F47A20]/50 transition-colors duration-200"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Request Type</label>
          <div className="flex flex-col sm:flex-row gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`flex-1 rounded-lg py-3 text-sm font-medium transition-colors duration-150 ${
                  type === t.value ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] active:bg-white/[0.09]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {type === "EARNED_DAY_OFF" && (
          <div className="rounded-lg p-3.5 bg-white/[0.04] border border-white/[0.06] space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-[#8B93A8]">
                <Zap size={13} /> Available
              </span>
              <span className="font-semibold text-white">
                {balanceLoading ? "…" : balance == null ? "—" : `${balance}h`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#8B93A8]">Required</span>
              <span className="font-semibold text-white">{EXTRA_HOURS_PER_DAY_OFF}h</span>
            </div>
            {!balanceLoading && balance != null && !hasEnoughBalance && (
              <p className="text-xs text-amber-400 pt-1">Not enough extra hours yet for a full day off.</p>
            )}
          </div>
        )}

        {type === "PERSONAL_LEAVE" && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setReasonInvalid(false); }}
              rows={3}
              placeholder="e.g. Illness, family emergency, personal appointment..."
              aria-invalid={reasonInvalid}
              className={`w-full rounded-lg bg-white/[0.04] border px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none transition-colors duration-200 resize-none ${
                reasonInvalid ? "border-red-500/60 focus:border-red-500/60" : "border-white/[0.06] focus:border-[#F47A20]/50"
              }`}
            />
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || (type === "EARNED_DAY_OFF" && !hasEnoughBalance)}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </Modal>
  );
}
