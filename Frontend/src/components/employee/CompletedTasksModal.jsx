import { Clock3, MapPin, CheckCircle2 } from "lucide-react";
import Modal from "../common/Modal";

// CompletedTasksModal.jsx — opened from the "Completed Tasks" performance
// card. Shows the employee's full completed-task history: task name,
// completion date/time, and who approved it.

export default function CompletedTasksModal({ open, onClose, tasks }) {
  return (
    <Modal open={open} onClose={onClose} title="Completed Tasks" wide>
      {tasks.length === 0 ? (
        <p className="text-sm text-[#4C5266] text-center py-8">No completed tasks recorded yet.</p>
      ) : (
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 grid place-items-center shrink-0 mt-0.5">
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{task.type}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9AA1B4]">
                  <span className="flex items-center gap-1"><Clock3 size={12} /> {task.dateLabel} · {task.time}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} /> {task.department}</span>
                </div>
                <p className="mt-1 text-[11px] text-[#6B7284]">
                  Approved by: <span className="text-[#9AA1B4]">{task.approvedBy || "Pending review"}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
