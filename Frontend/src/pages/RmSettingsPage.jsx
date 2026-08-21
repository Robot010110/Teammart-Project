import { useState } from "react";
import { Lock, ChevronRight, LogOut } from "lucide-react";
import SecuritySettingsModal from "../components/employee/SecuritySettingsModal";

// RmSettingsPage.jsx — spec §7-8/§16: a Regional Manager/Zone Manager
// changing their own password (Admin/Regional Manager have no User ID in
// this spec — email stays their login, so only the password section of
// SecuritySettingsModal applies here in practice, the User ID field
// simply won't exist on their profile response). Reuses the exact same
// modal every other role uses — one implementation, not a parallel one.
export default function RmSettingsPage({ onLogout }) {
  const [securityOpen, setSecurityOpen] = useState(false);

  return (
    <div className="px-6 md:px-10 py-8 max-w-2xl mx-auto animate-fade-up">
      <h1 className="font-display text-2xl font-bold text-white mb-6">Settings</h1>

      <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setSecurityOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
        >
          <Lock size={17} className="text-[#8B93A8]" />
          <span className="flex-1 text-sm text-white">Security</span>
          <ChevronRight size={16} className="text-[#4C5266]" />
        </button>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-red-400 bg-red-500/[0.06] border border-red-500/20 hover:bg-red-500/10 transition-colors duration-200"
      >
        <LogOut size={16} /> Log Out
      </button>

      {securityOpen && <SecuritySettingsModal onClose={() => setSecurityOpen(false)} />}
    </div>
  );
}
