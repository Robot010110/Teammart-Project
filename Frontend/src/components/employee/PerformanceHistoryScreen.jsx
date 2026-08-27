import { ArrowLeft, TrendingUp, CheckCircle2, XCircle, HourglassIcon, Clock3, PackageX } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import ActivityStatusPill from "../common/ActivityStatusPill";
import TaskStatusTabs from "../workspace/TaskStatusTabs";
import SubmitTaskModal from "../workspace/SubmitTaskModal";
import { getPerformanceSummary, getActivityPerformanceHistory, listActivities, deleteActivity } from "../../services/activityService";
import { listMyExtraHoursRequests } from "../../services/attendanceService";
import { listMyWastedOverallReports } from "../../services/wastedOverallService";
import { ApiError } from "../../services/apiClient";
import { canEditActivity, canDeleteActivity } from "../../data/activityRules";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";
import { useState } from "react";

const WASTED_ITEM_LABEL = { EGGS: "Eggs", TOMATO: "Tomato", POTATO: "Potato", CUCUMBER: "Cucumber", ONION: "Onion", OTHER: "Other" };
function wastedItemLabel(report) {
  if (report.item === "OTHER" && report.otherItemName) return report.otherItemName;
  return WASTED_ITEM_LABEL[report.item] || report.item;
}
function wastedQuantityLabel(report) {
  return report.item === "EGGS" ? `${report.quantityCount} egg${report.quantityCount === 1 ? "" : "s"}` : `${report.quantityKg}kg`;
}
function shortDateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
  // Extra Hours requests and Wasted Overall reports move here once a
  // Supervisor decides them (Approved/Rejected) — they leave Attendance
  // History / the Activity tab's own preview immediately at that point
  // (see AttendanceHistoryList.jsx/WorkerActivityTab.jsx) and are only
  // ever shown from here on. Both endpoints already return every one of
  // the employee's own requests/reports regardless of status (same "fetch
  // once, filter by tab client-side" convention TaskStatusTabs above
  // already uses for Activities) — filtered to decided-only below.
  const { data: extraHoursRequests, error: extraHoursError, loading: extraHoursLoading, reload: loadExtraHours } = useAsync(
    listMyExtraHoursRequests,
    { fallbackError: "Could not load your Extra Hours requests." }
  );
  const { data: wastedOverallReports, error: wastedOverallError, loading: wastedOverallLoading, reload: loadWastedOverall } = useAsync(
    listMyWastedOverallReports,
    { fallbackError: "Could not load your Wasted Overall reports." }
  );
  const decidedExtraHours = (extraHoursRequests ?? []).filter((r) => r.status !== "PENDING");
  const decidedWastedOverall = (wastedOverallReports ?? []).filter((r) => r.status !== "PENDING");

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

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Extra Hours</h2>
            {extraHoursLoading ? (
              <SkeletonCard className="h-[100px]" />
            ) : extraHoursError ? (
              <ErrorBanner message={extraHoursError} onRetry={loadExtraHours} />
            ) : decidedExtraHours.length === 0 ? (
              <p className="text-sm text-[#4C5266] text-center py-6">No decided Extra Hours requests yet.</p>
            ) : (
              <div className="space-y-2">
                {decidedExtraHours.map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06]">
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
                      <Clock3 size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white">Extra Work — {r.hours}h</p>
                        <ActivityStatusPill status={r.status} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#8B93A8]">
                        {shortDateLabel(r.date)}{r.reason ? ` · ${r.reason}` : ""}
                      </p>
                      {r.status === "REJECTED" && r.reviewNote && (
                        <p className="mt-1 text-[11px] text-red-400">{r.reviewNote}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Wasted Overall</h2>
            {wastedOverallLoading ? (
              <SkeletonCard className="h-[100px]" />
            ) : wastedOverallError ? (
              <ErrorBanner message={wastedOverallError} onRetry={loadWastedOverall} />
            ) : decidedWastedOverall.length === 0 ? (
              <p className="text-sm text-[#4C5266] text-center py-6">No decided Wasted Overall reports yet.</p>
            ) : (
              <div className="space-y-2">
                {decidedWastedOverall.map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06]">
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
                      <PackageX size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white">{wastedItemLabel(r)} — {wastedQuantityLabel(r)}</p>
                        <ActivityStatusPill status={r.status} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#8B93A8]">{shortDateLabel(r.reportedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <SubmitTaskModal activity={editingActivity} onClose={() => setEditingActivity(null)} onSaved={handleSaved} />
      <Toast message={toast} />
    </div>
  );
}
