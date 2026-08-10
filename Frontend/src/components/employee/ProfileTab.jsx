import { useState } from "react";
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
  { key: "attendance", label: "Attendance", icon: CalendarDays },
  { key: "performance", label: "Performance History", icon: TrendingUp },
  { key: "leave", label: "Off Days / Leave", icon: CalendarOff },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

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

// ProfileTab.jsx — the Profile tab's content: header + a menu into
// Attendance (unchanged AttendanceSection), Performance History (new),
// Off Days/Leave (unchanged LeaveRequestSection), Settings (new
// placeholder). Local `screen` state drives which sub-screen shows, same
// no-router convention as everything else in this shell.
export default function ProfileTab({ onLogout }) {
  const { data: profile, error, loading, reload } = useAsync(getProfile, { deps: [] });
  const [screen, setScreen] = useState("menu");

  if (screen === "performance") {
    return <PerformanceHistoryScreen onBack={() => setScreen("menu")} />;
  }
  if (screen === "settings") {
    return <SettingsScreen onBack={() => setScreen("menu")} onLogout={onLogout} />;
  }
  if (screen === "attendance") {
    return (
      <ArrowLeftMenu label="Attendance" onBack={() => setScreen("menu")}>
        <AttendanceSection />
      </ArrowLeftMenu>
    );
  }
  if (screen === "leave") {
    return (
      <ArrowLeftMenu label="Off Days / Leave" onBack={() => setScreen("menu")}>
        <LeaveRequestSection />
      </ArrowLeftMenu>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      {loading ? (
        <SkeletonCard className="h-[124px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <ProfileHeaderCard profile={profile} />
      )}

      <div className="mt-5 rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]">
        {MENU.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setScreen(key)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <Icon size={17} className="text-[#8B93A8]" />
            <span className="flex-1 text-sm text-white">{label}</span>
            <ChevronRight size={16} className="text-[#4C5266]" />
          </button>
        ))}
      </div>
    </div>
  );
}
