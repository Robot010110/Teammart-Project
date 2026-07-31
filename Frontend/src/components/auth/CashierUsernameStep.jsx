import { useState } from "react";
import { User, ArrowRight } from "lucide-react";

// CashierUsernameStep.jsx — the Cashier counterpart to EmployeeCodeStep.jsx.
// Cashiers log in with a username, not an employee code
// (POST /api/auth/cashier-login) — same "just ask for the identifier"
// shape, different field/placeholder/icon.

export default function CashierUsernameStep({ onSelect }) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) onSelect(username.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto animate-fade-up">
      <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-2">Username</label>
      <div className="relative">
        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. cashier_morning01"
          autoFocus
          autoCapitalize="none"
          autoComplete="username"
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 transition-colors duration-200"
        />
      </div>
      <p className="mt-2 text-xs text-[#4C5266]">Your supervisor gives you this username when your account is set up.</p>

      <button
        type="submit"
        disabled={!username.trim()}
        className="mt-5 w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] disabled:cursor-not-allowed transition-colors duration-200 shadow-lg shadow-orange-900/20"
      >
        Continue <ArrowRight size={14} />
      </button>
    </form>
  );
}
