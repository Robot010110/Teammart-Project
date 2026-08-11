import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import LeaveRequestFlow from "./LeaveRequestFlow";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import LeaveStatusPill from "../common/LeaveStatusPill";
import { listMyLeaveRequests } from "../../services/leaveRequestService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

// LeaveRequestSection.jsx — Off Day / Leave requests (spec §10/§11):
// "Request Off Day / Leave" entry point + a status list of this
// employee's own requests. Shared verbatim by EmployeeWorkspace.jsx
// (Worker) and CashierWorkspace.jsx (Cashier) — same component, no
// duplication, since the feature is identical for both roles.

const TYPE_LABEL = { MONTHLY_OFF: "Monthly Off Day", PERSONAL_LEAVE: "Personal Leave", EARNED_DAY_OFF: "Earned Day Off" };

const dateLabel = (isoString) =>
  new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function LeaveRequestSection() {
  const [flowOpen, setFlowOpen] = useState(false);
  const [toast, setToast] = useToast();

  const { data: requests, setData: setRequests, error, loading, reload } = useAsync(listMyLeaveRequests, {
    fallbackError: "Could not load your leave requests.",
  });

  const handleSaved = (request, message) => {
    setRequests((prev) => [request, ...prev]);
    setToast(message);
  };

  return (
    <section className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <button
        onClick={() => setFlowOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-150 mb-4"
      >
        <CalendarPlus size={14} /> Request Off Day / Leave
      </button>

      {loading && <SkeletonCard className="h-[140px]" />}
      {!loading && error && <ErrorBanner message={error} onRetry={reload} />}
      {!loading && !error && requests && (
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {requests.length === 0 && (
            <p className="text-sm text-[#4C5266] text-center py-8">No leave requests yet.</p>
          )}
          {requests.map((request) => (
            <div key={request.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-white">{dateLabel(request.date)}</span>
                <LeaveStatusPill status={request.status} />
              </div>
              <p className="mt-1.5 text-xs text-[#9AA1B4]">{TYPE_LABEL[request.type]}</p>
              {request.reason && <p className="mt-1 text-xs text-[#8B93A8]">{request.reason}</p>}
              {request.reviewNote && (
                <p className="mt-1.5 text-xs text-[#8B93A8]">Supervisor note: {request.reviewNote}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <LeaveRequestFlow open={flowOpen} onClose={() => setFlowOpen(false)} onSaved={handleSaved} />

      <Toast message={toast} />
    </section>
  );
}
