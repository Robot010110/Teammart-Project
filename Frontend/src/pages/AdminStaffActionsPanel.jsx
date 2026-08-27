import { useState } from "react";
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
  const [modal, setModal] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const canSuspendBan = staff.accountStatus === "ACTIVE";
  const canReactivate = staff.accountStatus === "SUSPENDED" || staff.accountStatus === "BANNED";
  const scopeLabel =
    staff.managedMarket ? `Market: ${staff.managedMarket.name}` :
    staff.managedOverlookingMarket ? `Market: ${staff.managedOverlookingMarket.name} (Overlooking)` :
    staff.managedZones?.length ? `Zones: ${staff.managedZones.map((z) => z.number).join(", ")}` :
    "No assignment";

  function done() {
    onChanged();
  }

  return (
    <Modal open onClose={onClose} title={staff.name}>
      <div className="space-y-4">
        <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06] text-xs">
          <p className="text-[#8B93A8]">{staff.email} · <span className="text-white">{staff.role.replace(/_/g, " ")}</span></p>
          <p className="text-[#8B93A8] mt-1">{scopeLabel}</p>
          <p className="mt-1">Account: <span className={staff.accountStatus === "ACTIVE" ? "text-emerald-400" : "text-red-400"}>{staff.accountStatus}</span></p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <ActionButton icon={RefreshCw} label="Change Role" onClick={() => setModal("role")} />
          {(staff.role === "SUPERVISOR" || staff.role === "OVERLOOKING_SUPERVISOR" || staff.role === "REGIONAL_MANAGER") && (
            <ActionButton icon={Building2} label="Change Assignment" onClick={() => setModal("assignment")} />
          )}
          <ActionButton icon={CreditCard} label="Change ID" onClick={() => setModal("id")} />
          <ActionButton icon={KeyRound} label="Reset Password" onClick={() => setModal("password")} />
          {canSuspendBan && (
            <>
              <ActionButton icon={ShieldAlert} label="Suspend" tone="amber" onClick={() => { setStatusTarget("SUSPENDED"); setModal("status"); }} />
              <ActionButton icon={ShieldOff} label="Ban" tone="red" onClick={() => { setStatusTarget("BANNED"); setModal("status"); }} />
            </>
          )}
          {canReactivate && (
            <ActionButton icon={ShieldCheck} label="Reactivate" tone="emerald" onClick={() => { setStatusTarget("ACTIVE"); setModal("status"); }} />
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
      setError(err instanceof ApiError ? err.message : "Could not change this role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sub title="Change Role" onClose={onClose}>
      <div className="space-y-4">
        {!confirming ? (
          <>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">New Role</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectClass}>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="OVERLOOKING_SUPERVISOR">Overlooking Supervisor</option>
                <option value="REGIONAL_MANAGER">Regional Manager</option>
                <option value="ADMIN">Admin</option>
                <option value="EMPLOYEE">Employee (Worker/Cashier/Butcher)</option>
              </select>
            </div>
            {needsMarket && (
              <div>
                <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Market</label>
                <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
                  <option value="">Select a market</option>
                  {(markets ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            {needsZone && (
              <div>
                <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Zone Number</label>
                <input type="number" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={inputClass} />
              </div>
            )}
            {isDemote && (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Employee Role</label>
                  <select value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value)} className={selectClass}>
                    <option value="WORKER">Worker</option>
                    <option value="CASHIER">Cashier</option>
                    <option value="BUTCHER">Butcher</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Market</label>
                  <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
                    <option value="">Select a market</option>
                    {(markets ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                {employeeRole === "CASHIER" && (
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Username</label>
                    <input value={employeeUsername} onChange={(e) => setEmployeeUsername(e.target.value)} className={inputClass} />
                  </div>
                )}
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Initial Password</label>
                  <input type="password" value={employeePassword} onChange={(e) => setEmployeePassword(e.target.value)} placeholder="At least 8 characters" className={inputClass} autoComplete="new-password" />
                </div>
              </>
            )}
            <button
              type="button"
              disabled={!ready || target === staff.role}
              onClick={() => setConfirming(true)}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06] text-sm">
              <p className="text-white font-semibold mb-2">{staff.name}</p>
              <p className="text-[#8B93A8]">{staff.role.replace(/_/g, " ")} <span className="text-white">→</span> {isDemote ? employeeRole : target.replace(/_/g, " ")}</p>
              <p className="text-[11px] text-amber-400/90 mt-2">Their existing session will stop working immediately.</p>
            </div>
            <ErrorText error={error} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] transition-colors">Back</button>
              <button type="button" onClick={handleConfirm} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
                {busy ? "Saving..." : "Confirm Change"}
              </button>
            </div>
          </>
        )}
      </div>
    </Sub>
  );
}

function AssignmentModal({ staff, onClose, onDone }) {
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
      setError(err instanceof ApiError ? err.message : "Could not update this assignment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sub title="Change Assignment" onClose={onClose}>
      <div className="space-y-4">
        {staff.role === "REGIONAL_MANAGER" ? (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Zone Numbers (comma-separated)</label>
            <input value={zoneIds} onChange={(e) => setZoneIds(e.target.value)} placeholder="e.g. 1, 2" className={inputClass} />
            <p className="mt-1.5 text-[11px] text-[#6B7284]">Replaces the full zone list — a Regional Manager can manage multiple zones.</p>
          </div>
        ) : (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Market</label>
            <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
              <option value="">Select a market</option>
              {(markets ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <ErrorText error={error} />
        <button type="button" onClick={handleConfirm} disabled={busy} className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
          {busy ? "Saving..." : "Confirm Change"}
        </button>
      </div>
    </Sub>
  );
}

function IdModal({ staff, onClose, onDone }) {
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
      setError(err instanceof ApiError ? err.message : "This ID is already in use.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sub title="Change User ID" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">User ID (login)</label>
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} className={inputClass} />
        </div>
        <ErrorText error={error} />
        <button type="button" onClick={handleConfirm} disabled={busy} className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
          {busy ? "Saving..." : "Confirm Change"}
        </button>
      </div>
    </Sub>
  );
}

function PasswordModal({ staff, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    setError(null);
    try {
      await resetStaffPassword(staff.id, password);
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset the password.");
    } finally {
      setBusy(false);
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <Sub title="Reset Password" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[#8B93A8]">This account's existing session will be signed out immediately.</p>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">New Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Confirm Password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <ErrorText error={error} />
        <button type="button" onClick={handleConfirm} disabled={busy} className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
          {busy ? "Resetting..." : "Confirm Reset"}
        </button>
      </div>
    </Sub>
  );
}

function StatusModal({ staff, targetStatus, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const needsReason = targetStatus !== "ACTIVE";
  const title = targetStatus === "SUSPENDED" ? "Suspend Account" : targetStatus === "BANNED" ? "Ban Account" : "Reactivate Account";

  async function handleConfirm() {
    if (needsReason && !reason.trim()) return setError("A reason is required.");
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
      setError(err instanceof ApiError ? err.message : "Could not update the account status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sub title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[#8B93A8]">
          {targetStatus === "ACTIVE" ? "This account will be able to log in again." : "This account will no longer be able to log in. Their history is preserved."}
        </p>
        {needsReason && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} />
          </div>
        )}
        <ErrorText error={error} />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] transition-colors">Cancel</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              targetStatus === "ACTIVE" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {busy ? "Saving..." : `Confirm ${title}`}
          </button>
        </div>
      </div>
    </Sub>
  );
}
