import { useState } from "react";
import { BadgeCheck, ArrowRight } from "lucide-react";

// SupervisorUserIdStep.jsx — Supervisor/Overlooking log in with a
// case-insensitive "User ID" (e.g. em881), not email (spec: "the entire
// system should be actually connected end-to-end" — Supervisor now uses
// the same User-ID+password shape as Worker/Cashier login, just checked
// against the staff table server-side — see authService.staffIdLogin).
// Regional Manager keeps the separate email-based SupervisorEmailStep.

export default function SupervisorUserIdStep({ onSelect }) {
  const [userId, setUserId] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userId.trim()) onSelect(userId.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto animate-fade-up">
      <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-2">User ID</label>
      <div className="relative">
        <BadgeCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="e.g. em881"
          autoFocus
          autoCapitalize="none"
          autoComplete="username"
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 transition-colors duration-200"
        />
      </div>
      <p className="mt-2 text-xs text-[#4C5266]">Not case-sensitive — em881 and EM881 both work.</p>

      <button
        type="submit"
        disabled={!userId.trim()}
        className="mt-5 w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] disabled:cursor-not-allowed transition-colors duration-200 shadow-lg shadow-orange-900/20"
      >
        Continue <ArrowRight size={14} />
      </button>
    </form>
  );
}
