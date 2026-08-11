import { useState } from "react";
import { Sparkles, Rows3, PackagePlus, Tag, ChevronRight, PackageX } from "lucide-react";
import TaskSubmissionGrid from "../workspace/TaskSubmissionGrid";
import SubmitTaskModal from "../workspace/SubmitTaskModal";
import TaskStatusTabs from "../workspace/TaskStatusTabs";
import ItemReportSection from "./ItemReportSection";
import DailyStatusFlow from "./DailyStatusFlow";
import ShelfLabelFlow from "./ShelfLabelFlow";
import WastedOverallFlow from "./WastedOverallFlow";
import ActivityStatusPill from "../common/ActivityStatusPill";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import { ACTIVITY_SUBMISSION_OPTIONS } from "../../data/workspaceData";
import { listActivities, deleteActivity } from "../../services/activityService";
import { listMyWastedOverallReports } from "../../services/wastedOverallService";
import { ApiError } from "../../services/apiClient";
import { canEditActivity, canDeleteActivity } from "../../data/activityRules";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

const WASTED_ITEM_LABEL = { EGGS: "Eggs", TOMATO: "Tomato", POTATO: "Potato", CUCUMBER: "Cucumber", ONION: "Onion" };

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// WorkerActivityTab.jsx — the Activity tab's content for Worker
// employees. Everything EmployeeWorkspace.jsx's old "Daily Activities" +
// "My Activities" sections did (TaskSubmissionGrid, SubmitTaskModal,
// TaskStatusTabs, edit/delete rules) is preserved as-is here, plus:
// Expired/Wasted (reused verbatim), Shelf Labels (new structured flow),
// and Cleaning Shelves/Facing/Refilling (new Not Started/In Progress/
// Completed status flow) — see DailyStatusFlow.jsx and
// ShelfLabelFlow.jsx.
export default function WorkerActivityTab() {
  const {
    data: activities,
    setData: setActivities,
    error: activitiesError,
    loading: activitiesLoading,
    reload: loadActivities,
  } = useAsync(listActivities, { fallbackError: "Could not load your activities." });

  const {
    data: wastedReports,
    setData: setWastedReports,
    error: wastedError,
    loading: wastedLoading,
    reload: loadWastedReports,
  } = useAsync(listMyWastedOverallReports, { fallbackError: "Could not load your waste reports." });

  const [activeOption, setActiveOption] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [labelFlowOpen, setLabelFlowOpen] = useState(false);
  const [wastedFlowOpen, setWastedFlowOpen] = useState(false);
  const [toast, setToast] = useToast();

  function handleWastedSaved(report, message) {
    setWastedReports((prev) => [report, ...(prev ?? [])]);
    setToast(message);
  }

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

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Daily Activity</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Expired & Wasted Items</h2>
        <ItemReportSection />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Shelf Labels</h2>
        <button
          type="button"
          onClick={() => setLabelFlowOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl hover:border-[#F47A20]/25 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
              <Tag size={18} />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Report a Label Issue</p>
              <p className="text-xs text-[#8B93A8]">Scan or search a product</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[#4C5266]" />
        </button>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Wasted Overall</h2>
        <button
          type="button"
          onClick={() => setWastedFlowOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl hover:border-[#F47A20]/25 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
              <PackageX size={18} />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Report Wasted Produce</p>
              <p className="text-xs text-[#8B93A8]">Eggs, Tomato, Potato, Cucumber, Onion</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[#4C5266]" />
        </button>

        {wastedLoading ? (
          <div className="mt-3"><SkeletonCard className="h-16" /></div>
        ) : wastedError ? (
          <div className="mt-3"><ErrorBanner message={wastedError} onRetry={loadWastedReports} /></div>
        ) : wastedReports?.length ? (
          <div className="mt-3 space-y-2">
            {wastedReports.slice(0, 5).map((r) => (
              <div key={r.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white">{WASTED_ITEM_LABEL[r.item]} — {r.quantityKg}kg</span>
                  <ActivityStatusPill status={r.status} />
                </div>
                <p className="mt-1 text-xs text-[#8B93A8]">{dateLabel(r.reportedAt)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Today's Department Tasks</h2>
        <DailyStatusFlow category="SHELF_CLEANING" label="Cleaning Shelves" icon={Sparkles} />
        <DailyStatusFlow category="FACING" label="Facing" icon={Rows3} description="Bring products to the front of the shelf" />
        <DailyStatusFlow category="REFILLING" label="Refilling" icon={PackagePlus} description="Restock empty shelf spots" />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Other Daily Activities</h2>
        <TaskSubmissionGrid options={ACTIVITY_SUBMISSION_OPTIONS} onSelect={setActiveOption} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">My Activities</h2>
        {activitiesLoading && <SkeletonCard className="h-[220px]" />}
        {!activitiesLoading && activitiesError && <ErrorBanner message={activitiesError} onRetry={loadActivities} />}
        {!activitiesLoading && !activitiesError && activities && (
          <TaskStatusTabs activities={activities} onEdit={handleEdit} onDelete={handleDelete} deletingId={deletingId} />
        )}
      </section>

      <SubmitTaskModal option={activeOption} onClose={() => setActiveOption(null)} onSaved={handleSaved} />
      <SubmitTaskModal activity={editingActivity} onClose={() => setEditingActivity(null)} onSaved={handleSaved} />
      <ShelfLabelFlow open={labelFlowOpen} onClose={() => setLabelFlowOpen(false)} onSaved={handleSaved} />
      <WastedOverallFlow open={wastedFlowOpen} onClose={() => setWastedFlowOpen(false)} onSaved={handleWastedSaved} />

      <Toast message={toast} />
    </div>
  );
}
