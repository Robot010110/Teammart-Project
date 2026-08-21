import { useState } from "react";
import { ArrowLeft, User, Bell, Lock, Globe, Palette, LogOut, ChevronRight } from "lucide-react";
import SecuritySettingsModal from "./SecuritySettingsModal";

const ENTRIES = [
  { key: "account", label: "Account", icon: User },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: Lock },
  { key: "language", label: "Language", icon: Globe },
  { key: "appearance", label: "Appearance", icon: Palette },
];

// SettingsScreen.jsx — Account/Notifications/Language/Appearance stay
// static placeholders (defined later, per spec); Security is real (spec
// §7-8 — change your own User ID and password, see
// SecuritySettingsModal.jsx), plus a working Log Out. `onBack` is
// optional — used when this screen is reached by drilling into Profile
// (Worker/Cashier); omitted when it's a top-level bottom-nav tab on its
// own (Supervisor Mode's Settings tab), where a "back" arrow wouldn't go
// anywhere.
export default function SettingsScreen({ onBack, onLogout }) {
  const [securityOpen, setSecurityOpen] = useState(false);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1"
        >
          <ArrowLeft size={16} /> Back to Profile
        </button>
      )}

      <h1 className="text-lg font-semibold text-white mb-4">Settings</h1>

      <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]">
        {ENTRIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={key === "security" ? () => setSecurityOpen(true) : undefined}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <Icon size={17} className="text-[#8B93A8]" />
            <span className="flex-1 text-sm text-white">{label}</span>
            <ChevronRight size={16} className="text-[#4C5266]" />
          </button>
        ))}
      </div>

      {securityOpen && <SecuritySettingsModal onClose={() => setSecurityOpen(false)} />}

      <button
        type="button"
        onClick={onLogout}
        className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-red-400 bg-red-500/[0.06] border border-red-500/20 hover:bg-red-500/10 transition-colors duration-200"
      >
        <LogOut size={16} /> Log Out
      </button>
    </div>
  );
}
