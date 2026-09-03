import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { CalendarDays, TrendingUp, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import ProfileHeaderCard from "./ProfileHeaderCard";
import AttendanceSection from "./AttendanceSection";
import LeaveRequestSection from "./LeaveRequestSection";
import PerformanceHistoryScreen from "./PerformanceHistoryScreen";
import SettingsScreen from "./SettingsScreen";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getProfile } from "../../services/profileService";
import { useAsync } from "../../hooks/useAsync";

// "Off Days / Leave" is deliberately NOT a menu item here anymore — the
// Attendance redesign moved off-day selection (Weekly/Monthly/Emergency
// Off) into the Attendance page's own calendar (tap a date -> Choose Off
// Type). Personal Leave / Earned Day Off still exist and are still
// reachable at the "leave" route below (see the Routes block) — only
// the Profile menu entry pointing at it was removed, not the route,
// the screen, the backend, or any LeaveRequest functionality.
const MENU = [
  { key: "attendance", label: "Attendance", icon: CalendarDays, bg: "bg-sky-500/10", tone: "text-sky-400", glow: "glow-sky" },
  { key: "performance", label: "Performance History", icon: TrendingUp, bg: "bg-violet-500/10", tone: "text-violet-400", glow: "glow-violet" },
  { key: "settings", label: "Settings", icon: SettingsIcon, bg: "bg-[#F47A20]/10", tone: "text-[#F47A20]", glow: "glow-orange" },
];

function ProfileMenu({ basePath }) {
  const { data: profile, error, loading, reload } = useAsync(getProfile, { deps: [] });
  const navigate = useNavigate();

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      {loading ? (
        <SkeletonCard className="h-[124px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <ProfileHeaderCard profile={profile} />
      )}

      <div className="card-premium mt-5 rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]">
        {MENU.map(({ key, label, icon: Icon, bg, tone, glow }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(`${basePath}/${key}`)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors duration-150"
          >
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bg} ${tone} ${glow}`}>
              <Icon size={16} />
            </span>
            <span className="flex-1 text-sm text-white">{label}</span>
            <ChevronRight size={16} className="text-[#4C5266]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ArrowLeftMenu({ label, onBack, children }) {
  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        ← Back to Profile
      </button>
      <h1 className="text-lg font-semibold text-white mb-4">{label}</h1>
      {children}
    </div>
  );
}

// ProfileTab.jsx — the Profile tab's content: menu -> Attendance
// (unchanged AttendanceSection), Performance History (also hosts "My
// Activities" — see PerformanceHistoryScreen.jsx), Settings. Each entry
// is a real route under `basePath` (e.g. /me/profile/performance)
// instead of local `screen` state, so Back from any of these returns to
// the Profile menu as a real history entry.
//
// The "leave" route (Personal Leave / Earned Day Off, via the unchanged
// LeaveRequestSection) still exists below and is still fully functional
// — it's just no longer listed in MENU, since Weekly/Monthly/Emergency
// Off moved to the Attendance calendar and Profile doesn't need two
// off-day entry points. Nothing under /me/profile/leave was deleted.
export default function ProfileTab({ onLogout, basePath }) {
  const navigate = useNavigate();
  const goToMenu = () => navigate(basePath);

  return (
    <Routes>
      <Route index element={<ProfileMenu basePath={basePath} />} />
      <Route path="performance/*" element={<PerformanceHistoryScreen onBack={goToMenu} basePath={`${basePath}/performance`} />} />
      <Route path="settings" element={<SettingsScreen onBack={goToMenu} onLogout={onLogout} />} />
      {/* Attendance renders its own header (centered on mobile, a
          back-link row on desktop — see AttendanceSection.jsx) rather
          than the shared ArrowLeftMenu, which stays exactly as it is for
          Off Days / Leave below. Back still goes through this tab's own
          goToMenu, so the entry point is unchanged. */}
      <Route path="attendance" element={<AttendanceSection onBack={goToMenu} />} />
      {/* No UI links here anymore (removed on request — see
          AttendanceSection.jsx's own note) but the route, screen, and
          backend are all still real and functional — reachable directly
          at /me/profile/leave if a future entry point is added. */}
      <Route
        path="leave"
        element={
          <ArrowLeftMenu label="Off Days / Leave" onBack={goToMenu}>
            <LeaveRequestSection />
          </ArrowLeftMenu>
        }
      />
      <Route path="*" element={<Navigate to={basePath} replace />} />
    </Routes>
  );
}
