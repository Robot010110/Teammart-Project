import { useState } from "react";
import { KeyRound, Check, Loader2 } from "lucide-react";
import { updateEmployee } from "../../services/staffEmployeeService";
import { ApiError } from "../../services/apiClient";

// AssignCredentialsField.jsx — spec §4/§7: a pending hire (created with
// no employeeCode/username/password — see the Employee model's own
// comment on why that's supported) can't log in until a staff member
// assigns real credentials here. Same inline-edit-card pattern as
// DepartmentField.jsx in EmployeeInfoScreen.jsx, just for the User ID +
// password instead of department. Only rendered for a genuinely pending
// employee (employee.employeeCode == null) — an already-activated
// employee's User ID is shown as plain text there, not re-editable from
// this card (self-service change from their own Settings covers that).
export default function AssignCredentialsField({ employee, onSaved }) {
  const [editing, setEditing] = useState(false);
  const idLabel = employee.role === "CASHIER" ? "Username" : "Employee Code";
  const idField = employee.role === "CASHIER" ? "username" : "employeeCode";
  const [idValue, setIdValue] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!idValue.trim() || password.length < 6) {
      setError("Enter a User ID and a password of at least 6 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateEmployee(employee.id, { [idField]: idValue.trim(), password });
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign credentials.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl p-3 bg-white/[0.03] border border-[#F47A20]/30">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">
          <KeyRound size={11} /> Assign Credentials
        </p>
        <div className="space-y-2">
          <input
            autoFocus
            value={idValue}
            onChange={(e) => setIdValue(e.target.value)}
            placeholder={idLabel}
            className="w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temporary password"
            className="w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>
        {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setIdValue(""); setPassword(""); setError(null); }}
            disabled={saving}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full rounded-xl p-3 bg-amber-500/[0.06] border border-amber-500/20 text-left hover:border-amber-500/35 transition-colors"
    >
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-amber-400">
        <KeyRound size={11} /> Pending — No Login Yet
      </p>
      <p className="mt-1 text-sm font-medium text-white">Tap to assign a {idLabel.toLowerCase()} and temporary password</p>
    </button>
  );
}
