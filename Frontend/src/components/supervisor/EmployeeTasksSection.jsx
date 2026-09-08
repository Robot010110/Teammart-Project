import { useMemo, useState } from "react";
import {
  ArrowLeft, Plus, Loader2, Check, Clock3, CheckCircle2, MapPin, StickyNote,
  FileText, AlertTriangle, ClipboardCheck,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import PriorityPill from "../common/PriorityPill";
import EmployeeIdentityStrip from "./EmployeeIdentityStrip";
import { CATEGORY_VISUALS, categoryVisual } from "../../utils/suddenTaskVisuals";
import { listSuddenTasks, assignSuddenTask } from "../../services/suddenTaskService";
import { ApiError } from "../../services/apiClient";

const assignedTimeLabel = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const dueLabel = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// "Overdue" is not a stored SuddenTaskStatus (the real enum is just
// ASSIGNED/IN_PROGRESS/COMPLETED) — it's derived here the same honest
// way a deadline is anywhere else in this app: not completed, and its
// real dueAt has already passed. Never a fabricated status.
function isOverdue(t) {
  return t.status !== "COMPLETED" && t.dueAt && new Date(t.dueAt) < new Date();
}

const TABS = [
  { key: "all", label: "All Tasks" },
  { key: "open", label: "Assigned Tasks" },
  { key: "completed", label: "Completed Tasks" },
];

const SUMMARY_TONE = {
  blue: { icon: "text-sky-300 bg-gradient-to-br from-sky-400/40 to-sky-400/10 ring-sky-400/50", border: "border-sky-400/35", glow: "0 0 28px -12px rgba(56,189,248,0.6)" },
  green: { icon: "text-emerald-300 bg-gradient-to-br from-emerald-400/40 to-emerald-400/10 ring-emerald-400/50", border: "border-emerald-400/35", glow: "0 0 28px -12px rgba(52,211,153,0.6)" },
  gold: { icon: "text-amber-300 bg-gradient-to-br from-amber-400/40 to-amber-400/10 ring-amber-400/50", border: "border-amber-400/35", glow: "0 0 28px -12px rgba(251,191,36,0.6)" },
  red: { icon: "text-red-300 bg-gradient-to-br from-red-400/40 to-red-400/10 ring-red-400/50", border: "border-red-400/35", glow: "0 0 28px -12px rgba(248,113,113,0.6)" },
};

function SummaryTile({ icon: Icon, label, value, tone }) {
  const t = SUMMARY_TONE[tone];
  return (
    <div
      style={{ boxShadow: `0 10px 24px -16px rgba(0,0,0,0.9), ${t.glow}` }}
      className={`rounded-2xl p-3.5 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border backdrop-blur-xl ${t.border}`}
    >
      <span className={`grid h-8 w-8 place-items-center rounded-xl ring-1 ring-inset ${t.icon}`}>
        <Icon size={15} />
      </span>
      <p className="mt-2.5 font-display text-[22px] font-bold leading-none text-white tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-[#8B93A8]">{label}</p>
    </div>
  );
}

// EmployeeTasksSection.jsx — Sudden Tasks the Supervisor has pushed to
// this employee (real: GET /api/sudden-tasks?employeeId=, force-scoped
// to the caller's own market) plus a real assign form
// (POST /api/sudden-tasks/assign). Answers "what work has been
// assigned" — distinct from Activity History, which answers "what did
// this employee actually do" (see EmployeeActivityHistoryScreen.jsx).
export default function EmployeeTasksSection({ employeeId, employee, marketName, onBack }) {
  const { data: tasks, setData: setTasks, error, loading, reload } = useAsync(
    () => listSuddenTasks({ employeeId }),
    { deps: [employeeId], fallbackError: "Could not load tasks." }
  );
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState("all");

  function handleAssigned(task) {
    setTasks((prev) => [task, ...(prev ?? [])]);
    setShowForm(false);
  }

  const summary = useMemo(() => {
    const list = tasks ?? [];
    return {
      total: list.length,
      completed: list.filter((t) => t.status === "COMPLETED").length,
      inProgress: list.filter((t) => t.status === "IN_PROGRESS").length,
      overdue: list.filter(isOverdue).length,
    };
  }, [tasks]);

  const filtered = useMemo(() => {
    const list = tasks ?? [];
    if (tab === "open") return list.filter((t) => t.status !== "COMPLETED");
    if (tab === "completed") return list.filter((t) => t.status === "COMPLETED");
    return list;
  }, [tasks, tab]);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-1 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back to Employee
      </button>

      <EmployeeIdentityStrip employee={employee} marketName={marketName} />

      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="font-display text-[18px] font-bold text-white">Tasks{employee ? ` — ${employee.name}` : ""}</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-white bg-gradient-to-r from-[#F47A20] to-[#E0561A] shadow-[0_4px_22px_-6px_rgba(244,122,32,0.75)] ring-1 ring-white/10 transition-all duration-150 hover:from-[#ff8b36] hover:to-[#F47A20] active:scale-[0.97]"
        >
          <Plus size={15} /> Assign Task
        </button>
      </div>

      {/* Tabs — real filters over the real fetched tasks, not decorative. */}
      <div className="flex gap-2 mb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                active
                  ? "bg-gradient-to-b from-[#F47A20]/25 to-[#F47A20]/[0.08] text-[#FFA35C] ring-1 ring-[#F47A20]/50 shadow-[0_0_22px_-6px_rgba(244,122,32,0.8)]"
                  : "bg-[#111A2D]/80 text-[#8B93A8] ring-1 ring-white/[0.06] hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Summary — real counts, Overdue derived honestly (see isOverdue). */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <SummaryTile icon={FileText} label="Total Tasks" value={loading ? "—" : summary.total} tone="blue" />
        <SummaryTile icon={CheckCircle2} label="Completed" value={loading ? "—" : summary.completed} tone="green" />
        <SummaryTile icon={ClipboardCheck} label="In Progress" value={loading ? "—" : summary.inProgress} tone="gold" />
        <SummaryTile icon={AlertTriangle} label="Overdue" value={loading ? "—" : summary.overdue} tone="red" />
      </div>

      {showForm && (
        <AssignTaskForm employeeId={employeeId} onAssigned={handleAssigned} onCancel={() => setShowForm(false)} />
      )}

      {loading ? (
        <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-[100px]" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-8 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border border-white/[0.07] backdrop-blur-xl text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[#F47A20]/12 text-[#F47A20] ring-1 ring-inset ring-[#F47A20]/25 shadow-[0_0_28px_-10px_rgba(244,122,32,0.7)]">
            <ClipboardCheck size={24} />
          </span>
          <p className="text-[15px] font-semibold text-white">
            {tab === "completed" ? "No completed tasks yet" : tab === "open" ? "No assigned tasks" : "No tasks assigned yet"}
          </p>
          <p className="mt-1 text-[13px] text-[#8B93A8]">
            {tab === "all"
              ? "This employee doesn't have any tasks right now. Assign a new task to get started."
              : "Nothing in this view yet."}
          </p>
          {tab === "all" && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white bg-gradient-to-r from-[#F47A20] to-[#E0561A] shadow-[0_4px_22px_-6px_rgba(244,122,32,0.75)]"
            >
              <Plus size={14} /> Assign Task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => {
            const visual = categoryVisual(t.category);
            const Icon = visual.icon;
            const overdue = isOverdue(t);
            return (
              <div
                key={t.id}
                className={`rounded-2xl p-3.5 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border backdrop-blur-xl transition-colors duration-150 ${
                  overdue ? "border-red-500/30 shadow-[0_0_20px_-14px_rgba(248,113,113,0.7)]" : "border-white/[0.07]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset ${visual.bg} ${visual.tone} ${visual.glow}`}>
                      <Icon size={15} />
                    </span>
                    <span className="text-[13.5px] font-semibold text-white truncate">{t.title}</span>
                  </div>
                  <PriorityPill priority={t.priority} />
                </div>
                {t.description && <p className="mt-1.5 text-[12.5px] text-[#8B93A8]">{t.description}</p>}
                {t.location && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[#9AA1B4]"><MapPin size={11} /> {t.location}</p>
                )}
                {t.notes && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[#9AA1B4]"><StickyNote size={11} /> {t.notes}</p>
                )}
                {t.dueAt && (
                  <p className={`mt-1.5 flex items-center gap-1 text-[11.5px] ${overdue ? "text-red-400" : "text-amber-400"}`}>
                    {overdue && <AlertTriangle size={11} />} {overdue ? "Overdue since" : "Due"} {dueLabel(t.dueAt)}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[#9AA1B4]">
                  <Clock3 size={11} /> Assigned {assignedTimeLabel(t.assignedAt)}
                </div>
                {t.status === "COMPLETED" && t.completedAt && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-emerald-400">
                    <CheckCircle2 size={11} /> Completed {assignedTimeLabel(t.completedAt)}
                  </p>
                )}
                {t.status === "IN_PROGRESS" && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[#F47A20]">
                    <Clock3 size={11} /> In progress since {assignedTimeLabel(t.startedAt)}
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
    <div className="rounded-2xl p-4 mb-4 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border border-[#F47A20]/25 backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9),0_0_30px_-16px_rgba(244,122,32,0.4)] space-y-3">
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
