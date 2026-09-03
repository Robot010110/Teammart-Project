import { useState } from "react";
import { ArrowLeft, Crown, ShieldCheck, ClipboardList, CreditCard, Mail, AlertCircle, Sun, Moon } from "lucide-react";
import CinematicBackground from "./CinematicBackground";
import CredentialField from "./CredentialField";
import PasswordField from "./PasswordField";
import PrimaryLoginButton from "./PrimaryLoginButton";
import { staffLogin, staffIdLogin } from "../../services/authService";
import { listMarkets } from "../../services/marketService";
import { ApiError } from "../../services/apiClient";
import { initialsOf } from "../../utils/initials";

const STAFF_ROLES = [
  { key: "supervisor", label: "Supervisor", icon: ClipboardList },
  { key: "regionalManager", label: "Regional Mgr", icon: ShieldCheck },
  { key: "admin", label: "Admin", icon: Crown },
];

// StaffLoginScreen.jsx — one combined form for the three staff roles.
// The identifier field's label/type genuinely changes per role because
// the real backend only offers two login shapes: Supervisor/Overlooking
// authenticate with a case-insensitive User ID (staffIdLogin), while
// Regional Manager and Admin have no code-based login at all — only a
// real email (staffLogin), per staffLoginSchema on the backend. This is
// an intentional, backend-driven deviation from the reference's single
// "Employee Code" label for Staff — flagged here and in the final
// report rather than faked with a cosmetic label swap over a broken call.
//
// Supervisor vs Overlooking is a real distinction too — two separate
// backend accounts (StaffRole SUPERVISOR vs OVERLOOKING_SUPERVISOR), so
// selecting Supervisor reveals a second inline Shift toggle; the
// account's own role in the staffIdLogin response is cross-checked
// against that pick, exactly as the previous wizard's separate shift
// step did, just folded into this one screen instead of its own step.
export default function StaffLoginScreen({ onBack, onLogin, initialRole = "supervisor" }) {
  const [staffRole, setStaffRole] = useState(initialRole);
  const [shift, setShift] = useState("MORNING"); // Supervisor only: MORNING -> Supervisor, EVENING -> Overlooking
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isSupervisor = staffRole === "supervisor";
  const usesEmail = !isSupervisor;

  function handleRoleChange(key) {
    setStaffRole(key);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError(`Enter your ${usesEmail ? "email" : "User ID"} and password.`);
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      if (isSupervisor) {
        const user = await staffIdLogin(identifier.trim(), password);
        if (user.role !== "SUPERVISOR" && user.role !== "OVERLOOKING_SUPERVISOR") {
          setError("This account isn't a Supervisor or Overlooking account.");
          setSubmitting(false);
          return;
        }
        const expectedRole = shift === "EVENING" ? "OVERLOOKING_SUPERVISOR" : "SUPERVISOR";
        if (user.role !== expectedRole) {
          setError(
            user.role === "OVERLOOKING_SUPERVISOR"
              ? 'This is an Overlooking account — switch the shift toggle to "Overlooking".'
              : 'This is a Supervisor account — switch the shift toggle to "Supervisor".'
          );
          setSubmitting(false);
          return;
        }
        let marketName = null;
        try {
          const [market] = await listMarkets();
          marketName = market?.name ?? null;
        } catch {
          // Non-fatal — workspace still functions without a market display name.
        }
        onLogin({
          role: "supervisor",
          staffRole: user.role,
          staffId: user.id,
          loginId: user.loginId,
          marketId: user.marketId,
          zoneId: user.zoneId,
          marketName,
          shift,
          title: user.role === "OVERLOOKING_SUPERVISOR" ? "Overlooking" : "Supervisor",
          displayName: user.name,
          initials: initialsOf(user.name),
        });
        return;
      }

      // Regional Manager / Admin — real POST /api/auth/login (email).
      const user = await staffLogin(identifier.trim(), password);
      const expectedBackendRole = staffRole === "admin" ? "ADMIN" : "REGIONAL_MANAGER";
      if (user.role !== expectedBackendRole) {
        setError(`This account isn't a${staffRole === "admin" ? "n Admin" : " Regional Manager"} account.`);
        setSubmitting(false);
        return;
      }
      onLogin(
        staffRole === "admin"
          ? { role: "admin", staffId: user.id, displayName: user.name, initials: initialsOf(user.name) }
          : { role: "regionalManager", staffId: user.id, zoneIds: user.zoneIds, displayName: user.name, initials: initialsOf(user.name) }
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to connect. Please try again.");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <CinematicBackground variant="aisles" />

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
                <ShieldCheck size={24} className="text-[#F47A20]" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F9A03C]">Staff Access</p>
              <h1 className="mt-1 font-display text-2xl font-extrabold text-white">Staff Login</h1>
              <p className="mt-2 text-[13px] text-[#9AA1B4] leading-snug">Select your role and sign in to your dashboard.</p>
            </div>

            <div className="card-premium rounded-[22px] p-5 sm:p-6 bg-[#0D1223]/85 border border-white/10 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
              <div className="grid grid-cols-3 gap-2 mb-4">
                {STAFF_ROLES.map((r) => (
                  <TypeButton key={r.key} icon={r.icon} label={r.label} active={staffRole === r.key} onClick={() => handleRoleChange(r.key)} />
                ))}
              </div>

              {isSupervisor && (
                <div className="grid grid-cols-2 gap-2 mb-5 animate-fade-up">
                  <ShiftButton icon={Sun} label="Supervisor" active={shift === "MORNING"} onClick={() => setShift("MORNING")} />
                  <ShiftButton icon={Moon} label="Overlooking" active={shift === "EVENING"} onClick={() => setShift("EVENING")} />
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <CredentialField
                  icon={usesEmail ? Mail : CreditCard}
                  label={usesEmail ? "Email" : "User ID"}
                  value={identifier}
                  onChange={setIdentifier}
                  placeholder={usesEmail ? "you@teammart.com" : "e.g. SUP-014"}
                  type={usesEmail ? "email" : "text"}
                  error={!!error}
                  autoFocus
                />
                <PasswordField value={password} onChange={setPassword} error={!!error} />

                {error && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-red-400">
                    <AlertCircle size={13} className="shrink-0" /> {error}
                  </p>
                )}

                <div className="pt-1">
                  <PrimaryLoginButton submitting={submitting} />
                </div>
              </form>
            </div>
          </div>
        </div>

        <p className="pb-2 text-[11.5px] text-[#5C6479] text-center">Leading operations, one market at a time.</p>
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
      className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 border transition-all duration-200 ${
        active
          ? "bg-[#F47A20]/[0.14] border-[#F47A20]/60 shadow-[0_0_16px_-3px_rgba(244,122,32,0.55)]"
          : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.16]"
      }`}
    >
      <Icon size={17} className={active ? "text-[#F47A20]" : "text-[#5C6479]"} />
      <span className={`text-[11.5px] font-semibold ${active ? "text-white" : "text-[#8B93A8]"}`}>{label}</span>
    </button>
  );
}

function ShiftButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 rounded-xl py-2.5 border transition-all duration-200 ${
        active ? "bg-white/[0.06] border-[#F47A20]/40 text-white" : "bg-white/[0.02] border-white/[0.06] text-[#8B93A8] hover:border-white/[0.12]"
      }`}
    >
      <Icon size={14} className={active ? "text-[#F47A20]" : "text-[#5C6479]"} />
      <span className="text-[12.5px] font-semibold">{label}</span>
    </button>
  );
}
