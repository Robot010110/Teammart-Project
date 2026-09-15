import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, BadgeCheck, Briefcase, Clock, Copy, Check as CheckIcon, Pencil, Check, Loader2,
  CalendarDays, History, ClipboardList, Layers, Store, ChevronRight, TrendingUp,
} from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import PerformancePanel from "../employee/performance/PerformancePanel";
import {
  getEmployeePerformance, getEmployeePerformanceHistory, getEmployeePerformanceAggregate,
} from "../../services/performanceService";
import EmployeeTodayActivity from "./EmployeeTodayActivity";
import { assignDepartment } from "../../services/staffEmployeeService";
import { getMarketAttendanceToday } from "../../services/attendanceService";
import AssignCredentialsField from "./AssignCredentialsField";
import CountingAssignmentField from "./CountingAssignmentField";
import Toast from "../common/Toast";
import { useAsync } from "../../hooks/useAsync";
import { usePolling } from "../../hooks/usePolling";
import { useToast } from "../../hooks/useToast";
import { initialsOf } from "../../utils/initials";
import { DEPARTMENTS } from "../../utils/departments";

// Refetch cadence for the live attendance/break status below — same
// order of magnitude as ChatListScreen's own poll (12s), reusing the
// app's existing usePolling hook rather than adding a new real-time
// mechanism. usePolling is already visibility-aware (pauses while this
// tab/screen is hidden), so this doesn't burn requests in the background.
const ATTENDANCE_POLL_MS = 15000;

// Maps attendanceController.deriveAttendanceState's own output straight
// to the three states this badge is allowed to show — WORKING and
// ON_BREAK get their own look; every other state (CHECKED_OUT, MISSING/
// not-checked-in-yet, ABSENT, DAY_OFF, APPROVED_LEAVE, PENDING_REVIEW)
// is honestly "not currently working" and falls through to the same
// "Not Active" red, matching the spec's exact if/else-if/else — there is
// no fourth visual state.
const LIVE_STATUS_META = {
  WORKING: { label: "status.active", dot: "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.8)]", text: "text-emerald-400" },
  ON_BREAK: { label: "status.onBreak", dot: "bg-violet-400 shadow-[0_0_6px_1px_rgba(167,139,250,0.8)]", text: "text-violet-400" },
};
const NOT_ACTIVE_META = { label: "status.notActive", dot: "bg-red-400 shadow-[0_0_6px_1px_rgba(248,113,113,0.8)]", text: "text-red-400" };

function DepartmentField({ employeeId, department, onSaved }) {
  const { t } = useTranslation();
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
      setError(t("sup.couldNotSaveThisDepartment"));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl p-3 bg-white/[0.03] border border-[#F47A20]/30">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5"><Briefcase size={11} /> {t("emp.department")}</p>
        <select
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-2.5 py-2 text-sm text-white outline-none focus:border-[#F47A20]/50"
        >
          <option value="">{t("sup.selectADepartment")}</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={handleSave} disabled={saving || !value} className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {t("common.save")}
          </button>
          <button type="button" onClick={() => { setEditing(false); setValue(department && DEPARTMENTS.includes(department) ? department : ""); }} disabled={saving} className="flex-1 rounded-lg py-1.5 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1]">
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
      className="rounded-2xl p-3.5 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border border-sky-500/[0.18] text-start backdrop-blur-xl shadow-[0_10px_24px_-16px_rgba(0,0,0,0.9),0_0_24px_-14px_rgba(56,189,248,0.4)] transition-all duration-150 hover:border-sky-500/35"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30">
          <Briefcase size={14} />
        </span>
        <p className="flex-1 text-[11px] uppercase tracking-wide text-[#8B93A8]">{t("emp.department")}</p>
        <Pencil size={12} className="text-[#4C5266]" />
      </div>
      <p className="mt-2 text-[14px] font-semibold text-white">{department || t("emp.notAssigned")}</p>
    </button>
  );
}

// EmployeeInfoScreen.jsx — the Supervisor's identity + at-a-glance view
// of one employee, reference-matched: a premium hero, two real info
// tiles, a 2x2 colored quick-access grid, and Today's Activity (see
// EmployeeTodayActivity.jsx) replacing the previous plain "Quick Info"
// block. employee/setEmployee/loading/error/reload are owned by the
// parent (SupervisorEmployeeProfileRoute.jsx) and shared with the
// Attendance/Tasks/History sub-routes so all four only ever fetch the
// employee once.
//
// The reference's "Manager" info tile is not reproduced: this account
// has no real data source for it (an Employee has no stored manager
// relationship distinct from the Supervisor viewing this page, and no
// endpoint returns one) — showing it would mean fabricating a value.
// "Performance" opens the one real, already-stored figure this backend
// has for another employee's performance (Employee.performanceRate) in
// a plain modal, rather than building a second full performance-history
// system: the rich trend/breakdown view under PerformanceHistoryScreen
// only exists as a SELF-service endpoint (no staff/employeeId variant),
// and this pass explicitly rules out a backend rebuild to add one.
export default function EmployeeInfoScreen({ employee, setEmployee, loading, error, reload, marketName, marketId, onBack, onOpenAttendance, onOpenTasks, onOpenHistory }) {
  const { t } = useTranslation();
  const [toast, setToast] = useToast();
  const [copied, setCopied] = useState(false);
  const [perfOpen, setPerfOpen] = useState(false);

  // Live check-in/break/check-out status — the real source of truth this
  // badge now reflects, instead of the static employmentStatus flag it
  // used to read. Reuses the exact same GET /attendance/market/today call
  // (and its server-side deriveAttendanceState helper) that Supervisor
  // Home's Team Status chart and Team Attendance screen already use —
  // not a second attendance system, just one more reader of it. Polled
  // (see ATTENDANCE_POLL_MS) so a break start/end or check-out on the
  // employee's side shows up here without the supervisor having to leave
  // and reopen the page.
  const { data: teamAttendance, reload: reloadAttendance } = useAsync(() => getMarketAttendanceToday(marketId), {
    deps: [marketId],
  });
  usePolling(() => reloadAttendance(), ATTENDANCE_POLL_MS, [marketId]);
  const liveAttendance = employee ? teamAttendance?.employees?.find((e) => e.id === employee.id) ?? null : null;
  const liveStatusMeta = liveAttendance ? (LIVE_STATUS_META[liveAttendance.state] ?? NOT_ACTIVE_META) : null;

  function copyCode() {
    if (!employee?.employeeCode) return;
    navigator.clipboard?.writeText(employee.employeeCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-1 -ms-1 py-1.5 px-1">
        <ArrowLeft size={16} className="rtl-flip" /> {t("sup.backToEmployees")}
      </button>
      <h1 className="mb-4 font-display text-[20px] font-bold text-white">{t("sup.employeeProfile")}</h1>

      {loading ? (
        <SkeletonCard className="h-[190px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          {/* Hero — real identity + status only. */}
          <section className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[#241708]/85 to-[#0D1223]/95 border border-[#F47A20]/25 backdrop-blur-xl shadow-[0_10px_36px_-16px_rgba(0,0,0,0.9),0_0_40px_-18px_rgba(244,122,32,0.5)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="relative h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-[#F47A20]/25 shadow-[0_0_22px_-4px_rgba(244,122,32,0.7)] overflow-hidden">
                  {employee.profilePictureUrl ? (
                    <AuthenticatedImage src={employee.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base font-display font-bold text-white">{initialsOf(employee.name)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-white truncate">{employee.name}</h2>
                  <p className="text-[#F9A03C] text-sm font-semibold">{employee.position}</p>
                  {liveStatusMeta && (
                    <span className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium ${liveStatusMeta.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${liveStatusMeta.dot}`} />
                      {t(liveStatusMeta.label)}
                    </span>
                  )}
                </div>
              </div>
              {employee.employeeCode && (
                <button
                  type="button"
                  onClick={copyCode}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold tabular-nums text-white bg-white/[0.07] border border-white/[0.1] hover:bg-white/[0.12] transition-colors"
                >
                  {employee.employeeCode} {copied ? <CheckIcon size={11} className="text-emerald-400" /> : <Copy size={11} className="text-[#8B93A8]" />}
                </button>
              )}
            </div>

            <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#9AA1B4]">
              {(employee.shift || employee.cashierShift) && (
                <span className="flex items-center gap-1.5"><Clock size={13} /> {employee.shift || employee.cashierShift}</span>
              )}
              {employee.username && <span className="flex items-center gap-1.5"><BadgeCheck size={13} /> {employee.username}</span>}
              {employee.startDate && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={13} /> {t("sup.joined")} {new Date(employee.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
          </section>

          {/* Info tiles — Department (editable) + Market. Real fields
              only; see this file's header comment on why "Manager" isn't
              reproduced from the reference. */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <DepartmentField
              employeeId={employee.id}
              department={employee.department}
              onSaved={(department) => setEmployee((prev) => ({ ...prev, department }))}
            />
            <div className="rounded-2xl p-3.5 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border border-emerald-500/[0.18] backdrop-blur-xl shadow-[0_10px_24px_-16px_rgba(0,0,0,0.9),0_0_24px_-14px_rgba(52,211,153,0.4)]">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                  <Store size={14} />
                </span>
                <p className="flex-1 text-[11px] uppercase tracking-wide text-[#8B93A8]">{t("sup.market")}</p>
              </div>
              <p className="mt-2 truncate text-[14px] font-semibold text-white">{marketName || "—"}</p>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {!employee.employeeCode && !employee.username && (
              <AssignCredentialsField
                employee={employee}
                onSaved={(updated) => setEmployee((prev) => ({ ...prev, ...updated }))}
              />
            )}
            {employee.additionalDepartments?.length > 0 && (
              <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">
                  <Layers size={11} /> {t("emp.additionalResponsibilities")}
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
                    ? t("sup.countingAssignmentSavedSentToThe")
                    : t("sup.countingAssignmentSaved")
                )
              }
            />
          </div>
          <Toast message={toast} />

          {/* Quick access — 2x2, each a full color identity (icon,
              container, border, glow), matching Attendance/Tasks/
              Activity History/Performance's tones from the reference. */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QuickAccessCard icon={CalendarDays} label={t("emp.attendance")} sub={t("sup.viewAttendanceHours")} tone="sky" onClick={onOpenAttendance} />
            <QuickAccessCard icon={ClipboardList} label={t("emp.navTasks")} sub={t("sup.viewAndManageTasks")} tone="violet" onClick={onOpenTasks} />
            <QuickAccessCard icon={History} label={t("sup.activityHistory")} sub={t("sup.viewFullHistory")} tone="emerald" onClick={onOpenHistory} />
            <QuickAccessCard icon={TrendingUp} label={t("emp.performance")} sub={t("sup.statsAndProgress")} tone="amber" onClick={() => setPerfOpen(true)} />
          </div>

          <div className="mt-4">
            <EmployeeTodayActivity employeeId={employee.id} marketId={employee.marketId} />
          </div>

          {/* The real, computed score — the same five-category figure the
              employee sees, plus the management-only detail the API adds
              for a staff viewer. This used to read Employee.performanceRate,
              a column nothing ever wrote, so the tile always showed an em
              dash. */}
          <Modal open={perfOpen} onClose={() => setPerfOpen(false)} title={t("emp.performance")}>
            <PerformancePanel
              loadCurrent={(opts) => getEmployeePerformance(employee.id, opts)}
              loadHistory={(opts) => getEmployeePerformanceHistory(employee.id, opts)}
              loadAggregate={(opts) => getEmployeePerformanceAggregate(employee.id, opts)}
              deps={[employee.id]}
            />
          </Modal>
        </>
      )}
    </div>
  );
}

const QUICK_TONE = {
  sky: {
    icon: "text-sky-400 bg-sky-500/15 ring-sky-500/30",
    card: "border-sky-500/[0.18] hover:border-sky-500/40 shadow-[0_0_24px_-14px_rgba(56,189,248,0.5)]",
  },
  violet: {
    icon: "text-violet-400 bg-violet-500/15 ring-violet-500/30",
    card: "border-violet-500/[0.18] hover:border-violet-500/40 shadow-[0_0_24px_-14px_rgba(167,139,250,0.5)]",
  },
  emerald: {
    icon: "text-emerald-400 bg-emerald-500/15 ring-emerald-500/30",
    card: "border-emerald-500/[0.18] hover:border-emerald-500/40 shadow-[0_0_24px_-14px_rgba(52,211,153,0.5)]",
  },
  amber: {
    icon: "text-amber-400 bg-amber-500/15 ring-amber-500/30",
    card: "border-amber-500/[0.18] hover:border-amber-500/40 shadow-[0_0_24px_-14px_rgba(251,191,36,0.5)]",
  },
};

function QuickAccessCard({ icon: Icon, label, sub, tone, onClick }) {
  const t = QUICK_TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-start rounded-2xl p-3.5 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border backdrop-blur-xl transition-all duration-200 active:scale-[0.98] ${t.card}`}
    >
      <div className="flex items-start justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ring-inset ${t.icon}`}>
          <Icon size={16} />
        </span>
        <ChevronRight size={14} className="mt-2 text-[#4C5266] rtl-flip" />
      </div>
      <p className="mt-2.5 text-[13.5px] font-semibold text-white">{label}</p>
      <p className="text-[11px] text-[#8B93A8]">{sub}</p>
    </button>
  );
}
