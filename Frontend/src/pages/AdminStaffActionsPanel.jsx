import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ShieldOff, ShieldCheck, KeyRound, RefreshCw, Building2, CreditCard } from "lucide-react";
import Modal from "../components/common/Modal";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/apiClient";
import { listMarkets, assignMarketSupervisor, assignMarketOverlookingSupervisor } from "../services/marketService";
import {
  updateStaffProfile, changeStaffRole, setRegionalManagerZones,
  demoteStaffToEmployee, resetStaffPassword, setStaffAccountStatus,
} from "../services/adminService";

const inputClass =
  "w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50";
const selectClass = inputClass;

// AdminStaffActionsPanel.jsx — Admin Phase 2 §3-8/§28: the staff-account
// counterpart to AdminEmployeeActionsPanel.jsx, opened from a staff row
// in AdminStaffPage.jsx. Role change (same-table), market/zone
// reassignment, demotion to Employee, password reset, and account status
// are all real ADMIN-only backend calls — same confirmation-first
// pattern as the employee panel.
export default function AdminStaffActionsPanel({ staff, onClose, onChanged }) {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const canSuspendBan = staff.accountStatus === "ACTIVE";
  const canReactivate = staff.accountStatus === "SUSPENDED" || staff.accountStatus === "BANNED";
  const scopeLabel =
    staff.managedMarket ? t("admin.marketNamed", { name: staff.managedMarket.name }) :
    staff.managedOverlookingMarket ? t("admin.marketNamedOverlooking", { name: staff.managedOverlookingMarket.name }) :
    staff.managedZones?.length ? t("admin.zonesNumbered", { numbers: staff.managedZones.map((z) => z.number).join(", ") }) :
    t("admin.noAssignment");

  function done() {
    onChanged();
  }

  const STAFF_ROLE_LABEL = {
    SUPERVISOR: "roles.supervisor",
    OVERLOOKING_SUPERVISOR: "emp.overlookingSupervisor",
    REGIONAL_MANAGER: "roles.regionalManager",
    ADMIN: "roles.admin",
  };
  const ACCOUNT_STATUS_LABEL = { ACTIVE: "status.active", SUSPENDED: "admin.suspended", BANNED: "admin.banned" };
  // Covers every value this screen's role-change flow can produce or
  // demote to, including the Worker/Cashier/Butcher employee roles the
  // staff map above doesn't need.
  const ANY_ROLE_LABEL = {
    ...STAFF_ROLE_LABEL,
    WORKER: "roles.worker",
    CASHIER: "roles.cashier",
    BUTCHER: "sup.butcher",
  };

  return (
    <Modal open onClose={onClose} title={staff.name}>
      <div className="space-y-4">
        <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06] text-xs">
          <p className="text-[#8B93A8]">{staff.email} · <span className="text-white">{
            STAFF_ROLE_LABEL[staff.role] ? t(STAFF_ROLE_LABEL[staff.role]) : staff.role.replace(/_/g, " ")
          }</span></p>
          <p className="text-[#8B93A8] mt-1">{scopeLabel}</p>
          <p className="mt-1">{t("admin.account")} <span className={staff.accountStatus === "ACTIVE" ? "text-emerald-400" : "text-red-400"}>{
            ACCOUNT_STATUS_LABEL[staff.accountStatus] ? t(ACCOUNT_STATUS_LABEL[staff.accountStatus]) : staff.accountStatus
          }</span></p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <ActionButton icon={RefreshCw} label={t("admin.changeRole")} onClick={() => setModal("role")} />
          {(staff.role === "SUPERVISOR" || staff.role === "OVERLOOKING_SUPERVISOR" || staff.role === "REGIONAL_MANAGER") && (
            <ActionButton icon={Building2} label={t("admin.changeAssignment")} onClick={() => setModal("assignment")} />
          )}
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
      </div>

      {modal === "role" && <RoleModal staff={staff} onClose={() => setModal(null)} onDone={done} />}
      {modal === "assignment" && <AssignmentModal staff={staff} onClose={() => setModal(null)} onDone={done} />}
      {modal === "id" && <IdModal staff={staff} onClose={() => setModal(null)} onDone={done} />}
      {modal === "password" && <PasswordModal staff={staff} onClose={() => setModal(null)} onDone={done} />}
      {modal === "status" && <StatusModal staff={staff} targetStatus={statusTarget} onClose={() => setModal(null)} onDone={done} />}
    </Modal>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone }) {
  const toneClass =
    tone === "amber" ? "text-amber-400 hover:border-amber-500/40" :
    tone === "red" ? "text-red-400 hover:border-red-500/40" :
    tone === "emerald" ? "text-emerald-400 hover:border-emerald-500/40" :
    "text-white hover:border-[#F47A20]/40";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06] transition-colors ${toneClass}`}
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

// Nested modal — Modal.jsx portal-renders, so stacking is fine visually;
// this one always fully replaces its parent's content when open since
// each of these is its own <Modal>.
function Sub({ title, children, onClose }) {
  return <Modal open onClose={onClose} title={title}>{children}</Modal>;
}

function RoleModal({ staff, onClose, onDone }) {
  const { t } = useTranslation();
  const [target, setTarget] = useState("SUPERVISOR"); // one of the 4 StaffRole values, or "EMPLOYEE" to demote
  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const [marketId, setMarketId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [employeeRole, setEmployeeRole] = useState("WORKER");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const needsMarket = target === "SUPERVISOR" || target === "OVERLOOKING_SUPERVISOR";
  const needsZone = target === "REGIONAL_MANAGER";
  const isDemote = target === "EMPLOYEE";
  const ready = isDemote
    ? marketId && employeePassword.length >= 8 && (employeeRole !== "CASHIER" || employeeUsername)
    : (!needsMarket || marketId) && (!needsZone || zoneId);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      if (isDemote) {
        await demoteStaffToEmployee(staff.id, { role: employeeRole, marketId, password: employeePassword, username: employeeRole === "CASHIER" ? employeeUsername : undefined });
      } else {
        await changeStaffRole(staff.id, { role: target, marketId: needsMarket ? marketId : undefined, zoneIds: needsZone ? [Number(zoneId)] : undefined });
      }
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotChangeThisRole"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sub title={t("admin.changeRole")} onClose={onClose}>
      <div className="space-y-4">
        {!confirming ? (
          <>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.newRole")}</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectClass}>
                <option value="SUPERVISOR">{t("roles.supervisor")}</option>
                <option value="OVERLOOKING_SUPERVISOR">{t("emp.overlookingSupervisor")}</option>
                <option value="REGIONAL_MANAGER">{t("roles.regionalManager")}</option>
                <option value="ADMIN">{t("roles.admin")}</option>
                <option value="EMPLOYEE">{t("admin.employeeWorkerCashierButcher")}</option>
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
                <input type="number" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={inputClass} />
              </div>
            )}
            {isDemote && (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.employeeRole")}</label>
                  <select value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value)} className={selectClass}>
                    <option value="WORKER">{t("roles.worker")}</option>
                    <option value="CASHIER">{t("roles.cashier")}</option>
                    <option value="BUTCHER">{t("sup.butcher")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("sup.market")}</label>
                  <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
                    <option value="">{t("admin.selectAMarket")}</option>
                    {(markets ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                {employeeRole === "CASHIER" && (
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("sup.username")}</label>
                    <input value={employeeUsername} onChange={(e) => setEmployeeUsername(e.target.value)} className={inputClass} />
                  </div>
                )}
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.initialPassword")}</label>
                  <input type="password" value={employeePassword} onChange={(e) => setEmployeePassword(e.target.value)} placeholder={t("admin.atLeast8Characters")} className={inputClass} autoComplete="new-password" />
                </div>
              </>
            )}
            <button
              type="button"
              disabled={!ready || target === staff.role}
              onClick={() => setConfirming(true)}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors"
            >
              {t("admin.continue")}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06] text-sm">
              <p className="text-white font-semibold mb-2">{staff.name}</p>
              <p className="text-[#8B93A8]">
                {ANY_ROLE_LABEL[staff.role] ? t(ANY_ROLE_LABEL[staff.role]) : staff.role.replace(/_/g, " ")}
                {" "}<span className="text-white">→</span>{" "}
                {isDemote
                  ? (ANY_ROLE_LABEL[employeeRole] ? t(ANY_ROLE_LABEL[employeeRole]) : employeeRole)
                  : (ANY_ROLE_LABEL[target] ? t(ANY_ROLE_LABEL[target]) : target.replace(/_/g, " "))}
              </p>
              <p className="text-[11px] text-amber-400/90 mt-2">{t("admin.theirExistingSessionWillStopWorking")}</p>
            </div>
            <ErrorText error={error} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] transition-colors">{t("common.back")}</button>
              <button type="button" onClick={handleConfirm} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
                {busy ? t("emp.saving") : t("admin.confirmChange")}
              </button>
            </div>
          </>
        )}
      </div>
    </Sub>
  );
}

function AssignmentModal({ staff, onClose, onDone }) {
  const { t } = useTranslation();
  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const [marketId, setMarketId] = useState(staff.managedMarket?.id ?? staff.managedOverlookingMarket?.id ?? "");
  const [zoneIds, setZoneIds] = useState((staff.managedZones ?? []).map((z) => String(z.id)).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      if (staff.role === "REGIONAL_MANAGER") {
        const ids = zoneIds.split(",").map((v) => Number(v.trim())).filter(Boolean);
        await setRegionalManagerZones(staff.id, ids);
      } else if (staff.role === "SUPERVISOR") {
        await assignMarketSupervisor(marketId, staff.id);
      } else if (staff.role === "OVERLOOKING_SUPERVISOR") {
        await assignMarketOverlookingSupervisor(marketId, staff.id);
      }
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotUpdateThisAssignment"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sub title={t("admin.changeAssignment")} onClose={onClose}>
      <div className="space-y-4">
        {staff.role === "REGIONAL_MANAGER" ? (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.zoneNumbersCommaSeparated")}</label>
            <input value={zoneIds} onChange={(e) => setZoneIds(e.target.value)} placeholder={t("admin.eG12")} className={inputClass} />
            <p className="mt-1.5 text-[11px] text-[#6B7284]">{t("admin.replacesTheFullZoneListA")}</p>
          </div>
        ) : (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("sup.market")}</label>
            <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
              <option value="">{t("admin.selectAMarket")}</option>
              {(markets ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <ErrorText error={error} />
        <button type="button" onClick={handleConfirm} disabled={busy} className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
          {busy ? t("emp.saving") : t("admin.confirmChange")}
        </button>
      </div>
    </Sub>
  );
}

function IdModal({ staff, onClose, onDone }) {
  const { t } = useTranslation();
  const [loginId, setLoginId] = useState(staff.loginId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await updateStaffProfile(staff.id, { loginId: loginId || null });
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.thisIdIsAlreadyInUse"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sub title={t("admin.changeUserId")} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.userIdLogin")}</label>
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} className={inputClass} />
        </div>
        <ErrorText error={error} />
        <button type="button" onClick={handleConfirm} disabled={busy} className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
          {busy ? t("emp.saving") : t("admin.confirmChange")}
        </button>
      </div>
    </Sub>
  );
}

function PasswordModal({ staff, onClose, onDone }) {
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
      await resetStaffPassword(staff.id, password);
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
    <Sub title={t("admin.resetPassword")} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[#8B93A8]">{t("admin.thisAccountSExistingSessionWill")}</p>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("settings.newPassword")}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.confirmPassword")}</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <ErrorText error={error} />
        <button type="button" onClick={handleConfirm} disabled={busy} className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
          {busy ? t("admin.resetting") : t("admin.confirmReset")}
        </button>
      </div>
    </Sub>
  );
}

function StatusModal({ staff, targetStatus, onClose, onDone }) {
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
      await setStaffAccountStatus(staff.id, targetStatus, reason.trim() || undefined);
      // Cleanup Phase §7 — same ordering fix as AdminEmployeeActionsPanel's
      // StatusModal: close this modal before triggering the parent's
      // reload, not after.
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotUpdateTheAccountStatus"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sub title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[#8B93A8]">
          {targetStatus === "ACTIVE" ? t("admin.thisAccountWillBeAbleTo") : t("admin.thisAccountWillNoLongerBe")}
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
    </Sub>
  );
}
