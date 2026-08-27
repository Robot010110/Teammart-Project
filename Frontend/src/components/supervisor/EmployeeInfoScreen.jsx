import { useState } from "react";
import { ArrowLeft, BadgeCheck, Briefcase, Clock, CircleDot, Pencil, Check, Loader2, CalendarDays, History, ClipboardList, Moon, Layers } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { SkeletonCard } from "../common/SkeletonCard";
import { assignDepartment } from "../../services/staffEmployeeService";
import AssignCredentialsField from "./AssignCredentialsField";
import CountingAssignmentField from "./CountingAssignmentField";
import Toast from "../common/Toast";
import { useToast } from "../../hooks/useToast";
import { initialsOf } from "../../utils/initials";
import { DEPARTMENTS } from "../../utils/departments";

const EMPLOYMENT_STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave" };

function DepartmentField({ employeeId, department, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(department && DEPARTMENTS.includes(department) ? department : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await assignDepartment(employeeId, value);
      onSaved(value);
      setEditing(false);
    } catch {
      setError("Could not save this department.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl p-3 bg-white/[0.03] border border-[#F47A20]/30">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5"><Briefcase size={11} /> Department</p>
        {/* Cleanup Phase §1 — a real dropdown from the canonical
            department list, never free text; the backend independently
            enforces the same list regardless of what this renders. */}
        <select
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-2.5 py-2 text-sm text-white outline-none focus:border-[#F47A20]/50"
        >
          <option value="">Select a department...</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={handleSave} disabled={saving || !value} className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
          </button>
          <button type="button" onClick={() => { setEditing(false); setValue(department && DEPARTMENTS.includes(department) ? department : ""); }} disabled={saving} className="flex-1 rounded-lg py-1.5 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1]">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06] text-left hover:border-[#F47A20]/25 transition-colors">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]"><Briefcase size={11} /> Department</p>
        <Pencil size={12} className="text-[#4C5266]" />
      </div>
      <p className="mt-1 text-sm font-medium text-white">{department || "Not assigned"}</p>
    </button>
  );
}

// EmployeeInfoScreen.jsx — the Supervisor's read-only identity view of
// one employee (reuses the existing Employee Profile design language)
// plus the management controls a Worker/Cashier's own profile never has.
// employee/setEmployee/loading/error/reload are owned by the parent
// (SupervisorEmployeeProfileRoute.jsx) and shared with the Attendance/
// Tasks/History sub-routes so all four only ever fetch the employee once.
export default function EmployeeInfoScreen({ employee, setEmployee, loading, error, reload, onBack, onOpenAttendance, onOpenTasks, onOpenHistory }) {
  const [toast, setToast] = useToast();
  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back to Employees
      </button>

      {loading ? (
        <SkeletonCard className="h-[190px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[#1D2D5C]/50 to-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-white/[0.06] overflow-hidden">
                {employee.profilePictureUrl ? (
                  <AuthenticatedImage src={employee.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-base font-display font-bold text-white">{initialsOf(employee.name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-lg font-bold text-white truncate">{employee.name}</h1>
                <p className="text-[#F47A20] text-sm font-medium">{employee.position}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#9AA1B4]">
              {employee.employeeCode && <span className="flex items-center gap-1.5"><BadgeCheck size={13} /> {employee.employeeCode}</span>}
              {employee.username && <span className="flex items-center gap-1.5"><BadgeCheck size={13} /> {employee.username}</span>}
              {employee.shift && <span className="flex items-center gap-1.5"><Clock size={13} /> {employee.shift}</span>}
              {employee.cashierShift && <span className="flex items-center gap-1.5"><Clock size={13} /> {employee.cashierShift}</span>}
              {employee.operationalShift === "NIGHT" && (
                <span className="flex items-center gap-1.5 text-[#F47A20]"><Moon size={13} /> Night Shift</span>
              )}
              <span className="flex items-center gap-1.5">
                <CircleDot size={13} className={employee.employmentStatus === "ACTIVE" ? "text-emerald-400" : "text-[#9AA1B4]"} />
                {EMPLOYMENT_STATUS_LABEL[employee.employmentStatus] || employee.employmentStatus}
              </span>
            </div>
          </section>

          <div className="mt-4 space-y-3">
            {!employee.employeeCode && !employee.username && (
              <AssignCredentialsField
                employee={employee}
                onSaved={(updated) => setEmployee((prev) => ({ ...prev, ...updated }))}
              />
            )}
            <DepartmentField
              employeeId={employee.id}
              department={employee.department}
              onSaved={(department) => setEmployee((prev) => ({ ...prev, department }))}
            />
            {/* Additional Responsibilities — deliberately separate from
                the Main Department above, never merged into one list
                (Night Shift §4). additionalDepartments is only ever
                present here because this screen is a staff (management)
                view — see employeesController.getEmployee's own comment
                on why an employee's own self-view never gets this field. */}
            {employee.additionalDepartments?.length > 0 && (
              <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">
                  <Layers size={11} /> Additional Responsibilities
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {employee.additionalDepartments.map((d) => (
                    <span key={d} className="rounded-full px-2 py-0.5 text-xs font-medium text-white bg-white/[0.06]">{d}</span>
                  ))}
                </div>
              </div>
            )}
            <CountingAssignmentField
              employee={employee}
              onAssigned={(assignment) =>
                setToast(
                  assignment.needsVerification
                    ? "Counting assignment saved — sent to the Regional/Zone Manager for verification."
                    : "Counting assignment saved."
                )
              }
            />
          </div>
          <Toast message={toast} />

          <div className="mt-4 rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]">
            <button type="button" onClick={onOpenAttendance} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors">
              <CalendarDays size={17} className="text-[#8B93A8]" />
              <span className="flex-1 text-sm text-white">Attendance</span>
            </button>
            <button type="button" onClick={onOpenTasks} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors">
              <ClipboardList size={17} className="text-[#8B93A8]" />
              <span className="flex-1 text-sm text-white">Tasks</span>
            </button>
            <button type="button" onClick={onOpenHistory} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors">
              <History size={17} className="text-[#8B93A8]" />
              <span className="flex-1 text-sm text-white">Activity History</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
