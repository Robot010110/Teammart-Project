import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getAttendanceHistory, deleteMyExtraHoursRequest, deleteMyPunishment } from "../../services/attendanceService";
import { useAsync } from "../../hooks/useAsync";
import { ApiError } from "../../services/apiClient";

const DOT = { EXTRA_WORK_APPROVED: "🟢", EXTRA_WORK_PENDING: "🟡", EXTRA_WORK_REJECTED: "🔴", PUNISHMENT: "🔴" };
const MANUAL_CLEAR_AFTER_DAYS = 14;

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysSince(iso) {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function rowLabel(entry) {
  if (entry.type === "PUNISHMENT") {
    return { dot: DOT.PUNISHMENT, title: "Punishment", suffix: "" };
  }
  const dot = entry.status === "APPROVED" ? DOT.EXTRA_WORK_APPROVED : entry.status === "REJECTED" ? DOT.EXTRA_WORK_REJECTED : DOT.EXTRA_WORK_PENDING;
  const suffix = entry.status === "PENDING" ? " — Pending Approval" : entry.status === "REJECTED" ? " — Rejected" : "";
  return { dot, title: "Extra Work", suffix };
}

// AttendanceHistoryList.jsx — Profile → Attendance → History: real
// Punishment entries (deletable by the employee once
// MANUAL_CLEAR_AFTER_DAYS old — see
// attendanceController.deleteMyPunishment; also eventually cleared
// automatically after 30 days regardless) + only STILL-PENDING Extra
// Work submissions (cancellable any time, since it's the employee's own
// undecided request). Once an Extra Work request is Approved/Rejected it
// leaves this "active" list immediately — it isn't lost, it's shown from
// that point on in Profile → Performance History's own Extra Hours
// section instead. Nothing here is hardcoded — an empty list just means
// nothing pending/undismissed exists.
export default function AttendanceHistoryList() {
  const { data: rawEntries, error, loading, reload } = useAsync(() => getAttendanceHistory({ months: 6 }), {
    fallbackError: "Could not load your attendance history.",
  });
  const entries = rawEntries?.filter((entry) => entry.type !== "EXTRA_WORK" || entry.status === "PENDING");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function handleDelete(entry) {
    setBusyId(entry.id);
    setActionError(null);
    try {
      if (entry.type === "PUNISHMENT") {
        await deleteMyPunishment(entry.id);
      } else {
        await deleteMyExtraHoursRequest(entry.id);
      }
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not delete this.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <SkeletonCard className="h-[160px]" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!entries || entries.length === 0) {
    return <p className="text-sm text-[#4C5266] text-center py-8">No attendance history yet.</p>;
  }

  return (
    <div className="space-y-2">
      {actionError && <p className="text-xs text-red-400">{actionError}</p>}
      {entries.map((entry) => {
        const { dot, title, suffix } = rowLabel(entry);
        // Extra Work is always cancellable (only PENDING ones are ever
        // shown here); Punishment only once it's genuinely old — a fresh
        // one stays staff-only to remove.
        const canDelete = entry.type !== "PUNISHMENT" || daysSince(entry.date) >= MANUAL_CLEAR_AFTER_DAYS;
        return (
          <div key={entry.id} className="flex items-start gap-2.5 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06]">
            <span className="text-sm leading-5 shrink-0">{dot}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white">
                {title} — {entry.hours}h{suffix}
              </p>
              <p className="mt-0.5 text-[11px] text-[#8B93A8]">
                {dateLabel(entry.date)}
                {entry.reason ? ` · ${entry.reason}` : ""}
              </p>
            </div>
            {canDelete && (
              <button
                type="button"
                onClick={() => handleDelete(entry)}
                disabled={busyId === entry.id}
                aria-label="Delete"
                className="shrink-0 p-1.5 rounded-lg text-[#4C5266] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                {busyId === entry.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
