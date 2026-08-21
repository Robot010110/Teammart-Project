import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";

// SupervisorEmailStep.jsx — Regional Manager's login identifier (email),
// same role in the flow as EmployeeCodeStep.jsx (Worker) / CashierUsernameStep
// (Cashier): ask for the identifier here, password on the next step.
// Supervisor/Overlooking no longer use this step — they log in with a
// case-insensitive User ID instead (see SupervisorUserIdStep.jsx). A
// Regional Manager's zones come from their account (User.managedZones),
// never picked in the UI.

export default function SupervisorEmailStep({ onSelect }) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) onSelect(email.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto animate-fade-up">
      <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-2">Email</label>
      <div className="relative">
        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@teammart.com"
          autoFocus
          autoCapitalize="none"
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 transition-colors duration-200"
        />
      </div>

      <button
        type="submit"
        disabled={!email.trim()}
        className="mt-5 w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] disabled:cursor-not-allowed transition-colors duration-200 shadow-lg shadow-orange-900/20"
      >
        Continue <ArrowRight size={14} />
      </button>
    </form>
  );
}
