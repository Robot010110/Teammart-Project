import { useState } from "react";
import { ArrowLeft, HardHat, Wallet, CreditCard, AlertCircle } from "lucide-react";
import CinematicBackground from "./CinematicBackground";
import CredentialField from "./CredentialField";
import PasswordField from "./PasswordField";
import PrimaryLoginButton from "./PrimaryLoginButton";
import { employeeLogin, cashierLogin } from "../../services/authService";
import { ApiError } from "../../services/apiClient";
import { initialsOf } from "../../utils/initials";

// EmployeeLoginScreen.jsx — one combined form, both credential fields
// together (no Code -> Continue -> Password wizard). Worker and Cashier
// are a real distinction, not cosmetic: they hit genuinely different
// backend endpoints (employeeLogin vs cashierLogin — see
// authService.js's own comment on why they're separate), so switching
// the segmented selector really does change which real call Sign In
// makes; both still authenticate with the same typed code, since a
// Cashier's login identifier is stored in the same shape as a Worker's
// employee code.
export default function EmployeeLoginScreen({ onBack, onLogin }) {
  const [type, setType] = useState("worker"); // "worker" | "cashier"
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() || !password) {
      setError("Enter your employee code and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const employee = type === "worker" ? await employeeLogin(code.trim(), password, rememberMe) : await cashierLogin(code.trim(), password, rememberMe);
      onLogin({
        role: "employee",
        employeeRole: employee.role,
        employeeId: employee.id,
        marketId: employee.marketId,
        displayName: employee.name,
        initials: initialsOf(employee.name),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to connect. Please try again.");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <CinematicBackground variant="produce" />

      <div className="relative min-h-screen flex flex-col items-center px-5 py-6">
        <div className="w-full max-w-sm flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to role selection"
            className="w-10 h-10 grid place-items-center rounded-full bg-white/[0.06] border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center shadow-[0_0_12px_-2px_rgba(244,122,32,0.6)]">
              <span className="font-display font-extrabold text-white text-[11px]">TM</span>
            </div>
            <p className="font-display font-bold text-white text-[13px] tracking-wide">
              TEAM<span className="text-[#F47A20]">MART</span>
            </p>
          </div>
          <span className="w-10" aria-hidden="true" />
        </div>

        <div className="flex-1 flex items-center w-full max-w-sm">
          <div className="w-full animate-fade-up">
            <div className="text-center mb-6">
              <span className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[#F47A20]/12 grid place-items-center shadow-[0_0_20px_-4px_rgba(244,122,32,0.6)]">
                <CreditCard size={24} className="text-[#F47A20]" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F9A03C]">Welcome Back</p>
              <h1 className="mt-1 font-display text-2xl font-extrabold text-white">Employee Login</h1>
              <p className="mt-2 text-[13px] text-[#9AA1B4] leading-snug">
                Enter your code and password to continue to your workspace.
              </p>
            </div>

            <div className="card-premium rounded-[22px] p-5 sm:p-6 bg-[#0D1223]/85 border border-white/10 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
              {/* Worker / Cashier — a real, functional toggle (see this
                  file's own top comment), not a decorative one. */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <TypeButton icon={HardHat} label="Worker" active={type === "worker"} onClick={() => setType("worker")} />
                <TypeButton icon={Wallet} label="Cashier" active={type === "cashier"} onClick={() => setType("cashier")} />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <CredentialField
                  icon={CreditCard}
                  label="Employee Code"
                  value={code}
                  onChange={setCode}
                  placeholder="e.g. TM-4821"
                  error={!!error}
                  autoFocus
                />
                <PasswordField value={password} onChange={setPassword} error={!!error} />

                {error && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-red-400">
                    <AlertCircle size={13} className="shrink-0" /> {error}
                  </p>
                )}

                <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-[#F47A20]"
                  />
                  <span className="text-[12.5px] text-[#9AA1B4]">Remember me</span>
                </label>

                <div className="pt-1">
                  <PrimaryLoginButton submitting={submitting} />
                </div>
              </form>
            </div>
          </div>
        </div>

        <p className="pb-2 text-[11.5px] text-[#5C6479] text-center">Your work drives our success. Let's make it happen today.</p>
      </div>
    </div>
  );
}

function TypeButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1.5 rounded-xl py-3 border transition-all duration-200 ${
        active
          ? "bg-[#F47A20]/[0.14] border-[#F47A20]/60 shadow-[0_0_16px_-3px_rgba(244,122,32,0.55)]"
          : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.16]"
      }`}
    >
      <Icon size={18} className={active ? "text-[#F47A20]" : "text-[#5C6479]"} />
      <span className={`text-[12.5px] font-semibold ${active ? "text-white" : "text-[#8B93A8]"}`}>{label}</span>
    </button>
  );
}
