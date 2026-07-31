import { useState } from "react";
import SuddenTaskCard from "./SuddenTaskCard";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { listSuddenTasks, completeSuddenTask } from "../../services/suddenTaskService";
import { ApiError } from "../../services/apiClient";
import { useAsync } from "../../hooks/useAsync";

// SuddenTasksSection.jsx — the Employee's own urgent-task list, fetched
// from GET /api/sudden-tasks. Deliberately separate from
// TaskStatusTabs.jsx (which drives Activities): a Sudden Task only ever
// has two states (Active/Completed), not Draft/Pending/Approved/Rejected,
// and its data model, service, and card component are all their own —
// this is not "Activities with different labels".

const TABS = ["Active", "Completed"];

function matchesTab(task, tab) {
  if (tab === "Active") return task.status === "ASSIGNED";
  return task.status === "COMPLETED";
}

export default function SuddenTasksSection() {
  const { data: tasks, setData: setTasks, error, loading, reload: load } = useAsync(listSuddenTasks, {
    fallbackError: "Could not load your sudden tasks.",
  });
  const [tab, setTab] = useState("Active");
  const [completingId, setCompletingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const handleComplete = async (task) => {
    setCompletingId(task.id);
    setActionError(null);
    try {
      const updated = await completeSuddenTask(task.id);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not mark this task complete.");
    } finally {
      setCompletingId(null);
    }
  };

  if (loading) {
    return <SkeletonCard className="h-[140px]" />;
  }
  if (error) {
    return <ErrorBanner message={error} onRetry={load} />;
  }

  const filtered = tasks.filter((t) => matchesTab(t, tab));

  return (
    <section className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
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

      {actionError && <p className="mb-3 text-xs text-red-400">{actionError}</p>}

      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-sm text-[#4C5266] text-center py-8">No {tab.toLowerCase()} sudden tasks.</p>
        )}
        {filtered.map((task) => (
          <SuddenTaskCard key={task.id} task={task} onComplete={handleComplete} completingId={completingId} />
        ))}
      </div>
    </section>
  );
}
