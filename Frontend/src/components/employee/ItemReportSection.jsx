import { useState } from "react";
import { PackageX } from "lucide-react";
import ItemReportFlow from "./ItemReportFlow";
import ItemReportHistory from "./ItemReportHistory";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import MonthPager from "../common/MonthPager";
import Toast from "../common/Toast";
import { listItemReports } from "../../services/itemReportService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

// ItemReportSection.jsx — the Expired/Wasted Items module: a "Report"
// entry point (opens ItemReportFlow) plus a month-scoped history list.
// Its own section rather than a TaskSubmissionGrid tile because the
// submission flow is a multi-step barcode/photo -> product-search ->
// quantity flow, materially different from the other Daily Activities'
// single-form modal.

export default function ItemReportSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [flowOpen, setFlowOpen] = useState(false);
  const [toast, setToast] = useToast();

  const { data: reports, setData: setReports, error, loading, reload: load } = useAsync(
    () => listItemReports({ year, month }),
    { deps: [year, month], fallbackError: "Could not load your reports." }
  );

  const handleSaved = (report, message) => {
    if (year === now.getFullYear() && month === now.getMonth() + 1) {
      setReports((prev) => [report, ...prev]);
    }
    setToast(message);
  };

  return (
    <section className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          onClick={() => setFlowOpen(true)}
          className="flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-150"
        >
          <PackageX size={14} /> Report Expired / Wasted Item
        </button>
        <MonthPager year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {loading && <SkeletonCard className="h-[140px]" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && reports && <ItemReportHistory reports={reports} />}

      <ItemReportFlow open={flowOpen} onClose={() => setFlowOpen(false)} onSaved={handleSaved} />

      <Toast message={toast} />
    </section>
  );
}
