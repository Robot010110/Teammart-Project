import { Circle, CheckCircle2, Timer } from "lucide-react";
import PriorityPill from "../common/PriorityPill";

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// TaskRow.jsx — one row in the Activity/Home tabs' "My Tasks"/"Today's
// Tasks" lists. Backed by a real SuddenTask (see suddenTaskService.js) —
// title/priority/assignedAt/startedAt/completedAt/status are the only
// fields this model actually has (no `department` field exists on
// SuddenTask, unlike the reference screenshot's example rows, so this
// row deliberately doesn't show one rather than inventing it — see
// WorkerActivityTab.jsx's own comment). My Tasks redesign added a real
// IN_PROGRESS status (started but not yet complete) between ASSIGNED and
// COMPLETED — this row shows a distinct state for it rather than
// lumping it in with "Pending".
export default function TaskRow({ task, onClick }) {
  const isCompleted = task.status === "COMPLETED";
  const isInProgress = task.status === "IN_PROGRESS";
  const timestamp = isCompleted ? task.completedAt : isInProgress ? task.startedAt : task.assignedAt;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors text-left"
    >
      {isCompleted ? (
        <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
      ) : isInProgress ? (
        <Timer size={20} className="text-[#F47A20] shrink-0" />
      ) : (
        <Circle size={20} className="text-[#4C5266] shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{task.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <PriorityPill priority={task.priority} />
          <span className="text-[11px] text-[#8B93A8]">{timeLabel(timestamp)}</span>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
          isCompleted ? "bg-emerald-500/10 text-emerald-400" : isInProgress ? "bg-[#F47A20]/15 text-[#F47A20]" : "bg-white/[0.06] text-[#9AA1B4]"
        }`}
      >
        {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Pending"}
      </span>
    </button>
  );
}
