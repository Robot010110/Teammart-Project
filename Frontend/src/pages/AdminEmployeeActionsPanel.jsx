import { useState } from "react";
import { ShieldAlert, ShieldOff, ShieldCheck, KeyRound, ArrowUpCircle, Building2, CreditCard } from "lucide-react";
import Modal from "../components/common/Modal";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/apiClient";
import { updateEmployee, assignDepartment } from "../services/staffEmployeeService";
import { listMarkets } from "../services/marketService";
import { listMarketDepartments } from "../services/departmentClosingService";
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
// shift/department changes and Employee ID changes reuse the EXISTING
// updateEmployee/assignDepartment endpoints (already ADMIN-accessible)
// rather than duplicating them — see adminService.js's own comment.
export default function AdminEmployeeActionsPanel({ employee, onChanged }) {
  const [modal, setModal] = useState(null); // "promote" | "assignment" | "id" | "password" | "status"
  const [statusTarget, setStatusTarget] = useState(null); // "SUSPENDED" | "BANNED" | "ACTIVE"

  const canSuspendBan = employee.accountStatus === "ACTIVE";
  const canReactivate = employee.accountStatus === "SUSPENDED" || employee.accountStatus === "BANNED";

  return (
    <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Administrative Actions</h2>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#8B93A8]">Employment: <span className="text-white">{employee.employmentStatus}</span></span>
          <span className="text-[#8B93A8]">·</span>
          <span className={employee.accountStatus === "ACTIVE" ? "text-emerald-400" : "text-red-400"}>
            Account: {employee.accountStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <ActionButton icon={ArrowUpCircle} label="Promote to Staff" onClick={() => setModal("promote")} disabled={employee.accountStatus !== "ACTIVE"} />
        <ActionButton icon={Building2} label="Change Assignment" onClick={() => setModal("assignment")} />
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
      setError(err instanceof ApiError ? err.message : "Could not promote this employee.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Change Role">
      <div className="space-y-4">
        {!confirming ? (
          <>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">New Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="OVERLOOKING_SUPERVISOR">Overlooking Supervisor</option>
                <option value="REGIONAL_MANAGER">Regional Manager</option>
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
                <input type="number" value={zoneId} onChange={(e) => setZoneId(e.target.value)} placeholder="e.g. 1" className={inputClass} />
              </div>
            )}
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">New Staff Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Initial Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={inputClass} autoComplete="new-password" />
            </div>
            <button
              type="button"
              disabled={!ready}
              onClick={() => setConfirming(true)}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06] text-sm">
              <p className="text-white font-semibold mb-2">{employee.name}</p>
              <p className="text-[#8B93A8]">Worker/Cashier <span className="text-white">→</span> {role.replace(/_/g, " ")}</p>
              {needsMarket && <p className="text-[#8B93A8] mt-1">Market: <span className="text-white">{markets?.find((m) => m.id === marketId)?.name}</span></p>}
              {needsZone && <p className="text-[#8B93A8] mt-1">Zone: <span className="text-white">{zoneId}</span></p>}
              <p className="text-[11px] text-amber-400/90 mt-2">Their existing employee login will stop working immediately.</p>
            </div>
            <ErrorText error={error} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] transition-colors">Back</button>
              <button type="button" onClick={handleConfirm} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
                {busy ? "Promoting..." : "Confirm Change"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// --- Change Assignment (market/shift/department, §9/§11-12) ---
function AssignmentModal({ employee, onClose, onDone }) {
  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const [marketId, setMarketId] = useState(employee.marketId);
  const [shift, setShift] = useState(employee.shift ?? employee.cashierShift ?? "");
  const { data: departments } = useAsync(() => listMarketDepartments(marketId), { deps: [marketId] });
  const [department, setDepartment] = useState(employee.department ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const shiftField = employee.role === "CASHIER" ? { cashierShift: shift || null } : { shift: shift || null };
      await updateEmployee(employee.id, { marketId, ...shiftField });
      if (department && department !== employee.department && marketId === employee.marketId) {
        await assignDepartment(employee.id, department);
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
    <Modal open onClose={onClose} title="Change Assignment">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Market</label>
          <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
            {(markets ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Shift</label>
          <input value={shift} onChange={(e) => setShift(e.target.value)} placeholder="e.g. MORNING" className={inputClass} />
        </div>
        {marketId === employee.marketId && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass}>
              <option value="">No change</option>
              {(departments ?? []).map((d) => (
                <option key={d.marketDepartmentId ?? d.department} value={d.department}>{d.department}</option>
              ))}
            </select>
          </div>
        )}
        {marketId !== employee.marketId && (
          <p className="text-[11px] text-amber-400/90">Changing market clears the current department — assign a new one afterward from the market's own screen.</p>
        )}
        <ErrorText error={error} />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {busy ? "Saving..." : "Confirm Change"}
        </button>
      </div>
    </Modal>
  );
}

// --- Change Employee ID (§13) ---
function ChangeIdModal({ employee, onClose, onDone }) {
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
      setError(err instanceof ApiError ? err.message : "This ID is already in use.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Change Employee ID">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{isCashier ? "Username" : "Employee Code"}</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
        </div>
        <ErrorText error={error} />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || !value.trim()}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {busy ? "Saving..." : "Confirm Change"}
        </button>
      </div>
    </Modal>
  );
}

// --- Reset Password (§14/§31) ---
function ResetPasswordModal({ employee, onClose, onDone }) {
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
      await resetEmployeePassword(employee.id, password);
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
    <Modal open onClose={onClose} title="Reset Password">
      <div className="space-y-4">
        <p className="text-xs text-[#8B93A8]">This employee's existing session will be signed out immediately.</p>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">New Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Confirm Password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <ErrorText error={error} />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {busy ? "Resetting..." : "Confirm Reset"}
        </button>
      </div>
    </Modal>
  );
}

// --- Account status: Suspend / Ban / Reactivate (§16-18) ---
function StatusModal({ employee, targetStatus, onClose, onDone }) {
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
      setError(err instanceof ApiError ? err.message : "Could not update the account status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-xs text-[#8B93A8]">
          {targetStatus === "ACTIVE" ? "This employee will be able to log in again." : "This employee will no longer be able to log in. Their history is preserved."}
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
    </Modal>
  );
}
