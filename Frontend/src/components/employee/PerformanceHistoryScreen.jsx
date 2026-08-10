import { ArrowLeft, TrendingUp } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getPerformanceHistory } from "../../services/attendanceService";
import { useAsync } from "../../hooks/useAsync";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function rateTone(rate) {
  if (rate == null) return "text-[#4C5266]";
  if (rate >= 90) return "text-emerald-400";
  if (rate >= 75) return "text-amber-400";
  return "text-red-400";
}

// PerformanceHistoryScreen.jsx — Attendance Rate for each of the last 6
// *completed* calendar months only. The current in-progress month is
// never shown here — there's no real "performance" metric beyond
// Attendance Rate in this app (Employee.performanceRate is unused), and a
// partial current month would misrepresent it as final.
export default function PerformanceHistoryScreen({ onBack }) {
  const { data: history, error, loading, reload } = useAsync(() => getPerformanceHistory({ months: 6 }), { deps: [] });

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1"
      >
        <ArrowLeft size={16} /> Back to Profile
      </button>

      <h1 className="text-lg font-semibold text-white mb-1">Performance History</h1>
      <p className="text-xs text-[#8B93A8] mb-5">Attendance Rate for completed months only.</p>

      {loading ? (
        <SkeletonCard className="h-[300px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <div className="space-y-2.5">
          {history.map(({ year, month, summary }) => (
            <div key={`${year}-${month}`} className="rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  {MONTH_NAMES[month - 1]} {year}
                </p>
                <p className="text-xs text-[#8B93A8] mt-0.5">
                  {summary.totalWorkingDays} working days · {Math.round(summary.totalHoursWorked)}h worked
                </p>
              </div>
              <div className={`flex items-center gap-1.5 text-base font-bold ${rateTone(summary.attendanceRate)}`}>
                <TrendingUp size={15} />
                {summary.attendanceRate == null ? "—" : `${Math.round(summary.attendanceRate)}%`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
