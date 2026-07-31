import { useState } from "react";
import { Tag, DollarSign } from "lucide-react";
import PriceReportFlow from "./PriceReportFlow";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import ActivityStatusPill from "../common/ActivityStatusPill";
import { listPriceReports } from "../../services/priceReportService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

// PriceReportSection.jsx — a Cashier flagging a shelf-vs-POS price
// mismatch. "Report Price Difference" entry point + a history list of
// this cashier's own reports, same shell shape as ItemReportSection.jsx.

const dateTimeLabel = (isoString) =>
  new Date(isoString).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function PriceReportSection() {
  const [flowOpen, setFlowOpen] = useState(false);
  const [toast, setToast] = useToast();

  const { data: reports, setData: setReports, error, loading, reload } = useAsync(listPriceReports, {
    fallbackError: "Could not load your price reports.",
  });

  const handleSaved = (report, message) => {
    setReports((prev) => [report, ...prev]);
    setToast(message);
  };

  return (
    <section className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <button
        onClick={() => setFlowOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-150 mb-4"
      >
        <DollarSign size={14} /> Report Price Difference
      </button>

      {loading && <SkeletonCard className="h-[140px]" />}
      {!loading && error && <ErrorBanner message={error} onRetry={reload} />}
      {!loading && !error && reports && (
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {reports.length === 0 && (
            <p className="text-sm text-[#4C5266] text-center py-8">No price reports yet.</p>
          )}
          {reports.map((report) => (
            <div key={report.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                  <Tag size={13} className="text-[#F47A20]" /> {report.productName}
                </span>
                <ActivityStatusPill status={report.status} />
              </div>
              <div className="mt-1.5 flex items-center gap-4 text-xs text-[#9AA1B4]">
                <span>Shelf ${report.shelfPrice.toFixed(2)}</span>
                <span>System ${report.systemPrice.toFixed(2)}</span>
                <span>{dateTimeLabel(report.reportedAt)}</span>
              </div>
              {report.notes && <p className="mt-1.5 text-xs text-[#8B93A8]">{report.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <PriceReportFlow open={flowOpen} onClose={() => setFlowOpen(false)} onSaved={handleSaved} />

      <Toast message={toast} />
    </section>
  );
}
