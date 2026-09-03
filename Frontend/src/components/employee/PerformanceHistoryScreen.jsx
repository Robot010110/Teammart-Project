import { Clock3, PackageX } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import ActivityStatusPill from "../common/ActivityStatusPill";
import TaskStatusTabs from "../workspace/TaskStatusTabs";
import SubmitTaskModal from "../workspace/SubmitTaskModal";
import PerformanceHeader from "./performance/PerformanceHeader";
import PerformanceHero from "./performance/PerformanceHero";
import PerformanceTrendChart from "./performance/PerformanceTrendChart";
import ConsistencyChart from "./performance/ConsistencyChart";
import PerformanceBreakdown from "./performance/PerformanceBreakdown";
import RecentReviews from "./performance/RecentReviews";
import HighlightsCard from "./performance/HighlightsCard";
import PerformanceSkeleton from "./performance/PerformanceSkeleton";
import { getPerformanceSummary, getActivityPerformanceHistory, listActivities, deleteActivity } from "../../services/activityService";
import { listMyExtraHoursRequests, getPerformanceHistory as getAttendancePerformanceHistory } from "../../services/attendanceService";
import { listMyWastedOverallReports } from "../../services/wastedOverallService";
import { ApiError } from "../../services/apiClient";
import { canEditActivity, canDeleteActivity } from "../../data/activityRules";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";
import { useRef, useState } from "react";

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

// PerformanceHistoryScreen.jsx — the Employee Performance page, reached
// from Profile -> Performance. Composed from ./performance/*, in the
// order the design calls for: centered header, Overall Score hero,
// Performance Trend, Activity Consistency, Performance Breakdown, Recent
// Reviews, Your Highlights — then the record-keeping sections this
// screen has always hosted (My Activities, Extra Hours, Wasted Overall),
// which are unchanged and were deliberately kept rather than dropped in
// the redesign.
//
// The metric itself is untouched: approved / (approved + rejected)
// reviewed Activities, DRAFT/PENDING excluded, computed server-side in
// activitiesController.computeActivityPerformance. Nothing here
// recalculates performance — the visual layer only presents what the
// backend already returns.
//
// Every figure on this page is real:
//   GET /api/activities/performance          overall rate + status counts
//   GET /api/activities/performance-history  weekly/monthly trend buckets
//   GET /api/activities                      consistency + recent reviews
//   GET /api/attendance/performance-history  the Attendance breakdown card
// The first two are the same endpoints this screen already used; the
// last two are lists the page was already loading or that already exist.
// No endpoint was added and no controller was modified for this redesign.
//
// Loading/error handling is intentionally per-section rather than
// page-wide: a failure fetching, say, the attendance rate degrades that
// one metric card to an em dash instead of replacing the whole page with
// an error, and nothing ever substitutes placeholder numbers for data
// that failed to load.
export default function PerformanceHistoryScreen({ onBack }) {
  const { data: summary, error: summaryError, loading: summaryLoading, reload: reloadSummary } = useAsync(
    getPerformanceSummary,
    { deps: [] }
  );
  // 8 weeks (up from 4) so the trend chart has a readable curve and the
  // streak/best-week highlights have a real window to look back over.
  // The backend already caps this at 12 — no change needed there.
  const { data: history, error: historyError, loading: historyLoading, reload: reloadHistory } = useAsync(
    () => getActivityPerformanceHistory({ weeks: 8, months: 6 }),
    { deps: [] }
  );
  // Attendance Rate for the Performance Breakdown. 6 months so the card's
  // sparkline has a real series and its month-over-month delta is a true
  // comparison — this endpoint only ever reports COMPLETED months, so the
  // most recent entry is the latest finished one, never a partial figure.
  // Loaded independently so a failure here degrades only that one metric
  // card rather than the page.
  const { data: attendanceHistory, error: attendanceError } = useAsync(
    () => getAttendancePerformanceHistory({ months: 6 }),
    { deps: [], fallbackError: "Could not load attendance rate." }
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

  // Set when a hero status card is tapped: scrolls to My Activities and
  // opens it on the matching tab (§9 drill-down).
  const [requestedTab, setRequestedTab] = useState(null);
  const activitiesRef = useRef(null);

  const handleStatusSelect = (tab) => {
    setRequestedTab(tab);
    activitiesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="px-4 sm:px-6 pb-6 max-w-4xl mx-auto animate-fade-up">
      <PerformanceHeader onBack={onBack} />

      {loading ? (
        <div className="mt-6">
          <PerformanceSkeleton />
        </div>
      ) : error ? (
        <div className="mt-6">
          <ErrorBanner message={error} onRetry={() => { reloadSummary(); reloadHistory(); }} />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <PerformanceHero summary={summary} weekly={history.weekly} onStatusSelect={handleStatusSelect} />

          {/* The trend's Week view and the consistency bars both read the
              same activity list this page already loads for Recent
              Reviews — no extra request for either. */}
          <PerformanceTrendChart activities={activities} monthly={history.monthly} />

          {activities && <ConsistencyChart activities={activities} />}

          <PerformanceBreakdown
            summary={summary}
            weekly={history.weekly}
            attendanceHistory={attendanceHistory}
            attendanceError={attendanceError}
            onViewAll={() => handleStatusSelect("Approved")}
          />

          {!activitiesLoading && !activitiesError && activities && (
            <RecentReviews activities={activities} onSeeAll={() => handleStatusSelect("Approved")} />
          )}

          <HighlightsCard weekly={history.weekly} activities={activities} />

          <section ref={activitiesRef} className="scroll-mt-4">
            <h2 className="mb-3 text-sm font-semibold text-white">My Activities</h2>
            {activitiesLoading && <SkeletonCard className="h-[220px]" />}
            {!activitiesLoading && activitiesError && <ErrorBanner message={activitiesError} onRetry={loadActivities} />}
            {!activitiesLoading && !activitiesError && activities && (
              <TaskStatusTabs
                activities={activities}
                onEdit={handleEdit}
                onDelete={handleDelete}
                deletingId={deletingId}
                requestedTab={requestedTab}
              />
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-white">Extra Hours</h2>
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

          <section>
            <h2 className="mb-3 text-sm font-semibold text-white">Wasted Overall</h2>
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
        </div>
      )}

      <SubmitTaskModal activity={editingActivity} onClose={() => setEditingActivity(null)} onSaved={handleSaved} />
      <Toast message={toast} />
    </div>
  );
}
