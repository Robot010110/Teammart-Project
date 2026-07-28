import { Clock3, CheckCircle2, Loader2 } from "lucide-react";
import PriorityPill from "../common/PriorityPill";

// SuddenTaskCard.jsx — one urgent task pushed by a Supervisor. Same card
// shell/spacing as the activity rows in TaskStatusTabs.jsx so Sudden
// Tasks reads as part of the same design language, while staying its own
// component since the fields (title/description/priority) and the single
// action (mark complete) are entirely different from an Activity.

const assignedTimeLabel = (isoString) =>
  new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function SuddenTaskCard({ task, onComplete, completingId }) {
  const isCompleting = completingId === task.id;

  return (
    <div className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-white">{task.title}</span>
        <PriorityPill priority={task.priority} />
      </div>
      {task.description && <p className="mt-1.5 text-xs text-[#8B93A8]">{task.description}</p>}
      <div className="mt-1.5 flex items-center gap-1 text-xs text-[#9AA1B4]">
        <Clock3 size={12} /> Assigned {assignedTimeLabel(task.assignedAt)}
      </div>

      {task.status === "ASSIGNED" && (
        <div className="mt-2.5">
          <button
            onClick={() => onComplete(task)}
            disabled={isCompleting}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[#F47A20] hover:text-[#ff8b36] disabled:opacity-40 transition-colors duration-150"
          >
            {isCompleting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {isCompleting ? "Marking complete..." : "Mark Complete"}
          </button>
        </div>
      )}
      {task.status === "COMPLETED" && task.completedAt && (
        <p className="mt-2.5 flex items-center gap-1 text-[11px] text-emerald-400">
          <CheckCircle2 size={12} /> Completed {assignedTimeLabel(task.completedAt)}
        </p>
      )}
    </div>
  );
}
