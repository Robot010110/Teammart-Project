import { useState } from "react";
import { Building2, Camera, ImageOff, Send, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import EvidenceCapture from "../employee/EvidenceCapture";
import { ApiError } from "../../services/apiClient";
import {
  listMarketDepartments,
  getMarketDepartmentCompletion,
  submitDepartmentClosingForUnassigned,
  sendDepartmentReport,
} from "../../services/departmentClosingService";

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const STATE_STYLE = {
  COMPLETED: { label: "Completed", tone: "text-emerald-400 bg-emerald-500/10" },
  UNASSIGNED: { label: "Needs Supervisor", tone: "text-amber-400 bg-amber-500/10" },
  MISSING: { label: "Missing", tone: "text-red-400 bg-red-500/10" },
};

// DepartmentMonitoringSection.jsx — Phase 2 §12-22: the Supervisor's real
// Department Monitoring view, completion tracking, and Final Department
// Report — all reading from the exact same DEPARTMENT_CLOSING Activity
// records employees/staff already submit (spec §13: "one source of
// truth"), never a duplicated display table.
export default function DepartmentMonitoringSection({ marketId }) {
  const { data: departments, error, loading, reload } = useAsync(
    () => listMarketDepartments(marketId),
    { deps: [marketId], fallbackError: "Could not load department monitoring." }
  );
  const { data: completion, reload: reloadCompletion } = useAsync(
    () => getMarketDepartmentCompletion(marketId),
    { deps: [marketId], fallbackError: "Could not load completion status." }
  );
  const [submittingFor, setSubmittingFor] = useState(null); // department name
  const [reportOpen, setReportOpen] = useState(false);

  function reloadAll() {
    reload();
    reloadCompletion();
  }

  if (loading) return <SkeletonCard className="h-48" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  return (
    <>
      <div className="space-y-2">
        {departments.map((d) => {
          const style = STATE_STYLE[d.state];
          return (
            <div key={d.marketDepartmentId} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{d.department}</p>
                  <p className="text-xs text-[#8B93A8] mt-0.5">
                    {d.assignedEmployees.length > 0 ? d.assignedEmployees.map((e) => e.name).join(", ") : "Unassigned"}
                  </p>
                </div>
                <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-1 ${style.tone}`}>{style.label}</span>
              </div>
              {d.submission && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#6B7284]">
                  {d.submission.photoAvailable ? <Camera size={11} /> : d.submission.photoExpired ? <ImageOff size={11} /> : null}
                  {d.submission.submittedBy.kind === "staff" ? "Supervisor" : d.submission.submittedBy.name} — {timeLabel(d.submission.submittedAt)}
                  {d.submission.photoExpired && " — Photo expired"}
                </p>
              )}
              {d.state === "UNASSIGNED" && (
                <button
                  type="button"
                  onClick={() => setSubmittingFor(d.department)}
                  className="mt-2.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
                >
                  <Camera size={12} /> Complete This Department
                </button>
              )}
            </div>
          );
        })}
      </div>

      {completion && (
        <div className="mt-4 rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white">
              <span className="font-semibold">{completion.completedCount}/{completion.requiredCount}</span> departments completed
            </p>
            {completion.isComplete ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : (
              <AlertTriangle size={16} className="text-amber-400" />
            )}
          </div>
          {!completion.isComplete && completion.missing.length > 0 && (
            <p className="mt-1.5 text-xs text-[#8B93A8]">Missing: {completion.missing.map((m) => m.department).join(", ")}</p>
          )}
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-200"
          >
            <Send size={14} /> Send Department Report
          </button>
        </div>
      )}

      {submittingFor && (
        <UnassignedDepartmentModal
          marketId={marketId}
          department={submittingFor}
          onClose={() => setSubmittingFor(null)}
          onSaved={() => { setSubmittingFor(null); reloadAll(); }}
        />
      )}

      {reportOpen && (
        <SendReportModal
          marketId={marketId}
          completion={completion}
          onClose={() => setReportOpen(false)}
          onSent={() => { setReportOpen(false); reloadAll(); }}
        />
      )}
    </>
  );
}

function UnassignedDepartmentModal({ marketId, department, onClose, onSaved }) {
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      await submitDepartmentClosingForUnassigned(marketId, {
        date: now.toISOString().slice(0, 10),
        time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        department,
        status: "PENDING",
        imageUrls: photo ? [photo] : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={department}>
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 text-xs text-[#8B93A8]">
          <Building2 size={13} /> Completed by Supervisor — this department has no assigned employee.
        </p>
        <EvidenceCapture photo={photo} onPhotoChange={setPhoto} />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </Modal>
  );
}

const SHIFTS = [
  { value: "MORNING", label: "Morning" },
  { value: "EVENING", label: "Evening" },
  { value: "NIGHT", label: "Night" },
];

function SendReportModal({ marketId, completion, onClose, onSent }) {
  const [shift, setShift] = useState("EVENING");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    setConflict(null);
    try {
      await sendDepartmentReport(marketId, {
        date: new Date().toISOString().slice(0, 10),
        shift,
        override: !completion?.isComplete ? override : undefined,
        overrideReason: !completion?.isComplete && override ? overrideReason : undefined,
      });
      onSent();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict("A report for this market/date/shift has already been sent.");
      } else {
        setError(err instanceof ApiError ? err.message : "Could not send the report.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Send Department Report">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-2">Shift</label>
          <div className="grid grid-cols-3 gap-2">
            {SHIFTS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setShift(s.value)}
                className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                  shift === s.value ? "text-white bg-[#F47A20]" : "text-[#9AA1B4] bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {completion && !completion.isComplete && (
          <div className="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/25">
            <p className="text-xs text-amber-300">
              {completion.completedCount}/{completion.requiredCount} complete. Missing: {completion.missing.map((m) => m.department).join(", ")}
            </p>
            <label className="mt-2.5 flex items-center gap-2 text-xs text-white">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              Send anyway (override)
            </label>
            {override && (
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for sending an incomplete report"
                className="mt-2 w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
              />
            )}
          </div>
        )}

        {conflict && <p className="text-xs text-amber-400">{conflict}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || (completion && !completion.isComplete && !override)}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? "Sending..." : "Send Report"}
        </button>
      </div>
    </Modal>
  );
}
