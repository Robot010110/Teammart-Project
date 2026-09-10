import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Check, Loader2, ShieldCheck } from "lucide-react";
import { createCountingAssignment } from "../../services/countingAssignmentService";
import { ApiError } from "../../services/apiClient";

// CountingAssignmentField.jsx — spec §1-3: a Supervisor assigns an
// employee to count a department/area (defaults to the employee's own
// department if left as-is; a DIFFERENT department automatically routes
// to the market's Regional/Zone Manager for verification — see
// countingAssignmentsController.createCountingAssignment). Same inline-
// edit-card pattern as DepartmentField/AssignCredentialsField in
// EmployeeInfoScreen.jsx.
export default function CountingAssignmentField({ employee, onAssigned }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [department, setDepartment] = useState(employee.department || "");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!department.trim()) {
      setError(t("sup.enterADepartment"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const assignment = await createCountingAssignment({
        employeeId: employee.id,
        assignedDepartment: department.trim(),
        countingArea: area.trim() || undefined,
      });
      onAssigned(assignment);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("sup.couldNotSaveThisAssignment"));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl p-3 bg-white/[0.03] border border-[#F47A20]/30">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">
          <ClipboardList size={11} /> {t("sup.inventoryCountingAssignment")}
        </p>
        <div className="space-y-2">
          <input
            autoFocus
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder={t("sup.departmentEGFood2")}
            className="w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder={t("sup.specificAreaEGAisle4")}
            className="w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>
        {department.trim() && department.trim() !== employee.department && (
          <p className="mt-1.5 text-[11px] text-amber-400">
            {t("sup.differentFromUsualDepartment", { name: employee.name.split(" ")[0], department: employee.department || t("sup.none") })}
          </p>
        )}
        {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {t("common.save")}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); }}
            disabled={saving}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1]"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full rounded-xl p-3 bg-white/[0.03] border border-white/[0.06] text-start hover:border-[#F47A20]/25 transition-colors"
    >
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]">
        <ClipboardList size={11} /> {t("sup.inventoryCounting")}
      </p>
      <p className="mt-1 text-sm font-medium text-white flex items-center gap-1.5">
        <ShieldCheck size={13} className="text-[#4C5266]" /> {t("sup.tapToAssignCountingArea")}
      </p>
    </button>
  );
}
