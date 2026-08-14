import { useMemo, useState } from "react";
import { useAsync } from "./useAsync";
import { listActivities, createActivity, updateActivity } from "../services/activityService";
import { ApiError } from "../services/apiClient";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowTimeLabel() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// useTodaysActivityStatus.js — the "see my department, start, complete"
// business logic shared by Cleaning Shelves / Facing / Refilling,
// extracted out of what used to be DailyStatusFlow.jsx so the same
// fetch/start/complete logic can back both a compact tile (status badge)
// and its detail modal without duplicating the Activity create/update
// calls. There is no dedicated backend state machine for this — it's the
// existing Activity model's DRAFT/PENDING statuses reframed here:
//   no activity for today of this category -> Not Started
//   a DRAFT row for today                  -> In Progress
//   a PENDING (submitted) row for today     -> Completed
// (see backend ActivityCategory: FACING/REFILLING/SHELF_CLEANING.)
export function useTodaysActivityStatus(category) {
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

  async function start() {
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

  async function complete() {
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

  return { status, loading, error, actionError, busy, start, complete, reload };
}
