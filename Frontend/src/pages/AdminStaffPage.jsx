import { useState } from "react";
import { UserPlus, Check, Loader2, ShieldCheck } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { ApiError } from "../services/apiClient";
import { listStaffAccounts, registerStaff } from "../services/authService";
import AdminStaffActionsPanel from "./AdminStaffActionsPanel";

const ROLES = [
  { value: "REGIONAL_MANAGER", label: "Regional Manager" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "OVERLOOKING_SUPERVISOR", label: "Overlooking Supervisor" },
  { value: "ADMIN", label: "Admin" },
];

const inputClass =
  "w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50";

// AdminStaffPage.jsx — ADMIN-only: create new staff accounts (POST
// /api/auth/register, already ADMIN-gated on the backend — this is the
// first UI for it) and see the existing staff directory (GET
// /api/auth/staff). Supervisor/Overlooking accounts created here still
// need their market assigned separately (Regional Manager's own
// employee-management screens already do that) — this page's job is
// account creation, not market assignment, matching the existing
// division of responsibility in the backend.
export default function AdminStaffPage() {
  const { data: staff, error, loading, reload } = useAsync(() => listStaffAccounts(), { deps: [] });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SUPERVISOR", loginId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await registerStaff({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        loginId: form.loginId.trim() || undefined,
      });
      setForm({ name: "", email: "", password: "", role: "SUPERVISOR", loginId: "" });
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create the account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Staff Accounts</h1>
          <p className="mt-1 text-sm text-[#9AA1B4]">{loading ? "Loading..." : `${staff?.length ?? 0} account${staff?.length === 1 ? "" : "s"}`}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
        >
          <UserPlus size={15} /> New Account
        </button>
      </div>

      {creating && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Full name"
            required
            className={inputClass}
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            autoCapitalize="none"
            required
            className={inputClass}
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Password (min 8 characters)"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClass}
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className={inputClass}
          >
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {(form.role === "SUPERVISOR" || form.role === "OVERLOOKING_SUPERVISOR") && (
            <input
              value={form.loginId}
              onChange={(e) => setForm((f) => ({ ...f, loginId: e.target.value }))}
              placeholder="User ID (optional — can be set later from Settings)"
              autoCapitalize="none"
              className={inputClass}
            />
          )}
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-150"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create Account
          </button>
        </form>
      )}

      <div className="mt-5">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[64px]" />)}</div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : (
          <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]">
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStaff(s)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-[#F47A20]/10 grid place-items-center shrink-0">
                  <ShieldCheck size={15} className="text-[#F47A20]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.name}</p>
                  <p className="text-xs text-[#8B93A8] truncate">{s.email}</p>
                </div>
                {s.accountStatus && s.accountStatus !== "ACTIVE" && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-red-400 bg-red-500/10 rounded-full px-2 py-1">
                    {s.accountStatus}
                  </span>
                )}
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#F47A20] bg-[#F47A20]/10 rounded-full px-2.5 py-1">
                  {s.role.replace(/_/g, " ")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedStaff && (
        <AdminStaffActionsPanel
          staff={selectedStaff}
          onClose={() => setSelectedStaff(null)}
          onChanged={() => { reload(); setSelectedStaff(null); }}
        />
      )}
    </div>
  );
}
