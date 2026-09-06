import { useState } from "react";
import { CreditCard, Lock, ChevronRight, ShieldCheck, Loader2, Check, Eye, EyeOff, X } from "lucide-react";
import { updateMyPassword } from "../../../services/profileService";
import { ApiError } from "../../../services/apiClient";

// Which field this account actually signs in with. A Cashier has an
// employeeCode too, but `username` is the credential they type, so
// that's the one shown — same rule the old Security modal used.
function identity(profile, t) {
  if (!profile) return { label: t.employeeId, value: "—", hint: "" };
  if (profile.kind === "staff") return { label: t.userId, value: profile.loginId ?? profile.email, hint: t.userIdHint };
  if (profile.role === "CASHIER") return { label: t.userId, value: profile.username, hint: t.userIdHint };
  return { label: t.employeeId, value: profile.employeeCode, hint: t.employeeIdHint };
}

function PasswordInput({ label, value, onChange, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8B93A8]">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 pl-3.5 pr-11 text-[15px] text-white outline-none transition-colors focus:border-[#F47A20]/60"
        />
        {/* Reveals only what the user is typing right now. There is no
            control anywhere that reveals the STORED password — it is a
            hash on the server and is never sent to this app. */}
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
          aria-label={show ? "Hide" : "Show"}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#5C6479] transition-colors hover:text-[#9AA1B4]"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

// AccountSettings.jsx — Settings -> Account.
//
// Shows who this account is and lets them change their own password.
// The stored password is never fetched, never rendered, and has no
// reveal control: the API does not return it in any form (it is a bcrypt
// hash server-side), so the dots below are a fixed placeholder, not a
// masked real value.
export default function AccountSettings({ profile, loading, t }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const id = identity(profile, t);

  function reset() {
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError(t.passwordTooShort); return; }
    if (newPassword !== confirmPassword) { setError(t.passwordMismatch); return; }

    setSaving(true);
    try {
      await updateMyPassword(currentPassword, newPassword);
      reset();
      setOpen(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      // The server decides whether the current password was right —
      // this never checks it locally.
      setError(err instanceof ApiError ? err.message : "Could not change your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7EA6FF]/10 text-[#7EA6FF] ring-1 ring-inset ring-[#7EA6FF]/20">
            <CreditCard size={16} />
          </span>
          <p className="text-[12px] text-[#8B93A8]">{id.label}</p>
        </div>
        <p className="mt-2 font-display text-[20px] font-bold tabular-nums text-white">
          {loading ? "…" : id.value || "—"}
        </p>
        <p className="mt-0.5 text-[11.5px] text-[#5C6479]">{id.hint}</p>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C08BFF]/10 text-[#C08BFF] ring-1 ring-inset ring-[#C08BFF]/20">
            <Lock size={16} />
          </span>
          <p className="text-[12px] text-[#8B93A8]">{t.password}</p>
        </div>
        <p className="mt-2 select-none font-display text-[20px] font-bold tracking-[0.2em] text-white" aria-label="Password hidden">
          ••••••••
        </p>
        <p className="mt-0.5 text-[11.5px] text-[#5C6479]">{t.passwordHidden}</p>
      </div>

      {saved && (
        <p className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3.5 py-2.5 text-[12.5px] text-emerald-400">
          <Check size={14} /> {t.passwordChanged}
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-[#F47A20] to-[#E0561A] px-4 py-3.5 text-[14px] font-semibold text-white shadow-[0_0_22px_-6px_rgba(244,122,32,0.8)] transition-all duration-200 hover:from-[#ff8b36] hover:to-[#F47A20] active:scale-[0.99]"
        >
          {t.changePassword}
          <ChevronRight size={17} />
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="animate-fade-up space-y-3 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-white">{t.changePassword}</p>
            <button
              type="button"
              onClick={() => { setOpen(false); reset(); }}
              aria-label={t.cancel}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#8B93A8] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          <PasswordInput label={t.currentPassword} value={currentPassword} onChange={setCurrentPassword} autoFocus />
          <PasswordInput label={t.newPassword} value={newPassword} onChange={setNewPassword} />
          <PasswordInput label={t.confirmNewPassword} value={confirmPassword} onChange={setConfirmPassword} />

          {error && <p className="text-[12.5px] text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F47A20] to-[#E0561A] py-3 text-[14px] font-semibold text-white transition-all duration-200 hover:from-[#ff8b36] active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> {t.saving}</> : t.changePassword}
          </button>
        </form>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl border border-[#7EA6FF]/15 bg-[#7EA6FF]/[0.05] px-3.5 py-3">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#7EA6FF]" />
        <p className="text-[11.5px] leading-relaxed text-[#9AA1B4]">{t.passwordNotice}</p>
      </div>
    </div>
  );
}
