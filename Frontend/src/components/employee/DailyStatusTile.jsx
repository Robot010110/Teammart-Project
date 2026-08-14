import { useState } from "react";
import { Play, CheckCircle2, Loader2 } from "lucide-react";
import Modal from "../common/Modal";
import { useTodaysActivityStatus } from "../../hooks/useTodaysActivityStatus";

const STATUS_DOT_TONE = {
  NOT_STARTED: "bg-[#4C5266]",
  IN_PROGRESS: "bg-amber-400",
  COMPLETED: "bg-emerald-400",
};
const STATUS_LABEL = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };
const STATUS_BADGE_TONE = {
  NOT_STARTED: "bg-white/5 text-[#9AA1B4] ring-white/10",
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
};

// DailyStatusTile.jsx — Cleaning Shelves/Facing/Refilling, now rendered
// as the same cube/tile as the rest of "Other Daily Activities"
// (TaskSubmissionGrid's visual language) instead of their own large
// full-width cards, per the Activity-page unification. The tile itself
// still surfaces the day's status (a colored dot — gray/amber/emerald
// for Not Started/In Progress/Completed) so that state isn't lost, just
// made compact; tapping opens a small modal with the exact same Start /
// Mark Complete action the old full-width card had (business logic is
// unchanged — see useTodaysActivityStatus.js, extracted from the old
// DailyStatusFlow.jsx so tile and modal share one fetch instead of two).
export default function DailyStatusTile({ category, label, icon: Icon, description }) {
  const { status, loading, error, actionError, busy, start, complete } = useTodaysActivityStatus(category);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="relative flex flex-col items-center gap-2 rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.05]
                   transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#F47A20]/35
                   hover:bg-[#1F2436] active:scale-[0.97] cursor-pointer text-center disabled:opacity-60"
      >
        <span className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${loading ? "bg-[#4C5266]" : STATUS_DOT_TONE[status]}`} />
        <div className="h-10 w-10 rounded-lg bg-[#F47A20]/10 grid place-items-center">
          <Icon size={18} className="text-[#F47A20]" />
        </div>
        <span className="text-xs font-medium text-white leading-tight">{label}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <div className="flex items-center justify-between mb-4">
          {description && <p className="text-xs text-[#8B93A8] pr-3">{description}</p>}
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ring-inset ${STATUS_BADGE_TONE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>

        {(error || actionError) && <p className="mb-3 text-xs text-red-400">{error || actionError}</p>}

        {status === "NOT_STARTED" && (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:opacity-50 transition-colors duration-200"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {busy ? "Starting..." : "Start"}
          </button>
        )}
        {status === "IN_PROGRESS" && (
          <button
            type="button"
            onClick={complete}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:opacity-50 transition-colors duration-200"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {busy ? "Submitting..." : "Mark Complete"}
          </button>
        )}
        {status === "COMPLETED" && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 py-1">
            <CheckCircle2 size={13} /> Completed today
          </p>
        )}
      </Modal>
    </>
  );
}
