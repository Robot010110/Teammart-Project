import { useState } from "react";
import { ChevronRight, Clock3 } from "lucide-react";
import PriorityPill from "../common/PriorityPill";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import SuddenTaskDetailScreen from "./SuddenTaskDetailScreen";
import { listSuddenTasks, getSuddenTask } from "../../services/suddenTaskService";
import { useAsync } from "../../hooks/useAsync";

const TABS = ["Active", "Completed"];

function matchesTab(task, tab) {
  return tab === "Active" ? task.status === "ASSIGNED" : task.status === "COMPLETED";
}

const assignedTimeLabel = (isoString) =>
  new Date(isoString).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function TaskRow({ task, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="w-full text-left rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{task.title}</p>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-[#9AA1B4]">
            <Clock3 size={12} /> {assignedTimeLabel(task.assignedAt)}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PriorityPill priority={task.priority} />
          <ChevronRight size={16} className="text-[#4C5266]" />
        </div>
      </div>
    </button>
  );
}

// SuddenTaskListScreen.jsx — the Tasks tab's content: a real list->detail
// flow (replacing the old inline-card SuddenTasksSection for the mobile
// shell) driven entirely by local `selectedTask` state, no router.
export default function SuddenTaskListScreen() {
  const { data: tasks, setData: setTasks, error, loading, reload } = useAsync(listSuddenTasks, {
    fallbackError: "Could not load your sudden tasks.",
  });
  const [tab, setTab] = useState("Active");
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // The list only carries the fields SuddenTasksSection needs — fetch the
  // full record (including who assigned it) when opening the detail view.
  async function handleOpen(task) {
    setDetailLoading(true);
    try {
      const full = await getSuddenTask(task.id);
      setSelectedTask(full);
    } catch {
      setSelectedTask(task);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleCompleted(updated) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  }

  if (selectedTask) {
    return (
      <SuddenTaskDetailScreen
        task={selectedTask}
        onBack={() => setSelectedTask(null)}
        onCompleted={handleCompleted}
      />
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Sudden Tasks</h1>

      {loading ? (
        <SkeletonCard className="h-[140px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
            {TABS.map((t) => {
              const count = tasks.filter((task) => matchesTab(task, t)).length;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors duration-150 ${
                    tab === t ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] hover:bg-white/[0.09]"
                  }`}
                >
                  {t} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5">
            {tasks.filter((t) => matchesTab(t, tab)).length === 0 && (
              <p className="text-sm text-[#4C5266] text-center py-10">No {tab.toLowerCase()} sudden tasks.</p>
            )}
            {tasks.filter((t) => matchesTab(t, tab)).map((task) => (
              <TaskRow key={task.id} task={task} onOpen={handleOpen} />
            ))}
            {detailLoading && <p className="text-center text-xs text-[#4C5266] py-2">Loading task...</p>}
          </div>
        </>
      )}
    </div>
  );
}
