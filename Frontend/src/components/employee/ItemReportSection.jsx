import { useEffect, useState } from "react";
import { PackageX, ChevronLeft, ChevronRight } from "lucide-react";
import ItemReportFlow from "./ItemReportFlow";
import ItemReportHistory from "./ItemReportHistory";
import ErrorBanner from "../common/ErrorBanner";
import { listItemReports } from "../../services/itemReportService";
import { ApiError } from "../../services/apiClient";

// ItemReportSection.jsx — the Expired/Wasted Items module: a "Report"
// entry point (opens ItemReportFlow) plus a month-scoped history list.
// Its own section rather than a TaskSubmissionGrid tile because the
// submission flow is a multi-step barcode/photo -> product-search ->
// quantity flow, materially different from the other Daily Activities'
// single-form modal.

const MONTH_LABEL = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function ItemReportSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flowOpen, setFlowOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    return listItemReports({ year, month })
      .then(setReports)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your reports."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const changeMonth = (delta) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const handleSaved = (report, message) => {
    if (year === now.getFullYear() && month === now.getMonth() + 1) {
      setReports((prev) => [report, ...prev]);
    }
    setToast(message);
  };

  return (
    <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setFlowOpen(true)}
          className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
        >
          <PackageX size={14} /> Report Expired / Wasted Item
        </button>
        <div className="flex items-center gap-1.5 text-xs text-[#9AA1B4]">
          <button onClick={() => changeMonth(-1)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-white/[0.06]">
            <ChevronLeft size={13} />
          </button>
          <span className="min-w-[110px] text-center">{MONTH_LABEL(year, month)}</span>
          <button onClick={() => changeMonth(1)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-white/[0.06]">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {loading && <div className="h-[140px] rounded-xl bg-white/[0.03] animate-pulse" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && <ItemReportHistory reports={reports} />}

      <ItemReportFlow open={flowOpen} onClose={() => setFlowOpen(false)} onSaved={handleSaved} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-xl px-4 py-2.5 bg-[#1F2436] border border-white/10 shadow-2xl text-sm text-white animate-fade-up">
          {toast}
        </div>
      )}
    </section>
  );
}
