import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock, ImageOff, User } from "lucide-react";
import Modal from "../common/Modal";
import AuthenticatedImage from "../common/AuthenticatedImage";
import ActivityStatusPill from "../common/ActivityStatusPill";
import { reviewActivity } from "../../services/activityService";
import { ApiError } from "../../services/apiClient";

function dateTimeLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// DepartmentReportReviewModal.jsx — Department Reporting §6/§12: what
// opens when the supervisor taps a department tile. One component, three
// read states depending on the department's real submission (from
// DepartmentReportBoard's listMarketDepartments call — never a second
// fetch, every photo/note this needs already comes back on that same
// call, see departmentMonitoringService.getMarketDepartmentStatus's own
// comment):
//   no submission / declined -> "not reported yet" (+ the decline reason,
//     if the last attempt was declined — informational only, nothing to
//     act on, matches spec §12's "allow the supervisor to see it was
//     declined")
//   PENDING -> the real review screen: photos, notes, employee, time,
//     and the only two actions that exist here — Approve / Decline
//     (never Reject/Delete/Complete/Take Photo/Submit — spec §6 is
//     explicit that this is review-only)
//   APPROVED -> the same detail, read-only, no action buttons
export default function DepartmentReportReviewModal({ open, section, dept, marketId, onClose, onReviewed }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submission = dept?.submission;
  const isPending = submission?.status === "PENDING";
  const isApproved = submission?.status === "APPROVED";
  const wasDeclined = submission?.status === "REJECTED";

  async function handleApprove() {
    setSubmitting(true);
    setError(null);
    try {
      await reviewActivity(submission.activityId, { status: "APPROVED" });
      onReviewed("approved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not approve this report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    if (!reason.trim()) {
      setError("A reason is required to decline.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reviewActivity(submission.activityId, { status: "REJECTED", rejectionReason: reason.trim() });
      onReviewed("declined");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not decline this report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setDeclining(false);
    setReason("");
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={section ? `${section.label} Department` : ""}>
      {!submission || wasDeclined ? (
        <div className="space-y-4">
          {wasDeclined && (
            <div className="rounded-xl p-3.5 bg-red-500/[0.06] border border-red-500/20">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                <XCircle size={13} /> Last submission was declined
              </p>
              {submission.rejectionReason && <p className="mt-1.5 text-xs text-[#9AA1B4]">{submission.rejectionReason}</p>}
              <p className="mt-1 text-[11px] text-[#4C5266]">
                {submission.submittedBy?.name} &middot; {dateTimeLabel(submission.submittedAt)}
              </p>
            </div>
          )}
          <div className="rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06] text-center">
            <p className="text-sm text-white font-medium">No report submitted yet today</p>
            <p className="mt-1 text-xs text-[#8B93A8]">
              {dept?.assignedEmployees?.length > 0
                ? `Waiting on ${dept.assignedEmployees.map((e) => e.name).join(", ")} to submit this department's daily report.`
                : "No employee is currently assigned to this department."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm text-white">
              <User size={14} className="text-[#8B93A8]" /> {submission.submittedBy?.name}
            </p>
            <ActivityStatusPill status={submission.status} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-[#8B93A8]">
            <Clock size={12} /> {dateTimeLabel(submission.submittedAt)}
          </p>

          {submission.notes && (
            <div>
              <p className="text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Notes</p>
              <p className="text-sm text-[#D5D8E4]">{submission.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Photos</p>
            {submission.images?.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {submission.images.map((img) =>
                  img.expired || !img.url ? (
                    <div key={img.id} className="aspect-square rounded-xl bg-white/[0.04] border border-white/[0.06] grid place-items-center gap-1.5 text-[#4C5266]">
                      <ImageOff size={18} />
                      <span className="text-[10px]">Photo expired</span>
                    </div>
                  ) : (
                    <div key={img.id} className="aspect-square rounded-xl overflow-hidden border border-white/[0.06]">
                      <AuthenticatedImage src={img.url} alt="Department evidence" className="w-full h-full object-cover" />
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-xs text-[#4C5266]">No photos attached.</p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {isPending && (
            declining ? (
              <div className="space-y-2.5 pt-1">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for declining"
                  className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-red-500/50"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setDeclining(false); setError(null); }} disabled={submitting} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={handleDecline} disabled={submitting} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors">
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Confirm Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setDeclining(true)} disabled={submitting} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 transition-colors">
                  <XCircle size={14} /> Decline
                </button>
                <button type="button" onClick={handleApprove} disabled={submitting} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
                </button>
              </div>
            )
          )}

          {isApproved && (
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-400 pt-1">
              <CheckCircle2 size={15} /> Approved for today
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
