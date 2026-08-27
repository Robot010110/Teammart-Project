import { useState } from "react";
import { Tag, FileWarning, Trash2, Loader2 } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import AuthenticatedImage from "../common/AuthenticatedImage";
import ActivityStatusPill from "../common/ActivityStatusPill";
import { listPriceReportsForMarket, deletePriceReport } from "../../services/priceReportService";

function timeLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ReportsSection.jsx — real, market-scoped PriceReport data (a Cashier
// flagging a shelf-vs-system label/price mismatch — the exact
// "incorrect label/price/mismatch" report the spec describes). Not a
// new reporting architecture — this is TeamMart's existing PriceReport
// model, just given its first Supervisor-side view.
export default function ReportsSection({ marketId }) {
  const { data: reports, error, loading, reload } = useAsync(
    () => listPriceReportsForMarket({ marketId }),
    { deps: [marketId], fallbackError: "Could not load reports." }
  );
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deletePriceReport(selected.id);
      setSelected(null);
      reload();
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <SkeletonCard className="h-32" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  if (reports.length === 0) {
    return (
      <div className="rounded-md p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
        <FileWarning size={22} className="mx-auto text-[#4C5266] mb-2" />
        <p className="text-sm text-[#8B93A8]">No reports yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {reports.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelected(r)}
            className="w-full text-left flex items-start gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
          >
            <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
              <Tag size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white truncate">{r.productName}</p>
                <ActivityStatusPill status={r.status} />
              </div>
              <p className="text-xs text-[#8B93A8] mt-0.5">
                Shelf ${r.shelfPrice.toFixed(2)} vs System ${r.systemPrice.toFixed(2)} — {r.employee?.name}
              </p>
              <p className="text-[11px] text-[#4C5266] mt-1">{timeLabel(r.reportedAt)}</p>
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.productName}>
        {selected && (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Employee</span><span className="text-white">{selected.employee?.name}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Barcode</span><span className="text-white">{selected.barcode || "—"}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Shelf Price</span><span className="text-white">${selected.shelfPrice.toFixed(2)}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">System Price</span><span className="text-white">${selected.systemPrice.toFixed(2)}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Reported</span><span className="text-white">{timeLabel(selected.reportedAt)}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Status</span><ActivityStatusPill status={selected.status} /></div>
            {selected.notes && <p className="pt-2 text-[#9AA1B4]">{selected.notes}</p>}
            {selected.photoUrl && <AuthenticatedImage src={selected.photoUrl} alt="" className="mt-3 rounded-lg w-full max-h-64 object-cover" />}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-red-400 bg-red-500/[0.06] border border-red-500/20 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete Report
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
