import { useState } from "react";
import { BadgeCheck, Clock, Store, TrendingUp } from "lucide-react";
import TaskSubmissionGrid from "../components/workspace/TaskSubmissionGrid";
import SubmitTaskModal from "../components/workspace/SubmitTaskModal";
import TaskStatusTabs from "../components/workspace/TaskStatusTabs";
import SuddenTasksSection from "../components/employee/SuddenTasksSection";
import ItemReportSection from "../components/employee/ItemReportSection";
import AttendanceSection from "../components/employee/AttendanceSection";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import Toast from "../components/common/Toast";
import { ACTIVITY_SUBMISSION_OPTIONS } from "../data/workspaceData";
import { getProfile } from "../services/profileService";
import { listActivities, deleteActivity } from "../services/activityService";
import { ApiError } from "../services/apiClient";
import { initialsOf } from "../utils/initials";
import { canEditActivity, canDeleteActivity } from "../data/activityRules";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../hooks/useToast";

// EmployeeWorkspace.jsx — the entire dashboard for the Employee role. Per
// the design principle ("interface should become simpler as permissions
// decrease"), this deliberately skips zones/markets/other-employees
// entirely: just this employee's own profile and daily work.
//
// Data comes from the backend: GET /api/profile for the header card,
// GET /api/activities for the history list below. Each uses its own
// useAsync() call, so they load independently (a slow/failing profile
// load never delays the activity list, or vice versa) without needing an
// explicit Promise.allSettled — two independent effects firing on mount
// already run concurrently.

export default function EmployeeWorkspace({ employeeId }) {
  const {
    data: profile,
    error: profileError,
    loading: profileLoading,
    reload: loadProfile,
  } = useAsync(getProfile, { deps: [employeeId], fallbackError: "Could not load your profile." });

  const {
    data: activities,
    setData: setActivities,
    error: activitiesError,
    loading: activitiesLoading,
    reload: loadActivities,
  } = useAsync(listActivities, { deps: [employeeId], fallbackError: "Could not load your activities." });

  const [activeOption, setActiveOption] = useState(null); // creating a new activity
  const [editingActivity, setEditingActivity] = useState(null); // editing an existing one
  const [deletingId, setDeletingId] = useState(null); // activity currently being deleted, if any
  const [toast, setToast] = useToast();

  // TODO(notifications): this toast is a local, in-memory "did it work"
  // message that disappears on its own — it is NOT a real notification
  // system (nothing is stored, nothing survives a refresh, nothing tells
  // the employee about events that happen while they're not looking, e.g.
  // a Supervisor rejecting an activity). Replace with real notifications
  // once that backend feature exists.
  const handleSaved = (activity, message) => {
    setActivities((prev) => {
      const exists = prev.some((a) => a.id === activity.id);
      return exists ? prev.map((a) => (a.id === activity.id ? activity : a)) : [activity, ...prev];
    });
    setToast(message);
  };

  const handleDelete = async (activity) => {
    // Belt-and-suspenders: TaskStatusTabs already only renders the Delete
    // button for a Draft (see canDeleteActivity), so this should be
    // unreachable for anything else — but re-checking here means this
    // function is safe to call from anywhere, not just that one button,
    // without silently trusting the caller got it right.
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
    // Same belt-and-suspenders reasoning as handleDelete above.
    if (!canEditActivity(activity)) {
      setToast(`This activity is already ${activity.status.toLowerCase()} and can no longer be edited.`);
      return;
    }
    setEditingActivity(activity);
  };

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 sm:py-8 max-w-4xl mx-auto animate-fade-up">
      {/* Profile */}
      {profileLoading && <SkeletonCard className="h-[124px]" />}
      {!profileLoading && profileError && (
        <ErrorBanner message={profileError} onRetry={loadProfile} />
      )}
      {!profileLoading && !profileError && profile && (
        <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[#1D2D5C]/50 to-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-white/[0.06] overflow-hidden">
              {profile.profilePictureUrl ? (
                <img src={profile.profilePictureUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-base sm:text-lg font-display font-bold text-white">{initialsOf(profile.name)}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">{profile.name}</h1>
              <p className="text-[#F47A20] text-sm font-medium">{profile.position}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#9AA1B4]">
                <span className="flex items-center gap-1.5"><BadgeCheck size={13} /> {profile.employeeCode}</span>
                {profile.shift && <span className="flex items-center gap-1.5"><Clock size={13} /> {profile.shift}</span>}
                <span className="flex items-center gap-1.5"><Store size={13} /> {profile.market?.name}</span>
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={13} />
                  {profile.performanceRate != null ? `Performance: ${profile.performanceRate}%` : "Performance: not yet available"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sudden Tasks — urgent, supervisor-pushed, separate from Activities */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Sudden Tasks</h2>
        <SuddenTasksSection />
      </section>

      {/* Expired & Wasted Items — one of the primary activity categories,
          but its own section (not a TaskSubmissionGrid tile) since the
          barcode/photo -> product-search -> quantity flow is materially
          more than the other categories' single-form modal */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Expired & Wasted Items</h2>
        <ItemReportSection />
      </section>

      {/* Daily activity submission */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Daily Activities</h2>
        <TaskSubmissionGrid options={ACTIVITY_SUBMISSION_OPTIONS} onSelect={setActiveOption} />
      </section>

      {/* Activity history */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">My Activities</h2>
        {activitiesLoading && <SkeletonCard className="h-[220px]" />}
        {!activitiesLoading && activitiesError && (
          <ErrorBanner message={activitiesError} onRetry={loadActivities} />
        )}
        {!activitiesLoading && !activitiesError && activities && (
          <TaskStatusTabs activities={activities} onEdit={handleEdit} onDelete={handleDelete} deletingId={deletingId} />
        )}
      </section>

      {/* Attendance — worked hours, not a task; reference info, so it sits last */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Attendance</h2>
        <AttendanceSection />
      </section>

      <SubmitTaskModal option={activeOption} onClose={() => setActiveOption(null)} onSaved={handleSaved} />
      <SubmitTaskModal activity={editingActivity} onClose={() => setEditingActivity(null)} onSaved={handleSaved} />

      <Toast message={toast} />
    </div>
  );
}
