import { useEffect, useState } from "react";
import { BadgeCheck, Clock, Store, CalendarDays, TrendingUp, AlertTriangle } from "lucide-react";
import TaskSubmissionGrid from "../components/workspace/TaskSubmissionGrid";
import SubmitTaskModal from "../components/workspace/SubmitTaskModal";
import TaskStatusTabs from "../components/workspace/TaskStatusTabs";
import { ACTIVITY_SUBMISSION_OPTIONS } from "../data/workspaceData";
import { getProfile } from "../services/profileService";
import { listActivities, deleteActivity } from "../services/activityService";
import { ApiError } from "../services/apiClient";
import { initialsOf } from "../utils/initials";
import { canEditActivity, canDeleteActivity } from "../data/activityRules";

// EmployeeWorkspace.jsx — the entire dashboard for the Employee role. Per
// the design principle ("interface should become simpler as permissions
// decrease"), this deliberately skips zones/markets/other-employees
// entirely: just this employee's own profile and daily work.
//
// Data comes from the backend: GET /api/profile for the header card,
// GET /api/activities for the history list below. The two requests are
// independent of each other, so they're kicked off together with
// Promise.allSettled instead of one being awaited before the next starts
// — that way a slow/failing profile load never delays the activity list
// (or vice versa). Each keeps its own loading/error state so one failing
// doesn't block the other from rendering.

export default function EmployeeWorkspace({ employeeId }) {
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [activities, setActivities] = useState([]);
  const [activitiesError, setActivitiesError] = useState(null);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const [activeOption, setActiveOption] = useState(null); // creating a new activity
  const [editingActivity, setEditingActivity] = useState(null); // editing an existing one
  const [deletingId, setDeletingId] = useState(null); // activity currently being deleted, if any
  const [toast, setToast] = useState(null);

  // Each returns its own promise so the mount effect below can run them
  // together with Promise.allSettled — see the file-level comment.
  const loadProfile = () => {
    setProfileLoading(true);
    setProfileError(null);
    return getProfile()
      .then(setProfile)
      .catch((err) => setProfileError(err instanceof ApiError ? err.message : "Could not load your profile."))
      .finally(() => setProfileLoading(false));
  };

  const loadActivities = () => {
    setActivitiesLoading(true);
    setActivitiesError(null);
    return listActivities()
      .then(setActivities)
      .catch((err) => setActivitiesError(err instanceof ApiError ? err.message : "Could not load your activities."))
      .finally(() => setActivitiesLoading(false));
  };

  useEffect(() => {
    Promise.allSettled([loadProfile(), loadActivities()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

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
    <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto animate-fade-up">
      {/* Profile */}
      {profileLoading && (
        <section className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] animate-pulse h-[124px]" />
      )}
      {!profileLoading && profileError && (
        <ErrorBanner message={profileError} onRetry={loadProfile} />
      )}
      {!profileLoading && !profileError && profile && (
        <section className="rounded-2xl p-6 bg-gradient-to-br from-[#1D2D5C]/50 to-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
          <div className="flex items-center gap-5">
            <div className="relative h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-white/[0.06] overflow-hidden">
              {profile.profilePictureUrl ? (
                <img src={profile.profilePictureUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-display font-bold text-white">{initialsOf(profile.name)}</span>
              )}
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white">{profile.name}</h1>
              <p className="text-[#F47A20] text-sm font-medium">{profile.position}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#9AA1B4]">
                <span className="flex items-center gap-1.5"><BadgeCheck size={13} /> {profile.employeeCode}</span>
                {profile.shift && <span className="flex items-center gap-1.5"><Clock size={13} /> {profile.shift}</span>}
                <span className="flex items-center gap-1.5"><Store size={13} /> {profile.market?.name}</span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={13} />
                  {profile.startDate
                    ? `Joined ${new Date(profile.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : "Start date not set"}
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={13} />
                  {profile.performanceRate != null ? `Performance: ${profile.performanceRate}%` : "Performance: not yet available"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Daily activity submission */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Daily Activities</h2>
        <TaskSubmissionGrid options={ACTIVITY_SUBMISSION_OPTIONS} onSelect={setActiveOption} />
      </section>

      {/* Activity history */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">My Activities</h2>
        {activitiesLoading && (
          <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] animate-pulse h-[220px]" />
        )}
        {!activitiesLoading && activitiesError && (
          <ErrorBanner message={activitiesError} onRetry={loadActivities} />
        )}
        {!activitiesLoading && !activitiesError && (
          <TaskStatusTabs activities={activities} onEdit={handleEdit} onDelete={handleDelete} deletingId={deletingId} />
        )}
      </section>

      <SubmitTaskModal option={activeOption} onClose={() => setActiveOption(null)} onSaved={handleSaved} />
      <SubmitTaskModal activity={editingActivity} onClose={() => setEditingActivity(null)} onSaved={handleSaved} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-xl px-4 py-2.5 bg-[#1F2436] border border-white/10 shadow-2xl text-sm text-white animate-fade-up">
          {toast}
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="rounded-2xl p-5 bg-red-500/5 border border-red-500/20 flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-sm text-red-300"><AlertTriangle size={15} /> {message}</span>
      <button
        onClick={onRetry}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/15 transition-colors duration-150"
      >
        Retry
      </button>
    </div>
  );
}
