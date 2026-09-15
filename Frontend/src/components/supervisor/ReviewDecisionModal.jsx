import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, PencilLine, X } from "lucide-react";
import Modal from "../common/Modal";
import { ApiError } from "../../services/apiClient";
import { submitWorkReview } from "../../services/workReviewService";

// ReviewDecisionModal.jsx — the Supervisor's judgement on one piece of work.
//
// Three outcomes, replacing the old Approve/Reject pair:
//
//   Approve                   the work was right
//   Approve with Correction   accepted, but it needed fixing — Minor,
//                             Moderate or Major
//   Reject                    not accepted — Minor, Serious or Invalid,
//                             always with a written reason
//
// The supervisor judges the WORK. They never enter a score, and this modal
// has no field capable of expressing one: the point value each level is
// worth is decided server-side by the scoring profile, and the API rejects
// any request that tries to supply one. That is deliberate — it is what
// makes "the Supervisor judges the work, AION calculates the performance"
// true in the code rather than just in the design doc.
//
// The point values behind these levels are intentionally NOT shown here
// either. They are management-internal, and a supervisor picking "how bad
// was it" should be thinking about the work, not about arithmetic.

const CORRECTION_LEVELS = [
  { key: "MINOR", label: "sup.correctionMinor", blurb: "sup.correctionMinorBlurb" },
  { key: "MODERATE", label: "sup.correctionModerate", blurb: "sup.correctionModerateBlurb" },
  { key: "MAJOR", label: "sup.correctionMajor", blurb: "sup.correctionMajorBlurb" },
];

const REJECTION_LEVELS = [
  { key: "MINOR", label: "sup.rejectionMinor", blurb: "sup.rejectionMinorBlurb" },
  { key: "MODERATE", label: "sup.rejectionSerious", blurb: "sup.rejectionSeriousBlurb" },
  { key: "MAJOR", label: "sup.rejectionInvalid", blurb: "sup.rejectionInvalidBlurb" },
];

const OUTCOMES = [
  { key: "APPROVED", label: "sup.approve", icon: Check, tone: "emerald" },
  { key: "APPROVED_WITH_CORRECTION", label: "sup.approveWithCorrection", icon: PencilLine, tone: "amber" },
  { key: "REJECTED", label: "sup.reject", icon: X, tone: "red" },
];

// Matches the inline helper AdminEmployeeActionsPanel already uses for
// the same job — kept local rather than promoted to a shared component
// for two one-line call sites.
function ErrorText({ error }) {
  if (!error) return null;
  return <p className="text-xs text-red-400">{error}</p>;
}

const TONES = {
  emerald: { on: "bg-emerald-500/[0.18] border-emerald-500/50 text-emerald-300", off: "border-white/[0.08] text-[#8B93A8]" },
  amber: { on: "bg-amber-500/[0.18] border-amber-500/50 text-amber-300", off: "border-white/[0.08] text-[#8B93A8]" },
  red: { on: "bg-red-500/[0.18] border-red-500/50 text-[#FF8080]", off: "border-white/[0.08] text-[#8B93A8]" },
};

export default function ReviewDecisionModal({ item, onClose, onDone }) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const needsSeverity = outcome === "APPROVED_WITH_CORRECTION" || outcome === "REJECTED";
  const needsReason = outcome === "REJECTED";
  const levels = outcome === "REJECTED" ? REJECTION_LEVELS : CORRECTION_LEVELS;

  const canSubmit =
    !!outcome &&
    (!needsSeverity || !!severity) &&
    (!needsReason || reason.trim().length > 0);

  function pickOutcome(key) {
    setOutcome(key);
    // A level chosen for a correction does not carry over to a rejection —
    // they mean different things, and reusing the selection silently would
    // record a judgement the supervisor never actually made.
    setSeverity(null);
    setError(null);
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await submitWorkReview({
        targetType: item.targetType,
        targetId: item.targetId,
        outcome,
        severity: needsSeverity ? severity : null,
        reason: reason.trim() || null,
      });
      onDone?.(item, outcome);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("sup.couldNotSaveReview"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("sup.reviewWork")}>
      <div className="space-y-4">
        <div className="rounded-xl p-3 bg-white/[0.04] border border-white/[0.06]">
          <p className="text-[12px] font-semibold text-white">{item.label}</p>
          <p className="mt-0.5 text-[11px] text-[#8B93A8]">
            {item.employeeName ?? item.employeeId} · {item.workCategory?.replace(/_/g, " ").toLowerCase()}
          </p>
        </div>

        {/* Outcome */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("sup.decision")}</label>
          <div className="grid grid-cols-1 gap-1.5">
            {OUTCOMES.map((option) => {
              const Icon = option.icon;
              const active = outcome === option.key;
              const tone = TONES[option.tone];
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => pickOutcome(option.key)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold border transition-colors ${
                    active ? tone.on : `bg-white/[0.03] ${tone.off}`
                  }`}
                >
                  <Icon size={15} />
                  {t(option.label)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Level — the 6/4/2 correction selector, and the rejection
            severity. The numbers themselves stay server-side. */}
        {needsSeverity && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">
              {outcome === "REJECTED" ? t("sup.rejectionLevel") : t("sup.correctionLevel")}
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {levels.map((level) => {
                const active = severity === level.key;
                return (
                  <button
                    key={level.key}
                    type="button"
                    onClick={() => setSeverity(level.key)}
                    className={`text-left rounded-xl px-3 py-2 border transition-colors ${
                      active
                        ? "bg-[#F47A20]/[0.16] border-[#F47A20]/50"
                        : "bg-white/[0.03] border-white/[0.08]"
                    }`}
                  >
                    <p className={`text-[12.5px] font-semibold ${active ? "text-white" : "text-[#C7CDDB]"}`}>
                      {t(level.label)}
                    </p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-[#8B93A8]">{t(level.blurb)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Reason — required for a rejection, optional (but useful) for a
            correction. This is the ONLY part of the decision the employee
            will read, so the placeholder nudges toward something actionable. */}
        {outcome && outcome !== "APPROVED" && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">
              {needsReason ? t("sup.reasonRequired") : t("sup.noteOptional")}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t("sup.reasonPlaceholder")}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
            />
            <p className="mt-1 text-[10.5px] text-[#5C6479]">{t("sup.reasonVisibleToEmployee")}</p>
          </div>
        )}

        <ErrorText error={error} />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || busy}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-40 transition-colors"
        >
          {busy ? t("emp.saving") : t("sup.saveDecision")}
        </button>
      </div>
    </Modal>
  );
}
