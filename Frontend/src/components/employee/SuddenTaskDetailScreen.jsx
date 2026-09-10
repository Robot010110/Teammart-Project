import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Clock3, UserRound, CheckCircle2, Loader2, MapPin, StickyNote, Timer, Check } from "lucide-react";
import PriorityPill from "../common/PriorityPill";
import AuthenticatedImage from "../common/AuthenticatedImage";
import EvidenceCapture from "./EvidenceCapture";
import { categoryVisual } from "../../utils/suddenTaskVisuals";
import { startSuddenTask, completeSuddenTask } from "../../services/suddenTaskService";
import { ApiError } from "../../services/apiClient";

const dateTimeLabel = (isoString) =>
  new Date(isoString).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const timeLabel = (isoString) => new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function durationLabel(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STEPS = [
  { key: "ASSIGNED", label: "emp.assigned" },
  { key: "IN_PROGRESS", label: "emp.inProgress" },
  { key: "COMPLETED", label: "emp.completed" },
];

// A real 3-step stepper reflecting the task's actual status — not a
// fabricated completion percentage (this app has no notion of partial
// progress within a single sudden task; see this file's own top-level
// comment).
function StatusStepper({ status }) {
  const { t } = useTranslation();
  const currentIndex = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                i <= currentIndex ? "bg-[#F47A20] text-white" : "bg-white/[0.06] text-[#4C5266]"
              }`}
            >
              {i < currentIndex ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-[10px] ${i <= currentIndex ? "text-white" : "text-[#4C5266]"}`}>{t(step.label)}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1.5 -mt-4 ${i < currentIndex ? "bg-[#F47A20]" : "bg-white/[0.06]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// SuddenTaskDetailScreen.jsx — My Tasks redesign: the immersive detail +
// completion experience (the reference's visual quality lives here,
// deliberately NOT on every list card — see TaskCard.jsx's own
// comment). Real Start->timer->Complete lifecycle: Start calls the new
// startSuddenTask (sets a real startedAt server-side), a live elapsed
// timer ticks off that real timestamp while IN_PROGRESS, and "Time
// Taken" on the completion state is (completedAt - startedAt), never
// estimated. Evidence capture stays exactly as it worked before —
// optional, offered once IN_PROGRESS, unchanged component
// (EvidenceCapture.jsx).
export default function SuddenTaskDetailScreen({ task, onBack, onUpdated }) {
  const { t } = useTranslation();
  const [photo, setPhoto] = useState(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (task.status !== "IN_PROGRESS") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [task.status]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const updated = await startSuddenTask(task.id);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("emp.couldNotStartThisTask"));
    } finally {
      setStarting(false);
    }
  }

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await completeSuddenTask(task.id, photo || undefined);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("emp.couldNotMarkThisTaskComplete"));
    } finally {
      setSubmitting(false);
    }
  }

  const visual = categoryVisual(task.category);
  const Icon = visual.icon;

  // Completed — the satisfying celebration state, replacing the
  // instructions/action-button view entirely.
  if (task.status === "COMPLETED") {
    const startedAt = task.startedAt ?? task.assignedAt;
    const timeTakenMs = task.completedAt ? new Date(task.completedAt).getTime() - new Date(startedAt).getTime() : null;

    return (
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ms-1 py-1.5 px-1">
          <ArrowLeft size={16} className="rtl-flip" /> {t("emp.backToTasks")}
        </button>

        <div className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500/[0.08] to-[#171C2E]/90 border border-emerald-500/20 backdrop-blur-xl text-center animate-modal-in">
          <span className="relative inline-flex w-16 h-16 rounded-full bg-emerald-500/15 items-center justify-center text-emerald-400 mb-4">
            <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-glow-pulse" aria-hidden="true" />
            <CheckCircle2 size={30} className="relative" />
          </span>
          <h1 className="text-lg font-bold text-white">{t("emp.taskCompleted")}</h1>

          <div className="mt-4 flex items-center justify-center gap-3">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${visual.bg} ${visual.tone} ${visual.glow}`}>
              <Icon size={18} />
            </span>
            <div className="text-start">
              <p className="text-sm font-semibold text-white">{task.title}</p>
              <p className="text-xs text-[#8B93A8]">{t(visual.label)}{task.location ? ` · ${task.location}` : ""}</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-emerald-300/90">{t("emp.greatJobYouveCompletedThisTask")}</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 bg-black/20 border border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-wide text-[#8B93A8]">{t("emp.completedAt")}</p>
              <p className="text-sm font-semibold text-emerald-400 mt-0.5">{timeLabel(task.completedAt)}</p>
            </div>
            <div className="rounded-xl p-3 bg-black/20 border border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-wide text-[#8B93A8]">{t("emp.timeTaken")}</p>
              <p className="text-sm font-semibold text-emerald-400 mt-0.5">{timeTakenMs != null ? durationLabel(timeTakenMs) : "—"}</p>
            </div>
          </div>

          {task.evidenceUrl && (
            <div className="mt-4">
              <AuthenticatedImage src={task.evidenceUrl} alt={t("emp.submittedEvidence")} className="w-full rounded-xl max-h-56 object-cover" />
            </div>
          )}

          <button type="button" onClick={onBack} className="mt-5 w-full rounded-xl py-2.5 text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/[0.1] transition-colors">
            {t("emp.viewAllCompletedTasks")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ms-1 py-1.5 px-1">
        <ArrowLeft size={16} className="rtl-flip" /> {t("emp.backToTasks")}
      </button>

      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <PriorityPill priority={task.priority} />
          {task.status === "IN_PROGRESS" && (
            <span className="flex items-center gap-1 text-xs font-semibold text-[#F47A20]">
              <Timer size={13} /> {durationLabel(now - new Date(task.startedAt).getTime())}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-3">
          <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${visual.bg} ${visual.tone} ${visual.glow}`}>
            <Icon size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white">{task.title}</h1>
            <p className="text-xs text-[#8B93A8]">{t(visual.label)}{task.location ? ` · ${task.location}` : ""}</p>
          </div>
        </div>

        {task.description && <p className="text-sm text-[#9AA1B4] leading-relaxed">{task.description}</p>}

        <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-3 text-xs">
          {task.dueAt && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#8B93A8]">{t("emp.dueTime")}</p>
              <p className="text-white font-medium mt-0.5">{dateTimeLabel(task.dueAt)}</p>
            </div>
          )}
          {task.location && (
            <div>
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#8B93A8]"><MapPin size={10} /> {t("emp.location")}</p>
              <p className="text-white font-medium mt-0.5">{task.location}</p>
            </div>
          )}
          {task.assignedBy?.name && (
            <div>
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#8B93A8]"><UserRound size={10} /> {t("emp.assignedBy")}</p>
              <p className="text-white font-medium mt-0.5">{task.assignedBy.name}</p>
            </div>
          )}
          <div>
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#8B93A8]"><Clock3 size={10} /> {t("emp.assigned")}</p>
            <p className="text-white font-medium mt-0.5">{dateTimeLabel(task.assignedAt)}</p>
          </div>
        </div>

        {task.notes && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1"><StickyNote size={10} /> {t("emp.notes")}</p>
            <p className="text-sm text-[#9AA1B4]">{task.notes}</p>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          <StatusStepper status={task.status} />
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      {task.status === "ASSIGNED" && (
        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200 shadow-lg shadow-orange-900/20"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : null}
          {starting ? t("emp.starting") : t("emp.startTask")}
        </button>
      )}

      {task.status === "IN_PROGRESS" && (
        <div className="mt-5 rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
          <h2 className="text-sm font-semibold text-white mb-1">{t("emp.photoEvidence")}</h2>
          <p className="text-xs text-[#8B93A8] mb-4">{t("emp.optionalAttachAPhotoBeforeMarking")}</p>
          <EvidenceCapture photo={photo} onPhotoChange={setPhoto} />

          <button
            type="button"
            onClick={handleComplete}
            disabled={submitting}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200 shadow-lg shadow-orange-900/20"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {submitting ? t("emp.submitting") : t("emp.completeTask")}
          </button>
        </div>
      )}
    </div>
  );
}
