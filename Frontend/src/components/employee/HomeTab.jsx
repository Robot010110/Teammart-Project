import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, ChevronRight, Moon } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ProfileHeaderCard from "./ProfileHeaderCard";
import PerformanceCircle from "./PerformanceCircle";
import PerformanceHistoryScreen from "./PerformanceHistoryScreen";
import AttendanceSection from "./AttendanceSection";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getProfile } from "../../services/profileService";
import { getPerformanceSummary } from "../../services/activityService";
import { listSuddenTasks } from "../../services/suddenTaskService";

function TaskCountTile({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 flex flex-col items-center justify-center gap-2 rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl active:bg-[#1A1F33] transition-colors"
    >
      <span className="w-11 h-11 rounded-full bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
        <ClipboardList size={18} />
      </span>
      <span className="flex items-center gap-1 text-lg font-bold text-white">
        {count == null ? "—" : count}
        <ChevronRight size={14} className="text-[#4C5266]" />
      </span>
      <span className="text-xs font-medium text-[#9AA1B4]">Active Tasks</span>
    </button>
  );
}

// HomeTab.jsx — the Worker/Cashier personal dashboard:
// Profile header (identity, department, WhatsApp)
//   -> Performance (real circular indicator, tap for history)
//   -> Attendance (the full monthly summary + calendar + day-off request,
//      visible right here rather than requiring navigation elsewhere).
//
// The Notifications preview section that used to live here is gone (the
// bell icon in the top bar is untouched and still fully functional —
// only this in-page duplicate list was removed), matching the same
// removal already done on SupervisorHomeTab.jsx.
//
// Chat and Wasted Overall shortcuts used to live here as a quick-action
// row — removed per the homepage cleanup pass (Home was getting
// cluttered with entry points that duplicate the bottom-nav Chat tab and
// the Activity tab's own Wasted Overall button). Neither feature was
// touched: Chat is still the Chat tab, Wasted Overall is still on the
// Activity tab exactly as before — only this second shortcut is gone.
//
// The old prominent Sudden Tasks section is deliberately gone from this
// page (spec: Home should no longer be dominated by tasks) — Sudden
// Tasks are still fully available via the bottom-nav Tasks tab, nothing
// about that feature was removed, only its Home-page prominence.
export default function HomeTab({ onNavigate, basePath }) {
  const navigate = useNavigate();
  const { data: profile, error: profileError, loading: profileLoading, reload: reloadProfile } = useAsync(getProfile, { deps: [] });
  const { data: performance } = useAsync(getPerformanceSummary, { deps: [] });
  const { data: suddenTasks } = useAsync(() => listSuddenTasks({ status: "ASSIGNED" }), { deps: [] });

  const [showPerformanceHistory, setShowPerformanceHistory] = useState(false);

  if (showPerformanceHistory) {
    return (
      <div className="min-h-full bg-[#1A1A1A]">
        <PerformanceHistoryScreen onBack={() => setShowPerformanceHistory(false)} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      {profileLoading ? (
        <SkeletonCard className="h-[124px]" />
      ) : profileError ? (
        <ErrorBanner message={profileError} onRetry={reloadProfile} />
      ) : (
        <ProfileHeaderCard profile={profile} />
      )}

      {/* Night Shift entry point — only ever shown to an employee whose
          own operationalShift is NIGHT (from GET /api/profile, kept in
          sync with the same field the backend eligibility check uses),
          never inferred from the frontend alone. */}
      {profile?.operationalShift === "NIGHT" && (
        <button
          type="button"
          onClick={() => navigate(`${basePath}/night-shift`)}
          className="mt-4 w-full flex items-center gap-3 rounded-2xl p-4 bg-gradient-to-br from-[#1D2D5C]/60 to-[#171C2E]/80 border border-[#F47A20]/20 hover:border-[#F47A20]/40 backdrop-blur-xl transition-colors text-left"
        >
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-[#F47A20]/15 text-[#F47A20] shrink-0">
            <Moon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Night Shift</p>
            <p className="text-xs text-[#9AA1B4]">Tonight's tasks, Washing Market, and your departments</p>
          </div>
          <ChevronRight size={16} className="text-[#4C5266] shrink-0" />
        </button>
      )}

      <div className="mt-4 flex gap-3 items-stretch">
        <PerformanceCircle rate={performance?.rate} onClick={() => setShowPerformanceHistory(true)} />
        <TaskCountTile count={suddenTasks?.length ?? null} onClick={() => onNavigate?.("tasks")} />
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Attendance</h2>
        <AttendanceSection />
      </section>
    </div>
  );
}
