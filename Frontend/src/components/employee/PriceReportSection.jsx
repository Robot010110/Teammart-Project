import { useState } from "react";
import { Tag, DollarSign, TrendingUp, FileText } from "lucide-react";
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

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// PriceReportSection.jsx — header restyled to match the approved Cashier
// Daily Activity reference (icon + title/subtitle on the left, the
// action button on the right, same row) — the underlying data/flow is
// unchanged: still listPriceReports() (this cashier's own real reports,
// no mock data) and the same PriceReportFlow submission modal. The list
// below is scoped to TODAY here (matching the reference's "No price
// reports yet today" wording) since this section lives on a page that's
// entirely about today's work — full history isn't hidden anywhere else,
// there was simply no other place showing it.
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

  const todayReports = (reports ?? []).filter((r) => isToday(r.reportedAt));

  return (
    <section className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center flex-wrap justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-[#F47A20]/10 text-[#F47A20] shrink-0">
            <TrendingUp size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Price Report</p>
            <p className="text-xs text-[#8B93A8]">Report price difference</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFlowOpen(true)}
          aria-label="Report Price Difference"
          className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 sm:px-3.5 py-2.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-150"
        >
          <DollarSign size={14} /> Report Price Difference
        </button>
      </div>

      {loading && <div className="mt-4"><SkeletonCard className="h-[60px]" /></div>}
      {!loading && error && <div className="mt-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {!loading && !error && reports && (
        <div className="mt-4 space-y-2.5">
          {todayReports.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 bg-white/[0.03] border border-white/[0.05]">
              <FileText size={15} className="text-[#4C5266] shrink-0" />
              <p className="text-sm text-[#8B93A8]">No price reports yet today.</p>
            </div>
          ) : (
            todayReports.map((report) => (
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
            ))
          )}
        </div>
      )}

      <PriceReportFlow open={flowOpen} onClose={() => setFlowOpen(false)} onSaved={handleSaved} />

      <Toast message={toast} />
    </section>
  );
}
