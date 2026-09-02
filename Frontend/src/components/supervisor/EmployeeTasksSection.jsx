import { useState } from "react";
import { ArrowLeft, Plus, Loader2, Check, Clock3, CheckCircle2, MapPin, StickyNote } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import PriorityPill from "../common/PriorityPill";
import { CATEGORY_VISUALS, categoryVisual } from "../../utils/suddenTaskVisuals";
import { listSuddenTasks, assignSuddenTask } from "../../services/suddenTaskService";
import { ApiError } from "../../services/apiClient";

const assignedTimeLabel = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const dueLabel = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// EmployeeTasksSection.jsx — Sudden Tasks the Supervisor has pushed to
// this employee (real: GET /api/sudden-tasks?employeeId=, force-scoped
// to the caller's own market) plus a real assign form
// (POST /api/sudden-tasks/assign). My Tasks redesign added optional
// category/dueAt/location/notes here, all genuinely optional — nothing
// is required beyond the original title/description/priority.
export default function EmployeeTasksSection({ employeeId, employeeName, onBack }) {
  const { data: tasks, setData: setTasks, error, loading, reload } = useAsync(
    () => listSuddenTasks({ employeeId }),
    { deps: [employeeId], fallbackError: "Could not load tasks." }
  );
  const [showForm, setShowForm] = useState(false);

  function handleAssigned(task) {
    setTasks((prev) => [task, ...(prev ?? [])]);
    setShowForm(false);
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-white">Tasks — {employeeName}</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36]"
        >
          <Plus size={14} /> Assign Task
        </button>
      </div>

      {showForm && (
        <AssignTaskForm employeeId={employeeId} onAssigned={handleAssigned} onCancel={() => setShowForm(false)} />
      )}

      {loading ? (
        <SkeletonCard className="h-[160px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : tasks.length === 0 ? (
        <p className="text-sm text-[#4C5266] text-center py-10">No tasks assigned yet.</p>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((t) => {
            const visual = categoryVisual(t.category);
            const Icon = visual.icon;
            return (
              <div key={t.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${visual.bg} ${visual.tone}`}>
                      <Icon size={14} />
                    </span>
                    <span className="text-sm font-medium text-white truncate">{t.title}</span>
                  </div>
                  <PriorityPill priority={t.priority} />
                </div>
                {t.description && <p className="mt-1.5 text-xs text-[#8B93A8]">{t.description}</p>}
                {t.location && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#9AA1B4]"><MapPin size={11} /> {t.location}</p>
                )}
                {t.notes && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#9AA1B4]"><StickyNote size={11} /> {t.notes}</p>
                )}
                {t.dueAt && (
                  <p className="mt-1.5 text-[11px] text-amber-400">Due {dueLabel(t.dueAt)}</p>
                )}
                <div className="mt-1.5 flex items-center gap-1 text-xs text-[#9AA1B4]">
                  <Clock3 size={12} /> Assigned {assignedTimeLabel(t.assignedAt)}
                </div>
                {t.status === "COMPLETED" && t.completedAt && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-400">
                    <CheckCircle2 size={12} /> Completed {assignedTimeLabel(t.completedAt)}
                  </p>
                )}
                {t.status === "IN_PROGRESS" && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#F47A20]">
                    <Clock3 size={12} /> In progress since {assignedTimeLabel(t.startedAt)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignTaskForm({ employeeId, onAssigned, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [category, setCategory] = useState("GENERAL");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const task = await assignSuddenTask({
        employeeId,
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        ...(dueDate ? { dueAt: new Date(`${dueDate}T${dueTime || "09:00"}`).toISOString() } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onAssigned(task);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign this task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl p-4 mb-4 bg-[#1A1F33]/70 border border-white/[0.06] space-y-3">
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Restock water bottles" className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50" />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What needs to be done" className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 resize-none" />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Priority</label>
        <div className="flex gap-2">
          {["NORMAL", "HIGH", "URGENT"].map((p) => (
            <button key={p} type="button" onClick={() => setPriority(p)} className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${priority === p ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4]"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Category</label>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(CATEGORY_VISUALS).map(([key, v]) => {
            const Icon = v.icon;
            const selected = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                title={v.label}
                className={`flex flex-col items-center gap-1 rounded-lg py-2 transition-colors ${selected ? "bg-[#F47A20]/15 border border-[#F47A20]/40" : "bg-white/[0.04] border border-white/[0.06]"}`}
              >
                <Icon size={14} className={selected ? "text-[#F47A20]" : "text-[#9AA1B4]"} />
                <span className={`text-[9px] leading-tight text-center ${selected ? "text-white" : "text-[#9AA1B4]"}`}>{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Due Date (optional)</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white outline-none focus:border-[#F47A20]/50" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Due Time (optional)</label>
          <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!dueDate} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white outline-none focus:border-[#F47A20]/50 disabled:opacity-40" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Location (optional)</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Shelf A3" className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50" />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything else the employee should know" className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 resize-none" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50">
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Assign
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className="flex-1 rounded-lg py-2 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1]">
          Cancel
        </button>
      </div>
    </div>
  );
}
