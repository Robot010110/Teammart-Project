import { useNavigate } from "react-router-dom";
import { Moon, Briefcase, Layers, ClipboardList, LayoutGrid, MessageCircle, ChevronRight, Droplets, History } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getMyNightShiftDashboard } from "../../services/nightShiftService";
import { listActivities } from "../../services/activityService";

const LABEL_STYLE = {
  "Not Started": "bg-white/5 text-[#9AA1B4]",
  "In Progress": "bg-amber-500/10 text-amber-400",
  Completed: "bg-emerald-500/10 text-emerald-400",
  Overdue: "bg-red-500/10 text-red-400",
};

function TaskRow({ task, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="w-full flex items-center gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 text-left transition-colors"
    >
      <span className="grid place-items-center h-9 w-9 rounded-lg bg-[#F47A20]/10 text-[#F47A20] shrink-0">
        <Droplets size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{task.name}</p>
        {task.requiresEvidence && (
          <p className="text-[11px] text-[#8B93A8] mt-0.5">{task.photoCount}/{task.minPhotos} photos</p>
        )}
      </div>
      <span className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-1 ${LABEL_STYLE[task.label] || LABEL_STYLE["Not Started"]}`}>
        {task.label}
      </span>
      <ChevronRight size={15} className="text-[#4C5266] shrink-0" />
    </button>
  );
}

function QuickLink({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1.5 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
    >
      <Icon size={17} className="text-[#F47A20]" />
      <span className="text-[11px] font-medium text-[#9AA1B4]">{label}</span>
    </button>
  );
}

function timeLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// NightShiftDashboardScreen.jsx — Night Shift §6-7/§29: the Night Shift
// employee's "what should I do tonight" hub. Reuses existing screens for
// everything that already exists (Sudden/Assigned Tasks -> the Tasks tab,
// Daily activity/reports -> the Activity tab, the Night Shift group ->
// the Chat tab, once the employee is auto-added on first completion) —
// this screen only owns what's genuinely new: shift status, the Main/
// Additional department breakdown, and tonight's Night Shift task list.
export default function NightShiftDashboardScreen({ basePath }) {
  const navigate = useNavigate();
  const { data: dashboard, error, loading, reload } = useAsync(getMyNightShiftDashboard, { deps: [] });
  const { data: history } = useAsync(() => listActivities({ category: "NIGHT_SHIFT_TASK" }), { deps: [] });

  function openTask(task) {
    navigate(`${basePath}/night-shift/washing-market/${task.id}`, { state: { task } });
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto space-y-3">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-32" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <ErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }

  const recentCompletions = (history || [])
    .filter((a) => a.status !== "DRAFT" && a.operationalDate !== dashboard.operationalDate)
    .slice(0, 5);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="flex items-center gap-2 mb-4">
        <Moon size={18} className="text-[#F47A20]" />
        <h1 className="text-lg font-semibold text-white">Night Shift</h1>
      </div>

      <div className="rounded-2xl p-5 bg-gradient-to-br from-[#1D2D5C]/50 to-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <p className="text-xs text-[#8B93A8]">Tonight's operational shift</p>
        <p className="mt-1 text-sm font-medium text-white">
          {new Date(dashboard.operationalDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]">
              <Briefcase size={11} /> Main Department
            </p>
            <p className="mt-1 text-sm font-medium text-white truncate">{dashboard.mainDepartment || "Not assigned"}</p>
          </div>

          {dashboard.additionalDepartments?.length > 0 && (
            <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]">
                <Layers size={11} /> Additional Responsibilities
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {dashboard.additionalDepartments.map((d) => (
                  <span key={d} className="rounded-full px-2 py-0.5 text-xs font-medium text-white bg-white/[0.06]">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="mt-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Tonight's Night Shift Tasks</h2>
        {dashboard.tasks.length === 0 ? (
          <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
            <p className="text-sm text-[#8B93A8]">No Night Shift tasks assigned yet tonight.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dashboard.tasks.map((task) => (
              <TaskRow key={task.id} task={task} onOpen={openTask} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <QuickLink icon={ClipboardList} label="Assigned Tasks" onClick={() => navigate(`${basePath}/tasks`)} />
        <QuickLink icon={LayoutGrid} label="Daily Activity" onClick={() => navigate(`${basePath}/activity`)} />
        <QuickLink icon={MessageCircle} label="Night Shift Group" onClick={() => navigate(`${basePath}/chat`)} />
      </section>

      {recentCompletions.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">
            <History size={13} /> Completion History
          </h2>
          <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]">
            {recentCompletions.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-white">{a.nightShiftTaskDefinition?.name || "Night Shift Task"}</span>
                <span className="text-xs text-[#8B93A8]">{timeLabel(a.date)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
