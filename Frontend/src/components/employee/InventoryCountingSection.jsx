import { useState } from "react";
import { ClipboardList, MapPin, ShieldCheck, Clock, Camera } from "lucide-react";
import InventoryCountingFlow from "./InventoryCountingFlow";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import ActivityStatusPill from "../common/ActivityStatusPill";
import { getMyAssignment } from "../../services/countingAssignmentService";
import { listActivities } from "../../services/activityService";
import { useAsync } from "../../hooks/useAsync";

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// InventoryCountingSection.jsx — spec §1-4: shows the employee's current
// counting assignment (their own department by default, or whatever a
// Supervisor explicitly assigned — see countingAssignmentsController.js)
// with a clear verification indicator for a cross-department assignment
// (spec §3: "a visible verification indicator... so management can
// immediately know"), a "Submit Inventory Count" entry point, and recent
// submissions from this employee's own Activity history.
export default function InventoryCountingSection() {
  const { data: assignment, error: assignmentError, loading: assignmentLoading } = useAsync(getMyAssignment, { deps: [] });
  const { data: activities, setData: setActivities, error: activitiesError, loading: activitiesLoading } = useAsync(
    () => listActivities({ category: "ITEM_COUNTING" }),
    { deps: [] }
  );
  const [flowOpen, setFlowOpen] = useState(false);

  function handleSaved(activity) {
    setActivities((prev) => [activity, ...(prev ?? [])]);
  }

  if (assignmentLoading) return <SkeletonCard className="h-[140px]" />;
  if (assignmentError) return <ErrorBanner message={assignmentError} />;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]">
              <ClipboardList size={11} /> Assigned Department
            </p>
            <p className="mt-1 text-base font-semibold text-white">{assignment.assignedDepartment || "Not assigned"}</p>
            {assignment.countingArea && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#9AA1B4]">
                <MapPin size={12} /> {assignment.countingArea}
              </p>
            )}
          </div>
          {assignment.needsVerification && (
            <span
              className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                assignment.verifiedAt ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
              }`}
            >
              <ShieldCheck size={11} /> {assignment.verifiedAt ? "Verified" : "Pending Verification"}
            </span>
          )}
        </div>
        {assignment.assignedBy && (
          <p className="mt-3 text-[11px] text-[#4C5266]">
            Assigned by {assignment.assignedBy.name}
            {assignment.originalDepartment && assignment.originalDepartment !== assignment.assignedDepartment
              ? ` — your usual department is ${assignment.originalDepartment}`
              : ""}
          </p>
        )}

        <button
          type="button"
          onClick={() => setFlowOpen(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-150"
        >
          <Camera size={14} /> Submit Inventory Count
        </button>
      </div>

      {activitiesLoading ? (
        <SkeletonCard className="h-16" />
      ) : activitiesError ? (
        <ErrorBanner message={activitiesError} />
      ) : activities?.length > 0 ? (
        <div className="space-y-2">
          {activities.slice(0, 5).map((a) => (
            <div key={a.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-white">
                  {a.countingAssignment?.assignedDepartment ?? "Inventory Count"}
                  {a.countingAssignment?.countingArea ? ` — ${a.countingAssignment.countingArea}` : ""}
                </span>
                <ActivityStatusPill status={a.status} />
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8B93A8]">
                <Clock size={11} /> {dateLabel(a.date)} · {a.time}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <InventoryCountingFlow open={flowOpen} onClose={() => setFlowOpen(false)} assignment={assignment} onSaved={handleSaved} />
    </div>
  );
}
