import { Clock3, PackageX } from "lucide-react";
import { useTranslation } from "react-i18next";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import ActivityStatusPill from "../common/ActivityStatusPill";
import TaskStatusTabs from "../workspace/TaskStatusTabs";
import SubmitTaskModal from "../workspace/SubmitTaskModal";
import PerformanceHeader from "./performance/PerformanceHeader";
import PerformancePanel from "./performance/PerformancePanel";
import RecentReviews from "./performance/RecentReviews";
import { listActivities, deleteActivity } from "../../services/activityService";
import { listMyExtraHoursRequests } from "../../services/attendanceService";
import {
  getMyPerformance, getMyPerformanceHistory, getMyPerformanceAggregate,
} from "../../services/performanceService";
import { listMyWastedOverallReports } from "../../services/wastedOverallService";
import { ApiError } from "../../services/apiClient";
import { canEditActivity, canDeleteActivity } from "../../data/activityRules";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";
import { useRef, useState } from "react";

const WASTED_ITEM_LABEL = { EGGS: "emp.eggs", TOMATO: "emp.tomato", POTATO: "emp.potato", CUCUMBER: "emp.cucumber", ONION: "emp.onion", OTHER: "emp.other" };
// Takes `t`: this sits at module scope, where the hook's `t` does not exist.
function wastedItemLabel(report, t) {
  if (report.item === "OTHER" && report.otherItemName) return report.otherItemName;
  return WASTED_ITEM_LABEL[report.item] ? t(WASTED_ITEM_LABEL[report.item]) : report.item;
}
function wastedQuantityLabel(report, t) {
  return report.item === "EGGS"
    ? t("emp.eggCountEmp", { count: report.quantityCount })
    : t("emp.kgAmountEmp", { count: report.quantityKg });
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
// The score is the five-category /100 figure computed entirely server
// side by the Performance engine. Nothing here recalculates performance —
// the visual layer only presents what the backend already decided, and
// says so honestly ("no data for this period") when there is nothing to
// present rather than showing a zero.
//
// Every figure on this page is real:
//   GET /api/performance/me            current month + streaks
//   GET /api/performance/me/history    weekly (13) and monthly (12) history
//   GET /api/performance/me/aggregate  the 6-month and 1-year figures
//   GET /api/activities                Recent Reviews + My Activities
//
// Correction severity and internal quality points are stripped by the API
// itself before they reach this screen (see performanceView.js), so there
// is nothing sensitive here for the UI to have to remember to hide.
export default function PerformanceHistoryScreen({ onBack }) {
  const { t } = useTranslation();
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
      setToast(t("emp.draftDeleted"));
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

  // The performance panel owns its own loading/error state per section,
  // so a failure there degrades that card rather than the whole page.

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

      {(
        <div className="mt-6 space-y-6">
          <PerformancePanel
            loadCurrent={getMyPerformance}
            loadHistory={getMyPerformanceHistory}
            loadAggregate={getMyPerformanceAggregate}
          />

          {!activitiesLoading && !activitiesError && activities && (
            <RecentReviews activities={activities} onSeeAll={() => handleStatusSelect(t("emp.approved"))} />
          )}

          <section ref={activitiesRef} className="scroll-mt-4">
            <h2 className="mb-3 text-sm font-semibold text-white">{t("emp.myActivities")}</h2>
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
            <h2 className="mb-3 text-sm font-semibold text-white">{t("emp.extraHours")}</h2>
            {extraHoursLoading ? (
              <SkeletonCard className="h-[100px]" />
            ) : extraHoursError ? (
              <ErrorBanner message={extraHoursError} onRetry={loadExtraHours} />
            ) : decidedExtraHours.length === 0 ? (
              <p className="text-sm text-[#4C5266] text-center py-6">{t("emp.noDecidedExtraHoursRequestsYet")}</p>
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
            <h2 className="mb-3 text-sm font-semibold text-white">{t("emp.wastedOverall")}</h2>
            {wastedOverallLoading ? (
              <SkeletonCard className="h-[100px]" />
            ) : wastedOverallError ? (
              <ErrorBanner message={wastedOverallError} onRetry={loadWastedOverall} />
            ) : decidedWastedOverall.length === 0 ? (
              <p className="text-sm text-[#4C5266] text-center py-6">{t("emp.noDecidedWastedOverallReportsYet")}</p>
            ) : (
              <div className="space-y-2">
                {decidedWastedOverall.map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06]">
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
                      <PackageX size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white">{wastedItemLabel(r, t)} — {wastedQuantityLabel(r, t)}</p>
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

      {/* key forces a fresh SubmitTaskModal instance per edited activity —
          see the same comment at WorkerActivityTab.jsx's call site. */}
      <SubmitTaskModal key={editingActivity?.id ?? "none"} activity={editingActivity} onClose={() => setEditingActivity(null)} onSaved={handleSaved} />
      <Toast message={toast} />
    </div>
  );
}
