import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import SuddenTaskDetailScreen from "./SuddenTaskDetailScreen";
import { getSuddenTask } from "../../services/suddenTaskService";
import { useAsync } from "../../hooks/useAsync";

// SuddenTaskDetailRoute.jsx — route wrapper for "tasks/:taskId": fetches
// the full task record (list rows don't carry assignedBy) and renders
// SuddenTaskDetailScreen, whose own onBack/onCompleted already fit a
// route-driven caller unchanged.
export default function SuddenTaskDetailRoute({ basePath }) {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { data: task, setData: setTask, error, loading, reload } = useAsync(
    () => getSuddenTask(taskId),
    { deps: [taskId], fallbackError: "Could not load this task." }
  );
  const [justCompleted, setJustCompleted] = useState(null);

  if (loading) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-[220px]" /></div>;
  }
  if (error) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><ErrorBanner message={error} onRetry={reload} /></div>;
  }

  return (
    <SuddenTaskDetailScreen
      task={justCompleted ?? task}
      onBack={() => navigate(`${basePath}/tasks`)}
      onCompleted={(updated) => { setTask(updated); setJustCompleted(updated); }}
    />
  );
}
