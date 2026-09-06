import { useState } from "react";
import { ArrowLeft, PackageX, RotateCw, ChevronRight } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ItemReportRow from "../components/regionalManager/expired/ItemReportRow";
import ItemReportDetailModal from "../components/regionalManager/expired/ItemReportDetailModal";
import { listZoneItemReports } from "../services/itemReportService";

const PERIODS = [
  { key: "today", label: "Today", empty: "No expired items reported today" },
  { key: "week", label: "This Week", empty: "No expired items reported this week" },
  { key: "month", label: "This Month", empty: "No expired items reported this month" },
  { key: "all", label: "All Time", empty: "No expired item reports yet" },
];

const PAGE_SIZE = 25;

// RmExpiredItemsPage.jsx — the Regional Manager's zone-wide Expired /
// Wasted Items view.
//
// These are the SAME ItemReport rows the employee filed and their
// Supervisor reviews — one record, three scopes. Nothing is duplicated
// into a manager-specific table.
//
// Filtering is done on the SERVER (period + pagination), not by slicing
// an already-downloaded list: a zone can accumulate thousands of reports
// and the default Today view must stay cheap. Changing the period
// refetches rather than re-filtering in the browser.
// `onBack` and `scopeLabel` make this page serve both scopes without a
// second copy: the Regional Manager opens it from Home (needs a back
// button, sees their own markets), while Admin mounts it as a sidebar
// destination (no back button, sees the whole organization). The data
// scope itself is decided server-side by the caller's role, never here.
export default function RmExpiredItemsPage({ onBack, scopeLabel = "across your markets" }) {
  const [period, setPeriod] = useState("today");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const { data, error, loading, reload } = useAsync(
    () => listZoneItemReports({ period, page, pageSize: PAGE_SIZE }),
    { deps: [period, page], fallbackError: "Could not load expired item reports." }
  );

  const reports = data?.reports ?? [];
  const total = data?.total ?? 0;
  const active = PERIODS.find((p) => p.key === period) ?? PERIODS[0];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function choosePeriod(key) {
    setPeriod(key);
    setPage(1); // a new period always starts at its own first page
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-4 pt-4 sm:max-w-3xl sm:px-6">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to home"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/10 active:scale-95"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-[22px] font-bold leading-tight text-white">Expired Items</h1>
          <p className="text-[12px] text-[#8B93A8]">
            {loading ? "Loading reports…" : `${total} report${total === 1 ? "" : "s"} · ${active.label.toLowerCase()}`}
          </p>
        </div>
      </div>

      {/* Period filter — horizontally scrollable so four chips never
          wrap or shrink on a 360px screen. */}
      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          {PERIODS.map((p) => {
            const isActive = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => choosePeriod(p.key)}
                aria-pressed={isActive}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-200 ${
                  isActive
                    ? "border-[#F47A20]/50 bg-[#F47A20]/[0.14] text-white shadow-[0_0_16px_-5px_rgba(244,122,32,0.8)]"
                    : "border-white/[0.07] bg-[#111A2D]/70 text-[#8B93A8] hover:border-white/[0.16] hover:text-white"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3.5 space-y-2.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-[18px] border border-white/[0.06] bg-[#111A2D]/60" />
          ))
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6 text-center">
            <p className="text-[13.5px] font-semibold text-white">Couldn't load expired items</p>
            <p className="mt-1 text-[12px] text-[#9AA1B4]">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/[0.1]"
            >
              <RotateCw size={13} /> Try again
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/70 px-6 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F47A20]/10 text-[#F47A20]">
              <PackageX size={20} />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-white">{active.empty}</p>
            <p className="mt-1 text-[12.5px] text-[#8B93A8]">
              Reports filed by employees {scopeLabel} appear here.
            </p>
          </div>
        ) : (
          reports.map((r, i) => (
            <ItemReportRow key={r.id} report={r} index={i} onOpen={() => setSelected(r)} />
          ))
        )}
      </div>

      {!loading && !error && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-[#111A2D]/80 px-3 py-2 text-[12.5px] font-medium text-white transition-colors hover:border-white/[0.16] disabled:opacity-40"
          >
            <ChevronRight size={14} className="rotate-180" /> Previous
          </button>
          <span className="text-[12px] text-[#8B93A8]">Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-[#111A2D]/80 px-3 py-2 text-[12.5px] font-medium text-white transition-colors hover:border-white/[0.16] disabled:opacity-40"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      <ItemReportDetailModal report={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
