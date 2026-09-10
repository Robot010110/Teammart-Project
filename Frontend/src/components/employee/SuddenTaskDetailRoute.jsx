import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import SuddenTaskDetailScreen from "./SuddenTaskDetailScreen";
import { getSuddenTask } from "../../services/suddenTaskService";
import { useAsync } from "../../hooks/useAsync";

// SuddenTaskDetailRoute.jsx — route wrapper for "tasks/:taskId": fetches
// the full task record (list rows don't carry assignedBy) and renders
// SuddenTaskDetailScreen, whose own onBack/onUpdated (fired after both a
// real start and a real complete) already fit a route-driven caller.
export default function SuddenTaskDetailRoute({ basePath }) {
  const { t } = useTranslation();
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { data: task, setData: setTask, error, loading, reload } = useAsync(
    () => getSuddenTask(taskId),
    { deps: [taskId], fallbackError: t("emp.couldNotLoadThisTask") }
  );
  const [locallyUpdated, setLocallyUpdated] = useState(null);

  if (loading) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-[220px]" /></div>;
  }
  if (error) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><ErrorBanner message={error} onRetry={reload} /></div>;
  }

  return (
    <SuddenTaskDetailScreen
      task={locallyUpdated ?? task}
      onBack={() => navigate(`${basePath}/tasks`)}
      onUpdated={(updated) => { setTask(updated); setLocallyUpdated(updated); }}
    />
  );
}
