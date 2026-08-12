import { useState } from "react";
import { PackageX } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import ActivityStatusPill from "../common/ActivityStatusPill";
import { listWastedOverallReportsForMarket } from "../../services/wastedOverallService";

const ITEM_LABEL = { EGGS: "Eggs", TOMATO: "Tomato", POTATO: "Potato", CUCUMBER: "Cucumber", ONION: "Onion" };

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// WastedItemsSection.jsx — real data: employees submit Wasted Overall
// reports from their own interface (WastedOverallFlow.jsx); this is the
// Supervisor's automatic view of today's, via the market-scoped staff
// endpoint. Nothing re-entered by the Supervisor — pure review, per spec
// §21 ("do not invent unnecessary approval workflows").
export default function WastedItemsSection({ marketId }) {
  const { data: reports, error, loading, reload } = useAsync(
    () => listWastedOverallReportsForMarket({ marketId }),
    { deps: [marketId], fallbackError: "Could not load waste reports." }
  );
  const [selected, setSelected] = useState(null);

  if (loading) return <SkeletonCard className="h-32" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const today = reports.filter((r) => isToday(r.reportedAt));

  if (today.length === 0) {
    return (
      <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
        <PackageX size={22} className="mx-auto text-[#4C5266] mb-2" />
        <p className="text-sm text-[#8B93A8]">No waste reported today.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {today.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelected(r)}
            className="w-full text-left flex items-start gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
          >
            <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
              <PackageX size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{ITEM_LABEL[r.item] || r.item} — {r.quantityKg}kg</p>
                <ActivityStatusPill status={r.status} />
              </div>
              <p className="text-xs text-[#8B93A8] mt-0.5">Reported by {r.employee?.name}{r.photoUrl ? " · Photo attached" : ""}</p>
              <p className="text-[11px] text-[#4C5266] mt-1">{timeLabel(r.reportedAt)}</p>
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${ITEM_LABEL[selected.item] || selected.item}` : ""}>
        {selected && (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Employee</span><span className="text-white">{selected.employee?.name}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Amount</span><span className="text-white">{selected.quantityKg} kg</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Time</span><span className="text-white">{timeLabel(selected.reportedAt)}</span></div>
            {selected.notes && <p className="pt-2 text-[#9AA1B4]">{selected.notes}</p>}
            {selected.photoUrl && <img src={selected.photoUrl} alt="" className="mt-3 rounded-lg w-full max-h-64 object-cover" />}
          </div>
        )}
      </Modal>
    </>
  );
}
