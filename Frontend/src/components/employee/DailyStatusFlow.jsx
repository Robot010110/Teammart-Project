import { useMemo, useState } from "react";
import { Play, CheckCircle2, Loader2 } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { listActivities, createActivity, updateActivity } from "../../services/activityService";
import { ApiError } from "../../services/apiClient";
import { SkeletonCard } from "../common/SkeletonCard";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeLabel() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// DailyStatusFlow.jsx — a self-initiated "see my department, start,
// complete" flow shared by Cleaning Shelves / Facing / Refilling. There
// is no dedicated backend state machine for this — it's the existing
// Activity model's DRAFT/PENDING statuses reframed in the UI:
//   no activity for today of this category -> Not Started
//   a DRAFT row for today                  -> In Progress
//   a PENDING (submitted) row for today     -> Completed
// (see backend ActivityCategory: FACING/REFILLING are new values added
// specifically for this; SHELF_CLEANING already existed.)
export default function DailyStatusFlow({ category, label, icon: Icon, description }) {
  const { data: activities, setData: setActivities, error, loading, reload } = useAsync(
    () => listActivities({ category }),
    { deps: [category] }
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const today = todayISO();
  const todaysActivity = useMemo(
    () => activities?.find((a) => a.date.slice(0, 10) === today && a.status !== "REJECTED"),
    [activities, today]
  );

  const status = !todaysActivity ? "NOT_STARTED" : todaysActivity.status === "DRAFT" ? "IN_PROGRESS" : "COMPLETED";

  async function handleStart() {
    setBusy(true);
    setActionError(null);
    try {
      const created = await createActivity({ category, date: today, time: nowTimeLabel(), status: "DRAFT" });
      setActivities((prev) => [created, ...(prev ?? [])]);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not start this task.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!todaysActivity) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await updateActivity(todaysActivity.id, { status: "PENDING" });
      setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not mark this complete.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <SkeletonCard className="h-[124px]" />;

  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20] shrink-0">
            <Icon size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{label}</p>
            {description && <p className="text-xs text-[#8B93A8] mt-0.5">{description}</p>}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {(error || actionError) && <p className="mt-3 text-xs text-red-400">{error || actionError}</p>}

      <div className="mt-4">
        {status === "NOT_STARTED" && (
          <button
            type="button"
            onClick={handleStart}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:opacity-50 transition-colors duration-200"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {busy ? "Starting..." : "Start"}
          </button>
        )}
        {status === "IN_PROGRESS" && (
          <button
            type="button"
            onClick={handleComplete}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:opacity-50 transition-colors duration-200"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {busy ? "Submitting..." : "Mark Complete"}
          </button>
        )}
        {status === "COMPLETED" && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 py-1">
            <CheckCircle2 size={13} /> Completed today
          </p>
        )}
        {error && (
          <button type="button" onClick={reload} className="mt-2 w-full text-center text-xs text-[#9AA1B4] hover:text-white">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const style = {
    NOT_STARTED: "bg-white/5 text-[#9AA1B4] ring-white/10",
    IN_PROGRESS: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    COMPLETED: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  }[status];
  const text = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", COMPLETED: "Completed" }[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ring-inset ${style}`}>
      {text}
    </span>
  );
}
