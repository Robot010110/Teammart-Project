import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, Droplets } from "lucide-react";
import { SkeletonCard } from "../common/SkeletonCard";
import ErrorBanner from "../common/ErrorBanner";
import MultiPhotoEvidence from "./MultiPhotoEvidence";
import { getMyNightShiftDashboard, updateActivity } from "../../services/nightShiftService";
import { ApiError } from "../../services/apiClient";

// WashingMarketScreen.jsx — Night Shift §11-16: the mandatory Washing
// Market task detail + evidence + submission. This is a generic Night
// Shift task detail screen (keyed off whatever task the caller opens),
// not a Washing-Market-specific architecture — any future task defined
// via NightShiftTaskDefinition renders here the same way.
//
// Frontend validation (the disabled Submit button below minRequired
// photos) is UX only — the real gate is the backend's independent
// re-count on PATCH /api/activities/:id (spec §13). If somehow bypassed
// (a stale count, a race with another tab), the server 400s and this
// screen just shows that error; it never assumes success.
export default function WashingMarketScreen({ basePath }) {
  const { activityId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [task, setTask] = useState(location.state?.task ?? null);
  const [loading, setLoading] = useState(!location.state?.task);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Refresh/reopen without a location.state (e.g. a hard refresh, or
  // arriving via a direct link/notification) — refetch the dashboard and
  // find this exact task by id. Never creates a new instance: the
  // dashboard's own lazy generation is idempotent (skipDuplicates against
  // the same operational date), so re-opening always resolves back to the
  // SAME Activity row, never a duplicate.
  async function loadFromDashboard() {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await getMyNightShiftDashboard();
      const found = dashboard.tasks.find((t) => t.id === activityId);
      if (!found) {
        setError("This task could not be found. It may belong to a previous shift.");
      } else {
        setTask(found);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this task.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!task) loadFromDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  function goBack() {
    navigate(`${basePath}/night-shift`);
  }

  async function handleSubmit() {
    if (!task) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await updateActivity(task.id, { status: "PENDING" });
      setTask((prev) => ({ ...prev, status: "PENDING", label: "Completed", images: updated.images }));
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <SkeletonCard className="h-[420px]" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <ErrorBanner message={error} onRetry={loadFromDashboard} />
      </div>
    );
  }
  if (!task) return null;

  const completed = task.status !== "DRAFT";
  const editable = task.status === "DRAFT";
  const met = task.images.length >= task.minPhotos;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back to Night Shift
      </button>

      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-[#F47A20]/10 text-[#F47A20] shrink-0">
            <Droplets size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white">{task.name}</h1>
            {task.description && <p className="mt-1 text-sm text-[#9AA1B4] leading-relaxed">{task.description}</p>}
          </div>
        </div>

        <div className="mt-4 rounded-xl p-3.5 bg-white/[0.03] border border-white/[0.06] text-xs text-[#9AA1B4] space-y-1">
          <p>Minimum required photos: <span className="text-white font-medium">{task.minPhotos}</span></p>
          <p>Status: <span className="text-white font-medium">{task.label}</span></p>
        </div>
      </div>

      {completed ? (
        <div className="mt-5 rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
          <div className="flex items-center gap-2 text-emerald-400 mb-4">
            <CheckCircle2 size={18} />
            <p className="text-sm font-semibold">Washing Market completed and submitted</p>
          </div>
          <p className="text-xs text-[#8B93A8] mb-3">
            Posted automatically to your market's Night Shift group and sent to your Supervisor.
          </p>
          <MultiPhotoEvidence activityId={task.id} images={task.images} minRequired={task.minPhotos} editable={false} onImagesChanged={() => {}} />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
          <MultiPhotoEvidence
            activityId={task.id}
            images={task.images}
            minRequired={task.minPhotos}
            editable
            onImagesChanged={(images) => setTask((prev) => ({ ...prev, images, photoCount: images.length }))}
          />

          {submitError && <p className="mt-4 text-xs text-red-400">{submitError}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!met || submitting}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200 shadow-lg shadow-orange-900/20"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {submitting ? "Submitting..." : met ? "Submit Washing Market" : `Add ${task.minPhotos - task.images.length} more photo(s) to submit`}
          </button>
        </div>
      )}
    </div>
  );
}
