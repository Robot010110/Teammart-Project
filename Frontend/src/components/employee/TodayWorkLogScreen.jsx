import { ArrowLeft, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { categoryVisual } from "../../utils/suddenTaskVisuals";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { useAsync } from "../../hooks/useAsync";
import { listSuddenTasks } from "../../services/suddenTaskService";

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
const timeLabel = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
function durationLabel(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// TodayWorkLogScreen.jsx — "click Working Hours on Home, see everything
// you did today and how long you took." There is no linkage between
// AttendanceRecord and SuddenTask anywhere in this app (confirmed) —
// this is built honestly from real SuddenTask timestamps
// (startedAt/completedAt), scoped to today, rather than inventing an
// attendance-day join that doesn't exist.
export default function TodayWorkLogScreen({ onBack }) {
  const { t } = useTranslation();
  const { data: tasks, error, loading, reload } = useAsync(listSuddenTasks, { deps: [] });

  const todaysWork = (tasks ?? [])
    .filter((t) => isToday(t.startedAt) || isToday(t.completedAt))
    .sort((a, b) => new Date(b.startedAt ?? b.assignedAt) - new Date(a.startedAt ?? a.assignedAt));

  const totalMs = todaysWork.reduce((sum, t) => {
    if (!t.startedAt) return sum;
    const end = t.completedAt ? new Date(t.completedAt).getTime() : Date.now();
    return sum + Math.max(end - new Date(t.startedAt).getTime(), 0);
  }, 0);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ms-1 py-1.5 px-1">
        <ArrowLeft size={16} className="rtl-flip" /> {t("emp.backToHome")}
      </button>

      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">{t("emp.todaysWork")}</h1>
        <p className="text-sm text-[#8B93A8] mt-0.5">{t("emp.whatYouDidTodayAndHow")}</p>
      </div>

      {loading ? (
        <SkeletonCard className="h-40" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl mb-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
              <Timer size={18} />
            </span>
            <div>
              <p className="text-lg font-bold text-white leading-none">{durationLabel(totalMs)}</p>
              <p className="text-xs text-[#8B93A8] mt-1">{t("emp.totalTimeOnTasksToday")}</p>
            </div>
          </div>

          {todaysWork.length === 0 ? (
            <p className="text-sm text-[#4C5266] text-center py-10">{t("emp.noTaskActivityYetToday")}</p>
          ) : (
            <div className="space-y-2.5">
              {todaysWork.map((task) => {
                const visual = categoryVisual(task.category);
                const Icon = visual.icon;
                const inProgress = task.status === "IN_PROGRESS";
                const durationMs = task.startedAt
                  ? (task.completedAt ? new Date(task.completedAt).getTime() : Date.now()) - new Date(task.startedAt).getTime()
                  : null;
                return (
                  <div key={task.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
                    <div className="flex items-start gap-3">
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${visual.bg} ${visual.tone} ${visual.glow}`}>
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{task.title}</p>
                        <p className="text-xs text-[#8B93A8] mt-0.5">
                          {task.startedAt ? t("emp.startedAt", { time: timeLabel(task.startedAt) }) : t("emp.assignedAt", { time: timeLabel(task.assignedAt) })}
                          {task.completedAt ? ` · ${t("emp.completedAtInline", { time: timeLabel(task.completedAt) })}` : inProgress ? ` · ${t("emp.inProgressDot")}` : ""}
                        </p>
                      </div>
                      {durationMs != null && (
                        <span className={`shrink-0 text-xs font-semibold ${inProgress ? "text-[#F47A20]" : "text-emerald-400"}`}>
                          {durationLabel(durationMs)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
