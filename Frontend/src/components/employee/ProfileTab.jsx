import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { CalendarDays, TrendingUp, CalendarOff, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import ProfileHeaderCard from "./ProfileHeaderCard";
import AttendanceSection from "./AttendanceSection";
import LeaveRequestSection from "./LeaveRequestSection";
import PerformanceHistoryScreen from "./PerformanceHistoryScreen";
import SettingsScreen from "./SettingsScreen";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getProfile } from "../../services/profileService";
import { useAsync } from "../../hooks/useAsync";

const MENU = [
  { key: "attendance", label: "Attendance", icon: CalendarDays, bg: "bg-sky-500/10", tone: "text-sky-400", glow: "glow-sky" },
  { key: "performance", label: "Performance History", icon: TrendingUp, bg: "bg-violet-500/10", tone: "text-violet-400", glow: "glow-violet" },
  { key: "leave", label: "Off Days / Leave", icon: CalendarOff, bg: "bg-emerald-500/10", tone: "text-emerald-400", glow: "glow-emerald" },
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
// Activities" — see PerformanceHistoryScreen.jsx), Off Days/Leave
// (unchanged LeaveRequestSection), Settings. Each entry is now a real
// route under `basePath` (e.g. /me/profile/performance) instead of local
// `screen` state, so Back from any of these returns to the Profile menu
// as a real history entry.
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
