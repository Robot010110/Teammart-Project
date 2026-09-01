import { useState } from "react";
import { CheckCircle2, Clock, Trash2, Loader2, ChevronRight, Sunrise, Sun, Moon } from "lucide-react";
import SubmitCardSalesModal from "./SubmitCardSalesModal";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getCardSalesDay, deleteCardSalesReport } from "../../services/cardSalesService";
import { useAsync } from "../../hooks/useAsync";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Per-shift icon/tone accents — same visual system as MarketStructureGrid's
// department tiles (a colored icon chip on an otherwise neutral card),
// just one accent per shift instead of per department.
const SHIFT_CONFIG = {
  MORNING: { label: "Morning Shift", subtitle: "Submit morning shift sales", icon: Sunrise, tone: "bg-amber-500/10 text-amber-400" },
  AFTERNOON: { label: "Afternoon Shift", subtitle: "Submit afternoon shift sales", icon: Sun, tone: "bg-sky-500/10 text-sky-400" },
  NIGHT: { label: "Night Shift", subtitle: "Submit night shift sales", icon: Moon, tone: "bg-violet-500/10 text-violet-400" },
};

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
  const [deletingId, setDeletingId] = useState(null);

  function handleSaved() {
    setSubmitShift(null);
    reload();
  }

  async function handleDelete(reportId) {
    setDeletingId(reportId);
    try {
      await deleteCardSalesReport(reportId);
      reload();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <SkeletonCard className="h-[180px]" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {["MORNING", "AFTERNOON", "NIGHT"].map((shift) => {
        const slot = data.slots[shift];
        const submitted = slot.status === "SUBMITTED";
        const cfg = SHIFT_CONFIG[shift];
        const Icon = cfg.icon;

        if (submitted) {
          return (
            <div key={shift} className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                <span className={`grid place-items-center h-10 w-10 rounded-xl shrink-0 ${cfg.tone}`}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{cfg.label}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8B93A8]">
                    <Clock size={11} /> {timeLabel(slot.report.submittedAt)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10">
                  <CheckCircle2 size={12} /> Submitted
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(slot.report.id)}
                  disabled={deletingId === slot.report.id}
                  aria-label="Delete report"
                  className="p-1.5 rounded-lg text-[#4C5266] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors shrink-0"
                >
                  {deletingId === slot.report.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          );
        }

        return (
          <button
            key={shift}
            type="button"
            onClick={() => setSubmitShift(shift)}
            className="w-full flex flex-wrap items-center gap-3 rounded-2xl p-4 text-left bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 active:border-[#F47A20]/40 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-[150px]">
              <span className={`grid place-items-center h-10 w-10 rounded-xl shrink-0 ${cfg.tone}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{cfg.label}</p>
                <p className="text-xs text-[#8B93A8] mt-0.5">{cfg.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10">Pending</span>
              <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
            </div>
          </button>
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
