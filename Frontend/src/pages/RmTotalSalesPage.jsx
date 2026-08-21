import { useState } from "react";
import { DollarSign, Clock } from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { listTotalSalesReports } from "../services/totalSalesService";
import { useAsync } from "../hooks/useAsync";

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// RmTotalSalesPage.jsx — spec §4: Markets -> Select Market -> Total
// Sales. Every historical report for this market, most recent first —
// never just the latest (spec: "preserve historical records rather than
// simply replacing previous reports"). Regional-Manager/Admin-only,
// enforced server-side (totalSalesController.listTotalSalesReports).
export default function RmTotalSalesPage({ marketId, marketName, onBack }) {
  const [dateFilter, setDateFilter] = useState("");
  const { data: reports, error, loading, reload } = useAsync(
    () => listTotalSalesReports({ marketId, date: dateFilter || undefined }),
    { deps: [marketId, dateFilter] }
  );

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

      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[90px]" />)}
          </div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : reports.length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
            {dateFilter ? "No Total Sales report for this date." : "No Total Sales reports submitted yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] flex items-center gap-4">
                {r.photoUrl && (
                  <a href={r.photoUrl} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={r.photoUrl} alt="Evidence" className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/10" />
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xl font-display font-bold text-white">
                    <DollarSign size={18} className="text-[#F47A20]" /> {r.amount.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-[#8B93A8]">{dateLabel(r.date)}</p>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-[#4C5266]">
                    <span>{r.submittedBy?.name}</span>
                    <span className="flex items-center gap-1"><Clock size={11} /> {timeLabel(r.submittedAt)}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
