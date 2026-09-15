import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ShieldOff, ShieldCheck, KeyRound, ArrowUpCircle, Building2, CreditCard } from "lucide-react";
import Modal from "../components/common/Modal";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/apiClient";
import { updateEmployee } from "../services/staffEmployeeService";
import { listMarkets } from "../services/marketService";
import {
  promoteEmployeeToStaff, resetEmployeePassword, setEmployeeAccountStatus,
} from "../services/adminService";

const inputClass =
  "w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50";
const selectClass = inputClass;

// AdminEmployeeActionsPanel.jsx — Admin Phase 2 §3/§28: the
// administrative-control surface for an Employee, clearly separated from
// the read-only profile view above it (RmEmployeeProfile, unchanged).
// Every action here is a distinct confirmed operation calling a real
// ADMIN-only backend endpoint — never an always-editable form. Market/
// shift changes and Employee ID changes reuse the EXISTING
// updateEmployee endpoint (already ADMIN-accessible) rather than
// duplicating it — see adminService.js's own comment. Department is
// deliberately NOT editable from here — it's a Supervisor's call, made
// from the market's own screen; the backend already clears it
// automatically on a market change (see updateEmployeesController's own
// comment on that transaction) so there's never a stale department left
// pointing at the old market.
export default function AdminEmployeeActionsPanel({ employee, onChanged }) {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null); // "promote" | "assignment" | "id" | "password" | "status"
  const [statusTarget, setStatusTarget] = useState(null); // "SUSPENDED" | "BANNED" | "ACTIVE"

  const canSuspendBan = employee.accountStatus === "ACTIVE";
  const canReactivate = employee.accountStatus === "SUSPENDED" || employee.accountStatus === "BANNED";

  return (
    <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">{t("admin.administrativeActions")}</h2>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#8B93A8]">{t("admin.employment")} <span className="text-white">{employee.employmentStatus}</span></span>
          <span className="text-[#8B93A8]">·</span>
          <span className={employee.accountStatus === "ACTIVE" ? "text-emerald-400" : "text-red-400"}>
            Account: {employee.accountStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <ActionButton icon={ArrowUpCircle} label={t("admin.promoteToStaff")} onClick={() => setModal("promote")} disabled={employee.accountStatus !== "ACTIVE"} />
        <ActionButton icon={Building2} label={t("admin.changeAssignment")} onClick={() => setModal("assignment")} />
        <ActionButton icon={CreditCard} label={t("admin.changeId")} onClick={() => setModal("id")} />
        <ActionButton icon={KeyRound} label={t("admin.resetPassword")} onClick={() => setModal("password")} />
        {canSuspendBan && (
          <>
            <ActionButton icon={ShieldAlert} label={t("admin.suspend")} tone="amber" onClick={() => { setStatusTarget("SUSPENDED"); setModal("status"); }} />
            <ActionButton icon={ShieldOff} label={t("admin.ban")} tone="red" onClick={() => { setStatusTarget("BANNED"); setModal("status"); }} />
          </>
        )}
        {canReactivate && (
          <ActionButton icon={ShieldCheck} label={t("admin.reactivate")} tone="emerald" onClick={() => { setStatusTarget("ACTIVE"); setModal("status"); }} />
        )}
      </div>

      {modal === "promote" && <PromoteModal employee={employee} onClose={() => setModal(null)} onDone={onChanged} />}
      {modal === "assignment" && <AssignmentModal employee={employee} onClose={() => setModal(null)} onDone={onChanged} />}
      {modal === "id" && <ChangeIdModal employee={employee} onClose={() => setModal(null)} onDone={onChanged} />}
      {modal === "password" && <ResetPasswordModal employee={employee} onClose={() => setModal(null)} onDone={onChanged} />}
      {modal === "status" && (
        <StatusModal employee={employee} targetStatus={statusTarget} onClose={() => setModal(null)} onDone={onChanged} />
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, disabled, tone }) {
  const toneClass =
    tone === "amber" ? "text-amber-400 hover:border-amber-500/40" :
    tone === "red" ? "text-red-400 hover:border-red-500/40" :
    tone === "emerald" ? "text-emerald-400 hover:border-emerald-500/40" :
    "text-white hover:border-[#F47A20]/40";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${toneClass}`}
    >
      <Icon size={16} />
      <span className="text-[11px] font-medium text-center">{label}</span>
    </button>
  );
}

function ErrorText({ error }) {
  if (!error) return null;
  return <p className="text-xs text-red-400">{error}</p>;
}

// --- Promote (Employee -> Staff account-type transition, §5-7) ---
function PromoteModal({ employee, onClose, onDone }) {
  const { t } = useTranslation();
  const [role, setRole] = useState("SUPERVISOR");
  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const [marketId, setMarketId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const needsMarket = role === "SUPERVISOR" || role === "OVERLOOKING_SUPERVISOR";
  const needsZone = role === "REGIONAL_MANAGER";
  const ready = email && password.length >= 8 && (!needsMarket || marketId) && (!needsZone || zoneId);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await promoteEmployeeToStaff(employee.id, {
        role, email, password,
        marketId: needsMarket ? marketId : undefined,
        zoneIds: needsZone ? [Number(zoneId)] : undefined,
      });
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotPromoteThisEmployee"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("admin.changeRole")}>
      <div className="space-y-4">
        {!confirming ? (
          <>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.newRole")}</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
                <option value="SUPERVISOR">{t("roles.supervisor")}</option>
                <option value="OVERLOOKING_SUPERVISOR">{t("emp.overlookingSupervisor")}</option>
                <option value="REGIONAL_MANAGER">{t("roles.regionalManager")}</option>
              </select>
            </div>
            {needsMarket && (
              <div>
                <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("sup.market")}</label>
                <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
                  <option value="">{t("admin.selectAMarket")}</option>
                  {(markets ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            {needsZone && (
              <div>
                <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.zoneNumber")}</label>
                <input type="number" value={zoneId} onChange={(e) => setZoneId(e.target.value)} placeholder={t("admin.eG1")} className={inputClass} />
              </div>
            )}
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.newStaffEmail")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.initialPassword")}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("admin.atLeast8Characters")} className={inputClass} autoComplete="new-password" />
            </div>
            <button
              type="button"
              disabled={!ready}
              onClick={() => setConfirming(true)}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors"
            >
              {t("admin.continue")}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06] text-sm">
              <p className="text-white font-semibold mb-2">{employee.name}</p>
              <p className="text-[#8B93A8]">{t("admin.workerCashier")} <span className="text-white">→</span> {role.replace(/_/g, " ")}</p>
              {needsMarket && <p className="text-[#8B93A8] mt-1">{t("admin.market")} <span className="text-white">{markets?.find((m) => m.id === marketId)?.name}</span></p>}
              {needsZone && <p className="text-[#8B93A8] mt-1">{t("admin.zone")} <span className="text-white">{zoneId}</span></p>}
              <p className="text-[11px] text-amber-400/90 mt-2">{t("admin.theirExistingEmployeeLoginWillStop")}</p>
            </div>
            <ErrorText error={error} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] transition-colors">{t("common.back")}</button>
              <button type="button" onClick={handleConfirm} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
                {busy ? t("admin.promoting") : t("admin.confirmChange")}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// --- Change Assignment (market/shift, §9/§11-12) ---
// Department is intentionally not editable here — see this file's own
// top comment for why (it's a Supervisor call, and the backend already
// clears it on a market change).
function AssignmentModal({ employee, onClose, onDone }) {
  const { t } = useTranslation();
  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const [marketId, setMarketId] = useState(employee.marketId);
  const isCashier = employee.role === "CASHIER";
  // Cashier shift is a real backend enum with no NIGHT value at all
  // (Cashiers are never on a Night shift — see Employee.cashierShift's
  // own schema comment), so its option set is deliberately narrower
  // than the Worker/Butcher one below.
  const shiftOptions = isCashier
    ? [
        { value: "MORNING", label: t("emp.morningShift") },
        { value: "EVENING", label: t("emp.eveningShift") },
      ]
    : [
        { value: "Morning Shift", label: t("emp.morningShift") },
        { value: "Afternoon Shift", label: t("sup.afternoonShift") },
        { value: "Night Shift", label: t("emp.nightShift") },
      ];
  const currentShift = employee.shift ?? employee.cashierShift ?? "";
  const [shift, setShift] = useState(currentShift);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const shiftField = isCashier ? { cashierShift: shift || null } : { shift: shift || null };
      await updateEmployee(employee.id, { marketId, ...shiftField });
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotUpdateThisAssignment"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("admin.changeAssignment")}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("sup.market")}</label>
          <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
            {(markets ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("emp.shift")}</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)} className={selectClass}>
            {shiftOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <ErrorText error={error} />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {busy ? t("emp.saving") : t("admin.confirmChange")}
        </button>
      </div>
    </Modal>
  );
}

// --- Change Employee ID (§13) ---
function ChangeIdModal({ employee, onClose, onDone }) {
  const { t } = useTranslation();
  const isCashier = employee.role === "CASHIER";
  const [value, setValue] = useState((isCashier ? employee.username : employee.employeeCode) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await updateEmployee(employee.id, isCashier ? { username: value } : { employeeCode: value });
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.thisIdIsAlreadyInUse"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("admin.changeEmployeeId")}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{isCashier ? t("sup.username") : t("auth.employeeCode")}</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
        </div>
        <ErrorText error={error} />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || !value.trim()}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {busy ? t("emp.saving") : t("admin.confirmChange")}
        </button>
      </div>
    </Modal>
  );
}

// --- Reset Password (§14/§31) ---
function ResetPasswordModal({ employee, onClose, onDone }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    if (password.length < 8) return setError(t("admin.passwordMustBeAtLeast8"));
    if (password !== confirm) return setError(t("admin.passwordsDoNotMatch"));
    setBusy(true);
    setError(null);
    try {
      await resetEmployeePassword(employee.id, password);
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotResetThePassword"));
    } finally {
      setBusy(false);
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <Modal open onClose={onClose} title={t("admin.resetPassword")}>
      <div className="space-y-4">
        <p className="text-xs text-[#8B93A8]">{t("admin.thisEmployeeSExistingSessionWill")}</p>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("settings.newPassword")}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.confirmPassword")}</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <ErrorText error={error} />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {busy ? t("admin.resetting") : t("admin.confirmReset")}
        </button>
      </div>
    </Modal>
  );
}

// --- Account status: Suspend / Ban / Reactivate (§16-18) ---
function StatusModal({ employee, targetStatus, onClose, onDone }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const needsReason = targetStatus !== "ACTIVE";
  const title = targetStatus === "SUSPENDED" ? t("admin.suspendAccount") : targetStatus === "BANNED" ? t("admin.banAccount") : t("admin.reactivateAccount");

  async function handleConfirm() {
    if (needsReason && !reason.trim()) return setError(t("admin.aReasonIsRequired"));
    setBusy(true);
    setError(null);
    try {
      await setEmployeeAccountStatus(employee.id, targetStatus, reason.trim() || undefined);
      // Cleanup Phase §7 — close THIS modal first, then tell the parent
      // to reload. The old order (reload, then close) let `onDone` (a
      // `reload` that flips the profile page into its loading state,
      // unmounting this whole panel + its still-open modal) run before
      // `onClose` had a chance to fire — a real state update queued
      // against a component that could already be gone. Closing first is
      // always safe (it only ever touches this modal's own local state);
      // the reload then runs against a page that's still there.
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotUpdateTheAccountStatus"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-xs text-[#8B93A8]">
          {targetStatus === "ACTIVE" ? t("admin.thisEmployeeWillBeAbleTo") : t("admin.thisEmployeeWillNoLongerBe")}
        </p>
        {needsReason && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("emp.reason")}</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} />
          </div>
        )}
        <ErrorText error={error} />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] transition-colors">{t("common.cancel")}</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              targetStatus === "ACTIVE" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {busy ? t("emp.saving") : t("rm.confirmAction", { action: title })}
          </button>
        </div>
      </div>
    </Modal>
  );
}
