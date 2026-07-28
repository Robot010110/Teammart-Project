import { Bell, LogOut } from "lucide-react";
import Logo from "../common/Logo";

// Header.jsx — top bar: logo + title on the left, live date, notifications,
// the signed-in user, and a logout control on the right.

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Header({ user, notificationCount = 3, onLogout }) {
  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-5 md:px-8 bg-[#1A1A1A]/80 backdrop-blur-xl border-b border-white/5">
      <Logo />

      <div className="flex items-center gap-3 md:gap-5">
        <span className="hidden sm:block text-sm text-[#9AA1B4] font-medium">
          {todayLabel()}
        </span>

        <button
          className="relative h-9 w-9 rounded-full grid place-items-center bg-white/5 hover:bg-white/10 transition-colors duration-200"
          aria-label="Notifications"
        >
          <Bell size={17} className="text-[#E8E8E8]" strokeWidth={1.8} />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#F47A20] text-[10px] font-bold text-white grid place-items-center ring-2 ring-[#1A1A1A]">
              {notificationCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#324a8f] grid place-items-center ring-1 ring-white/10">
            <span className="text-xs font-semibold text-white">{user.avatarInitials}</span>
          </div>
          <div className="hidden md:block leading-tight">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-[11px] text-[#8B93A8]">{user.role}</p>
          </div>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Log out"
            className="h-9 w-9 rounded-full grid place-items-center bg-white/5 hover:bg-red-500/15 hover:text-red-400 transition-colors duration-200 text-[#E8E8E8]"
          >
            <LogOut size={15} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </header>
  );
}
