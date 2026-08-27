import { useState } from "react";
import { DollarSign, Clock, Loader2, CheckCircle2, XCircle, HourglassIcon, Trash2 } from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import ErrorBanner from "../components/common/ErrorBanner";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { listTotalSalesReports, reviewTotalSalesReport, deleteTotalSalesReport } from "../services/totalSalesService";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/apiClient";
import { formatMoney } from "../utils/money";

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const STATUS_STYLE = {
  PENDING: { icon: HourglassIcon, tone: "bg-amber-500/10 text-amber-400 ring-amber-500/20" },
  APPROVED: { icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" },
  REJECTED: { icon: XCircle, tone: "bg-red-500/10 text-red-400 ring-red-500/20" },
};

function StatusPill({ status }) {
  const { icon: Icon, tone } = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}>
      <Icon size={12} /> {status}
    </span>
  );
}

// ReportCard — Cleanup Phase §11: amount always shown comma-formatted
// (formatMoney), never a raw/decimal-only number.
function ReportCard({ report, onReview, reviewing, onDelete, deleting }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);

  async function handleReject() {
    if (!reason.trim()) {
      setError("A reason is required to reject.");
      return;
    }
    setError(null);
    await onReview(report.id, "REJECTED", reason.trim());
  }

  return (
    <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
      <div className="flex items-center gap-4">
        {report.photoUrl && (
          <a href={report.photoUrl} target="_blank" rel="noreferrer" className="shrink-0">
            <AuthenticatedImage src={report.photoUrl} alt="Evidence" className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/10" />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xl font-display font-bold text-white">
              <DollarSign size={18} className="text-[#F47A20]" /> {formatMoney(report.amount)}
            </p>
            <div className="flex items-center gap-2">
              <StatusPill status={report.status} />
              <button
                type="button"
                onClick={() => onDelete(report.id)}
                disabled={deleting}
                aria-label="Delete report"
                className="p-1.5 rounded-lg text-[#4C5266] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-[#8B93A8]">{dateLabel(report.date)}</p>
          <p className="mt-0.5 flex items-center gap-3 text-xs text-[#4C5266]">
            <span>{report.submittedBy?.name}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {timeLabel(report.submittedAt)}</span>
          </p>
          {report.status === "REJECTED" && report.rejectionReason && (
            <p className="mt-1.5 text-xs text-red-400">Rejected: {report.rejectionReason}</p>
          )}
          {report.status !== "PENDING" && report.reviewedBy && (
            <p className="mt-1 text-[11px] text-[#4C5266]">Reviewed by {report.reviewedBy.name}</p>
          )}
        </div>
      </div>

      {report.status === "PENDING" && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          {rejecting ? (
            <div className="space-y-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for rejecting"
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setRejecting(false); setError(null); }} disabled={reviewing} className="flex-1 rounded-lg py-2 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1]">
                  Cancel
                </button>
                <button type="button" onClick={handleReject} disabled={reviewing} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50">
                  {reviewing ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setRejecting(true)} disabled={reviewing} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50">
                <XCircle size={12} /> Reject
              </button>
              <button type="button" onClick={() => onReview(report.id, "APPROVED")} disabled={reviewing} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                {reviewing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Approve
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// RmTotalSalesPage.jsx — spec §4/§10: Markets -> Select Market -> Total
// Sales. Pending reports are the active queue (Approve/Reject, real
// backend calls — see totalSalesController.reviewTotalSalesReport);
// everything already decided moves to History below, exactly the
// "Pending = active, Approved/Rejected = finished" rule (Cleanup Phase
// §2) — the historical rows are never deleted, only no longer shown as
// something requiring action.
export default function RmTotalSalesPage({ marketId, marketName, onBack }) {
  const [dateFilter, setDateFilter] = useState("");
  const { data: reports, error, loading, reload, setData } = useAsync(
    () => listTotalSalesReports({ marketId, date: dateFilter || undefined }),
    { deps: [marketId, dateFilter] }
  );
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewError, setReviewError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function handleReview(id, status, rejectionReason) {
    setReviewingId(id);
    setReviewError(null);
    try {
      const updated = await reviewTotalSalesReport(id, { status, rejectionReason });
      setData((prev) => (prev ? prev.map((r) => (r.id === id ? updated : r)) : prev));
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Could not submit this review. Please try again.");
    } finally {
      setReviewingId(null);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    setReviewError(null);
    try {
      await deleteTotalSalesReport(id);
      setData((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Could not delete this report. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const pending = (reports ?? []).filter((r) => r.status === "PENDING");
  const history = (reports ?? []).filter((r) => r.status !== "PENDING");

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto animate-fade-up">
      <Breadcrumb items={[{ label: "Markets", onClick: onBack }, { label: marketName ?? "Market", onClick: onBack }, { label: "Total Sales" }]} />

      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-white">Total Sales</h1>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50"
        />
      </div>

      {reviewError && <p className="mt-4 text-xs text-red-400">{reviewError}</p>}

      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[90px]" />)}
          </div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : (reports ?? []).length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
            {dateFilter ? "No Total Sales report for this date." : "No Total Sales reports submitted yet."}
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Pending Review</h2>
                <div className="space-y-3">
                  {pending.map((r) => (
                    <ReportCard key={r.id} report={r} onReview={handleReview} reviewing={reviewingId === r.id} onDelete={handleDelete} deleting={deletingId === r.id} />
                  ))}
                </div>
              </section>
            )}
            {history.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">History</h2>
                <div className="space-y-3">
                  {history.map((r) => (
                    <ReportCard key={r.id} report={r} onReview={handleReview} reviewing={false} onDelete={handleDelete} deleting={deletingId === r.id} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
