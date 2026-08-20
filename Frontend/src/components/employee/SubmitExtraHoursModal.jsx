import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import Modal from "../common/Modal";
import { submitExtraHours } from "../../services/attendanceService";
import { ApiError } from "../../services/apiClient";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// SubmitExtraHoursModal.jsx — spec §10: an employee reports extra hours
// worked on a specific date. Always created PENDING (see
// attendanceController.submitExtraHours) — never treated as officially
// approved just because it was submitted; the Supervisor still has to
// review it (spec §11), and this is never connected to performance
// (spec §15).
export default function SubmitExtraHoursModal({ onClose, onSubmitted }) {
  const [date, setDate] = useState(todayIso());
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    const hoursNum = Number(hours);
    if (!date) {
      setError("Select a date.");
      return;
    }
    if (!hoursNum || hoursNum <= 0 || hoursNum > 12) {
      setError("Enter a number of hours between 0 and 12.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const request = await submitExtraHours({ date, hours: hoursNum, reason: reason.trim() || undefined });
      onSubmitted(request);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit these extra hours.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Submit Extra Hours">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white outline-none focus:border-[#F47A20]/50"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Extra Hours</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="12"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="e.g. 3"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Covered the closing shift"
            className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <p className="text-[11px] text-[#8B93A8]">
          This will be sent to your Supervisor for review. It is not counted as approved until they confirm it.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
