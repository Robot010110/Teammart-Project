import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAsync } from "../../hooks/useAsync";

const DOT = { EXTRA_WORK_APPROVED: "🟢", EXTRA_WORK_PENDING: "🟡", EXTRA_WORK_REJECTED: "🔴", PUNISHMENT: "🔴" };

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function rowLabel(entry) {
  if (entry.type === "PUNISHMENT") {
    return { dot: DOT.PUNISHMENT, title: "Punishment", suffix: "" };
  }
  const dot = entry.status === "APPROVED" ? DOT.EXTRA_WORK_APPROVED : entry.status === "REJECTED" ? DOT.EXTRA_WORK_REJECTED : DOT.EXTRA_WORK_PENDING;
  const suffix = entry.status === "PENDING" ? " — Pending Approval" : entry.status === "REJECTED" ? " — Rejected" : "";
  return { dot, title: "Extra Work", suffix };
}

// AttendanceHistoryList.jsx — Profile → Attendance → History (spec §13):
// real Extra Work submissions (any status) + real Punishment entries,
// newest first, straight from GET /api/attendance/history. Nothing here
// is hardcoded — an empty list just means no adjustments exist yet for
// this employee.
export default function AttendanceHistoryList() {
  const { data: entries, error, loading, reload } = useAsync(() => getAttendanceHistory({ months: 6 }), {
    fallbackError: "Could not load your attendance history.",
  });

  if (loading) return <SkeletonCard className="h-[160px]" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!entries || entries.length === 0) {
    return <p className="text-sm text-[#4C5266] text-center py-8">No attendance history yet.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const { dot, title, suffix } = rowLabel(entry);
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
          </div>
        );
      })}
    </div>
  );
}
