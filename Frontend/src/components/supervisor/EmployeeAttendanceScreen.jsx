import { useState } from "react";
import { ArrowLeft, Zap, Loader2, Check, SlidersHorizontal, AlertTriangle } from "lucide-react";
import AttendanceSummaryCards from "../employee/AttendanceSummaryCards";
import AttendanceCalendar from "../employee/AttendanceCalendar";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import MonthPager from "../common/MonthPager";
import {
  getEmployeeAttendanceMonth,
  getEmployeeExtraHoursBalance,
  createRequiredHoursAdjustment,
  setPunishmentHours,
} from "../../services/attendanceService";
import { ApiError } from "../../services/apiClient";
import { useAsync } from "../../hooks/useAsync";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// EmployeeAttendanceScreen.jsx — Supervisor's attendance administration
// for one employee. Reuses the exact same AttendanceSummaryCards/
// AttendanceCalendar components the employee's own Attendance screen
// uses (both are pure presentational, no fetching inside — see their own
// files) — no second attendance UI invented, just fed a different
// employeeId's data via the new staff-only endpoints
// (getEmployeeAttendanceMonth/getEmployeeExtraHoursBalance). The two
// admin forms below call the same required-hours-adjustment/punishment-
// hours endpoints that already existed — this screen is their first
// frontend caller.
export default function EmployeeAttendanceScreen({ employeeId, onBack }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showRequiredHoursForm, setShowRequiredHoursForm] = useState(false);
  const [showPunishmentForm, setShowPunishmentForm] = useState(false);

  const { data, error, loading, reload } = useAsync(
    () => getEmployeeAttendanceMonth(employeeId, { year, month }),
    { deps: [employeeId, year, month], fallbackError: "Could not load attendance." }
  );
  const { data: balance, reload: reloadBalance } = useAsync(
    () => getEmployeeExtraHoursBalance(employeeId),
    { deps: [employeeId] }
  );

  function handleAdjusted() {
    reload();
    reloadBalance();
    setShowRequiredHoursForm(false);
    setShowPunishmentForm(false);
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-white">Attendance</h1>
        <MonthPager year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {balance && (
        <div className="rounded-xl p-3.5 mb-4 bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm text-[#9AA1B4]"><Zap size={14} /> Extra-hours balance</span>
          <span className="text-sm font-semibold text-white">{balance.balanceHours}h</span>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => setShowRequiredHoursForm((v) => !v)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/[0.1]"
        >
          <SlidersHorizontal size={13} /> Adjust Required Hours
        </button>
        <button
          type="button"
          onClick={() => setShowPunishmentForm((v) => !v)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/[0.1]"
        >
          <AlertTriangle size={13} /> Set Punishment Hours
        </button>
      </div>

      {showRequiredHoursForm && (
        <RequiredHoursForm employeeId={employeeId} onDone={handleAdjusted} onCancel={() => setShowRequiredHoursForm(false)} />
      )}
      {showPunishmentForm && (
        <PunishmentHoursForm employeeId={employeeId} onDone={handleAdjusted} onCancel={() => setShowPunishmentForm(false)} />
      )}

      {loading ? (
        <SkeletonCard className="h-[280px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <div className="space-y-3">
          <AttendanceSummaryCards summary={data.summary} />
          <AttendanceCalendar days={data.days} />
        </div>
      )}
    </div>
  );
}

function RequiredHoursForm({ employeeId, onDone, onCancel }) {
  const [date, setDate] = useState(todayIso());
  const [hours, setHours] = useState(8);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createRequiredHoursAdjustment({ employeeId, date, newRequiredHours: Number(hours), reason: reason.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this adjustment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl p-4 mb-4 bg-[#1A1F33]/70 border border-white/[0.06] space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white outline-none focus:border-[#F47A20]/50" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Hours (4-16)</label>
          <input
            type="number" min={4} max={16} value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white outline-none focus:border-[#F47A20]/50"
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Reason</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Covering an extra shift" className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50">
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className="flex-1 rounded-lg py-2 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function PunishmentHoursForm({ employeeId, onDone, onCancel }) {
  const [date, setDate] = useState(todayIso());
  const [hours, setHours] = useState(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await setPunishmentHours({ employeeId, date, hours: Number(hours), reason: reason.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this adjustment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl p-4 mb-4 bg-[#1A1F33]/70 border border-white/[0.06] space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white outline-none focus:border-[#F47A20]/50" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Penalty Hours</label>
          <input
            type="number" min={0} max={24} step="0.5" value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white outline-none focus:border-[#F47A20]/50"
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">Reason</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Late arrival without notice" className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50">
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className="flex-1 rounded-lg py-2 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1]">
          Cancel
        </button>
      </div>
    </div>
  );
}
