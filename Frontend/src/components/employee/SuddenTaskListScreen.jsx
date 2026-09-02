import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import TaskOverviewBar from "./TaskOverviewBar";
import TaskCard from "./TaskCard";
import TaskEmptyState from "./TaskEmptyState";
import { listSuddenTasks } from "../../services/suddenTaskService";
import { useAsync } from "../../hooks/useAsync";

const TABS = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];
const SORTS = [
  { key: "priority", label: "Priority" },
  { key: "dueSoon", label: "Due Soon" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
];
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, NORMAL: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;

function isActive(task) {
  return task.status === "ASSIGNED" || task.status === "IN_PROGRESS";
}

function sortTasks(tasks, sort) {
  const list = [...tasks];
  if (sort === "priority") return list.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3));
  if (sort === "dueSoon") {
    return list.sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt) - new Date(b.dueAt);
    });
  }
  if (sort === "oldest") return list.sort((a, b) => new Date(a.assignedAt) - new Date(b.assignedAt));
  return list.sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt)); // newest (default)
}

// SuddenTaskListScreen.jsx — My Tasks redesign: a scalable Task Center
// (compact TaskCard list, real counts, real sorting) rather than a
// giant hero card per task — see this file's own TaskOverviewBar/
// TaskCard imports. Opening a task navigates to a real route (:taskId)
// instead of flipping local state, so Back from a task's detail returns
// here as a real history entry — see the "tasks/:taskId" route in
// EmployeeWorkspace.jsx/CashierWorkspace.jsx and
// SuddenTaskDetailRoute.jsx for the other half of this flow.
export default function SuddenTaskListScreen({ basePath }) {
  const { data: tasks, error, loading, reload } = useAsync(listSuddenTasks, {
    fallbackError: "Could not load your tasks.",
  });
  const [tab, setTab] = useState("active");
  const [sort, setSort] = useState("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const navigate = useNavigate();

  const activeTasks = useMemo(() => (tasks ?? []).filter(isActive), [tasks]);
  const completedTasks = useMemo(() => (tasks ?? []).filter((t) => t.status === "COMPLETED"), [tasks]);

  const highPriorityCount = activeTasks.filter((t) => t.priority === "HIGH" || t.priority === "URGENT").length;
  const dueSoonCount = activeTasks.filter((t) => t.dueAt && new Date(t.dueAt) - Date.now() <= DAY_MS && new Date(t.dueAt) - Date.now() >= 0).length;

  const shownTasks = sortTasks(tab === "active" ? activeTasks : completedTasks, sort);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">My Tasks</h1>
        <p className="text-sm text-[#8B93A8] mt-0.5">Stay focused. Complete what matters.</p>
      </div>

      {loading ? (
        <SkeletonCard className="h-[140px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          <div className="flex items-center gap-1 mb-4 rounded-xl bg-white/[0.04] p-1">
            {TABS.map((t) => {
              const count = t.key === "active" ? activeTasks.length : completedTasks.length;
              const selected = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-150 ${
                    selected
                      ? t.key === "completed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-[#F47A20] text-white"
                      : "text-[#9AA1B4] hover:text-white"
                  }`}
                >
                  {t.label} ({count})
                </button>
              );
            })}
          </div>

          {tab === "active" && (
            <TaskOverviewBar activeCount={activeTasks.length} highPriorityCount={highPriorityCount} dueSoonCount={dueSoonCount} />
          )}

          {shownTasks.length > 1 && (
            <div className="relative mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#9AA1B4] bg-white/[0.04] hover:text-white"
              >
                <ArrowUpDown size={12} /> {SORTS.find((s) => s.key === sort)?.label}
              </button>
              {sortOpen && (
                <div className="absolute top-9 right-0 z-10 w-36 rounded-xl bg-[#1F2436] border border-white/10 shadow-xl overflow-hidden">
                  {SORTS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => { setSort(s.key); setSortOpen(false); }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs ${sort === s.key ? "text-[#F47A20] font-semibold" : "text-white"} hover:bg-white/[0.06]`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {shownTasks.length === 0 ? (
            <TaskEmptyState variant={tab === "active" ? "active" : "completed"} />
          ) : (
            <div className="space-y-2.5">
              {shownTasks.map((task, i) => (
                <div key={task.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <TaskCard task={task} onClick={() => navigate(`${basePath}/tasks/${task.id}`)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
