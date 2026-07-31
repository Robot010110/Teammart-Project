import { useState } from "react";
import { BadgeCheck, ArrowRight } from "lucide-react";

// EmployeeCodeStep.jsx — replaces the old EmployeePicker "browse everyone
// and click your name" directory. The real backend has no endpoint that
// lists every employee before login (only logged-in staff can list
// employees, and only scoped to their own market/zone) — so there is
// nothing for a directory-style picker to fetch before you're logged in.
// Real employee login is a private code + password pair
// (POST /api/auth/employee-login), so this step just asks for the code,
// the same way a username field would on any other login form.

export default function EmployeeCodeStep({ onSelect }) {
  const [code, setCode] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim()) onSelect(code.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto animate-fade-up">
      <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-2">Employee Code</label>
      <div className="relative">
        <BadgeCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. TM-4821"
          autoFocus
          autoCapitalize="characters"
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 transition-colors duration-200"
        />
      </div>
      <p className="mt-2 text-xs text-[#4C5266]">Your supervisor gives you this code when your account is set up.</p>

      <button
        type="submit"
        disabled={!code.trim()}
        className="mt-5 w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] disabled:cursor-not-allowed transition-colors duration-200 shadow-lg shadow-orange-900/20"
      >
        Continue <ArrowRight size={14} />
      </button>
    </form>
  );
}
