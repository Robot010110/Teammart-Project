import { useState } from "react";
import { ArrowLeft, Clock3, UserRound, CheckCircle2, Loader2 } from "lucide-react";
import PriorityPill from "../common/PriorityPill";
import EvidenceCapture from "./EvidenceCapture";
import { completeSuddenTask } from "../../services/suddenTaskService";
import { ApiError } from "../../services/apiClient";

const dateTimeLabel = (isoString) =>
  new Date(isoString).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// SuddenTaskDetailScreen.jsx — full instructions, assigned-by, deadline-
// style "assigned at" timestamp, priority, and (while still ASSIGNED) an
// optional evidence photo before marking complete. Evidence is optional
// server-side (no requirement flag exists on SuddenTask) — capturing one
// is offered, not forced, matching what the backend actually enforces.
export default function SuddenTaskDetailScreen({ task, onBack, onCompleted }) {
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await completeSuddenTask(task.id, photo || undefined);
      onCompleted(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark this task complete.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1"
      >
        <ArrowLeft size={16} /> Back to Tasks
      </button>

      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold text-white">{task.title}</h1>
          <PriorityPill priority={task.priority} />
        </div>

        {task.description && <p className="mt-3 text-sm text-[#9AA1B4] leading-relaxed">{task.description}</p>}

        <div className="mt-4 space-y-2 text-xs text-[#9AA1B4]">
          <div className="flex items-center gap-1.5">
            <Clock3 size={13} /> Assigned {dateTimeLabel(task.assignedAt)}
          </div>
          {task.assignedBy?.name && (
            <div className="flex items-center gap-1.5">
              <UserRound size={13} /> Assigned by {task.assignedBy.name}
            </div>
          )}
          {task.status === "COMPLETED" && task.completedAt && (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={13} /> Completed {dateTimeLabel(task.completedAt)}
            </div>
          )}
        </div>
      </div>

      {task.status === "ASSIGNED" && (
        <div className="mt-5 rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
          <h2 className="text-sm font-semibold text-white mb-1">Photo Evidence</h2>
          <p className="text-xs text-[#8B93A8] mb-4">Optional — attach a photo before marking this task complete.</p>
          <EvidenceCapture photo={photo} onPhotoChange={setPhoto} />

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleComplete}
            disabled={submitting}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200 shadow-lg shadow-orange-900/20"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {submitting ? "Submitting..." : "Mark Complete"}
          </button>
        </div>
      )}

      {task.status === "COMPLETED" && task.evidenceUrl && (
        <div className="mt-5 rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
          <h2 className="text-sm font-semibold text-white mb-3">Submitted Evidence</h2>
          <img src={task.evidenceUrl} alt="Submitted evidence" className="w-full rounded-xl max-h-72 object-cover" />
        </div>
      )}
    </div>
  );
}
