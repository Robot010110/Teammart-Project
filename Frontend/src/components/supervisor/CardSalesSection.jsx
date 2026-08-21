import { useState } from "react";
import { CreditCard, CheckCircle2, Clock, Camera } from "lucide-react";
import SubmitCardSalesModal from "./SubmitCardSalesModal";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getCardSalesDay } from "../../services/cardSalesService";
import { useAsync } from "../../hooks/useAsync";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const SHIFT_LABEL = { MORNING: "Morning", AFTERNOON: "Afternoon", NIGHT: "Night" };

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// CardSalesSection.jsx — spec §6-8, the Supervisor/Overlooking side:
// today's three reporting periods (Morning/Afternoon/Night), each
// Submitted or Pending, real data from GET /api/card-sales/day. Tapping
// a pending shift opens the submit flow pre-selected to that shift.
export default function CardSalesSection({ marketId }) {
  const { data, error, loading, reload } = useAsync(() => getCardSalesDay(marketId, todayIso()), { deps: [marketId] });
  const [submitShift, setSubmitShift] = useState(null); // shift key | null

  function handleSaved() {
    setSubmitShift(null);
    reload();
  }

  if (loading) return <SkeletonCard className="h-[180px]" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  return (
    <div className="space-y-2">
      {["MORNING", "AFTERNOON", "NIGHT"].map((shift) => {
        const slot = data.slots[shift];
        const submitted = slot.status === "SUBMITTED";
        return (
          <div key={shift} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <CreditCard size={14} className="text-[#F47A20]" /> {SHIFT_LABEL[shift]}
              </span>
              {submitted ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                  <CheckCircle2 size={13} /> Submitted
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setSubmitShift(shift)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
                >
                  <Camera size={12} /> Submit
                </button>
              )}
            </div>
            {submitted && (
              <div className="mt-2 flex items-center gap-3 text-xs text-[#8B93A8]">
                <span>{slot.report.submittedBy?.name}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {timeLabel(slot.report.submittedAt)}</span>
              </div>
            )}
            {!submitted && <p className="mt-1 text-xs text-[#4C5266]">Pending</p>}
          </div>
        );
      })}

      <SubmitCardSalesModal
        key={submitShift}
        open={!!submitShift}
        defaultShift={submitShift}
        onClose={() => setSubmitShift(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
