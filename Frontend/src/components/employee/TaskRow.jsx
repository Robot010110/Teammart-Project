import { Circle, CheckCircle2 } from "lucide-react";
import PriorityPill from "../common/PriorityPill";

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// TaskRow.jsx — one row in the Activity tab's "My Tasks" list. Backed by
// a real SuddenTask (see suddenTaskService.js) — title/priority/
// assignedAt/completedAt/status are the only fields this model actually
// has (no `department` field exists on SuddenTask, unlike the reference
// screenshot's example rows, so this row deliberately doesn't show one
// rather than inventing it — see WorkerActivityTab.jsx's own comment).
export default function TaskRow({ task, onClick }) {
  const isCompleted = task.status === "COMPLETED";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors text-left"
    >
      {isCompleted ? (
        <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
      ) : (
        <Circle size={20} className="text-[#4C5266] shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{task.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <PriorityPill priority={task.priority} />
          <span className="text-[11px] text-[#8B93A8]">{timeLabel(isCompleted ? task.completedAt : task.assignedAt)}</span>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
          isCompleted ? "bg-emerald-500/10 text-emerald-400" : "bg-[#F47A20]/10 text-[#F47A20]"
        }`}
      >
        {isCompleted ? "Completed" : "Pending"}
      </span>
    </button>
  );
}
