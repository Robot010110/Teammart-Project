import { ArrowLeft, TrendingUp, CheckCircle2, XCircle, HourglassIcon } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import TaskStatusTabs from "../workspace/TaskStatusTabs";
import SubmitTaskModal from "../workspace/SubmitTaskModal";
import { getPerformanceSummary, getActivityPerformanceHistory, listActivities, deleteActivity } from "../../services/activityService";
import { ApiError } from "../../services/apiClient";
import { canEditActivity, canDeleteActivity } from "../../data/activityRules";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";
import { useState } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function rateTone(rate) {
  if (rate == null) return "text-[#4C5266]";
  if (rate >= 90) return "text-emerald-400";
  if (rate >= 75) return "text-amber-400";
  return "text-red-400";
}

function rateLabel(rate) {
  return rate == null ? "—" : `${Math.round(rate)}%`;
}

function weekLabel(weekStart, index) {
  if (index === 0) return "This Week";
  if (index === 1) return "Last Week";
  return new Date(weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function HistoryRow({ label, rate, sublabel }) {
  return (
    <div className="rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.06] flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {sublabel && <p className="text-xs text-[#8B93A8] mt-0.5">{sublabel}</p>}
      </div>
      <div className={`flex items-center gap-1.5 text-base font-bold ${rateTone(rate)}`}>
        <TrendingUp size={15} />
        {rateLabel(rate)}
      </div>
    </div>
  );
}

// PerformanceHistoryScreen.jsx — the real Performance metric: approved /
// (approved + rejected) reviewed Activities, DRAFT/PENDING excluded (see
// activitiesController.computeActivityPerformance). "Current" + weekly +
// monthly history, current in-progress periods included and labeled —
// unlike Attendance Rate (which never shows the current month as final),
// this screen's own spec explicitly wants a live "This Week"/current
// figure alongside history.
//
// Also hosts "My Activities" — the employee's own Draft/Pending/Approved/
// Rejected activity history, relocated here from the Activity tab (which
// is now focused on submitting activities, not reviewing past ones).
// Same TaskStatusTabs component, same edit/delete rules
// (data/activityRules.js) and endpoints as before — nothing was
// duplicated or rebuilt, just moved.
export default function PerformanceHistoryScreen({ onBack }) {
  const { data: summary, error: summaryError, loading: summaryLoading, reload: reloadSummary } = useAsync(
    getPerformanceSummary,
    { deps: [] }
  );
  const { data: history, error: historyError, loading: historyLoading, reload: reloadHistory } = useAsync(
    () => getActivityPerformanceHistory({ weeks: 4, months: 6 }),
    { deps: [] }
  );
  const {
    data: activities,
    setData: setActivities,
    error: activitiesError,
    loading: activitiesLoading,
    reload: loadActivities,
  } = useAsync(listActivities, { fallbackError: "Could not load your activities." });

  const [editingActivity, setEditingActivity] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useToast();

  const handleSaved = (activity, message) => {
    setActivities((prev) => {
      const exists = prev.some((a) => a.id === activity.id);
      return exists ? prev.map((a) => (a.id === activity.id ? activity : a)) : [activity, ...prev];
    });
    setToast(message);
  };

  const handleDelete = async (activity) => {
    if (!canDeleteActivity(activity)) {
      setToast(`This activity is ${activity.status.toLowerCase()} and can no longer be deleted.`);
      return;
    }
    if (!window.confirm("Delete this draft activity? This cannot be undone.")) return;

    setDeletingId(activity.id);
    try {
      await deleteActivity(activity.id);
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
      setToast("Draft deleted.");
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : "Could not delete this activity.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (activity) => {
    if (!canEditActivity(activity)) {
      setToast(`This activity is already ${activity.status.toLowerCase()} and can no longer be edited.`);
      return;
    }
    setEditingActivity(activity);
  };

  const loading = summaryLoading || historyLoading;
  const error = summaryError || historyError;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1"
      >
        <ArrowLeft size={16} /> Back to Profile
      </button>

      <h1 className="text-lg font-semibold text-white mb-1">Performance History</h1>
      <p className="text-xs text-[#8B93A8] mb-5">Based on your reviewed daily activities — approved vs. rejected.</p>

      {loading ? (
        <SkeletonCard className="h-[300px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={() => { reloadSummary(); reloadHistory(); }} />
      ) : (
        <>
          <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-white">Current</p>
              <p className={`text-2xl font-bold ${rateTone(summary.rate)}`}>{rateLabel(summary.rate)}</p>
            </div>
            {summary.totalReviewed === 0 ? (
              <p className="text-xs text-[#4C5266]">No performance data yet — nothing has been reviewed.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="flex items-center justify-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 size={13} /> {summary.approved}
                  </p>
                  <p className="text-[11px] text-[#8B93A8] mt-1">Approved</p>
                </div>
                <div>
                  <p className="flex items-center justify-center gap-1 text-red-400 font-semibold">
                    <XCircle size={13} /> {summary.rejected}
                  </p>
                  <p className="text-[11px] text-[#8B93A8] mt-1">Rejected</p>
                </div>
                <div>
                  <p className="flex items-center justify-center gap-1 text-amber-400 font-semibold">
                    <HourglassIcon size={13} /> {summary.pending}
                  </p>
                  <p className="text-[11px] text-[#8B93A8] mt-1">Pending</p>
                </div>
              </div>
            )}
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Weekly</h2>
            <div className="space-y-2.5">
              {history.weekly.map((w, i) => (
                <HistoryRow
                  key={w.weekStart}
                  label={weekLabel(w.weekStart, i)}
                  rate={w.rate}
                  sublabel={w.totalReviewed > 0 ? `${w.approved} approved, ${w.rejected} rejected` : "Nothing reviewed"}
                />
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Monthly</h2>
            <div className="space-y-2.5">
              {history.monthly.map((m) => (
                <HistoryRow
                  key={`${m.year}-${m.month}`}
                  label={`${MONTH_NAMES[m.month - 1]} ${m.year}`}
                  rate={m.rate}
                  sublabel={m.totalReviewed > 0 ? `${m.approved} approved, ${m.rejected} rejected` : "Nothing reviewed"}
                />
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">My Activities</h2>
            {activitiesLoading && <SkeletonCard className="h-[220px]" />}
            {!activitiesLoading && activitiesError && <ErrorBanner message={activitiesError} onRetry={loadActivities} />}
            {!activitiesLoading && !activitiesError && activities && (
              <TaskStatusTabs activities={activities} onEdit={handleEdit} onDelete={handleDelete} deletingId={deletingId} />
            )}
          </section>
        </>
      )}

      <SubmitTaskModal activity={editingActivity} onClose={() => setEditingActivity(null)} onSaved={handleSaved} />
      <Toast message={toast} />
    </div>
  );
}
