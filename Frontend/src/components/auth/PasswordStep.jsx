import { useState } from "react";
import { Lock, AlertCircle, Eye, EyeOff } from "lucide-react";

// PasswordStep.jsx — final login step. `summary` is an array of
// {label, value} rows shown above the field so the person can confirm their
// selections before entering their password.
//
// `onSubmit` may return a boolean OR a Promise<boolean> — real logins
// (Employee) are async network calls, so this step shows a "Logging in..."
// state while waiting and only re-enables the form once the backend
// responds. `errorMessage` lets the caller show a real server error
// ("Invalid employee code or password") instead of a generic one.
//
// `showRememberMe` opts a caller into the "Remember me on this device"
// checkbox, passed through as onSubmit's second argument. Only the
// Employee/Cashier path (LoginPage.jsx) sets this — that's the only path
// with real backend support (a longer-lived JWT); RM/Supervisor's mock
// login is unaffected by the extra argument since it just ignores it.

export default function PasswordStep({ summary, hint, onSubmit, errorMessage, showRememberMe = false }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await onSubmit(password, rememberMe);
    setSubmitting(false);
    if (!ok) {
      setError(true);
      setPassword("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto animate-fade-up">
      <div className="rounded-xl bg-[#1A1F33]/70 border border-white/[0.06] p-4 mb-5 space-y-2">
        {summary.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-[#8B93A8]">{label}</span>
            <span className="text-white font-medium">{value}</span>
          </div>
        ))}
      </div>

      <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-2">Password</label>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder="Enter password"
          autoFocus
          className={`w-full rounded-lg bg-white/[0.04] border pl-9 pr-10 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none transition-colors duration-200 ${
            error ? "border-red-500/50 focus:border-red-500/70" : "border-white/[0.06] focus:border-[#F47A20]/50"
          }`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4C5266] hover:text-[#9AA1B4] p-1"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={13} /> {errorMessage || "Incorrect password. Try the demo password below."}
        </p>
      )}

      {hint && <p className="mt-2 text-xs text-[#4C5266]">Demo password: <span className="text-[#8B93A8] font-mono">{hint}</span></p>}

      {showRememberMe && (
        <label className="mt-4 flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/[0.04] text-[#F47A20] focus:ring-0 focus:ring-offset-0 accent-[#F47A20]"
          />
          <span className="text-xs text-[#9AA1B4]">Remember me on this device</span>
        </label>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-[#F47A20]/50 disabled:cursor-wait transition-colors duration-200 shadow-lg shadow-orange-900/20"
      >
        {submitting ? "Logging in..." : "Log In"}
      </button>
    </form>
  );
}
