import { useState } from "react";
import { Tag, ChevronRight, PackageX } from "lucide-react";
import SubmitTaskModal from "../workspace/SubmitTaskModal";
import ItemReportSection from "./ItemReportSection";
import SimpleActivityTile from "./SimpleActivityTile";
import ShelfLabelFlow from "./ShelfLabelFlow";
import WastedOverallFlow from "./WastedOverallFlow";
import InventoryCountingSection from "./InventoryCountingSection";
import ActivityStatusPill from "../common/ActivityStatusPill";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import { ACTIVITY_SUBMISSION_OPTIONS } from "../../data/workspaceData";
import { listMyWastedOverallReports } from "../../services/wastedOverallService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

const WASTED_ITEM_LABEL = { EGGS: "Eggs", TOMATO: "Tomato", POTATO: "Potato", CUCUMBER: "Cucumber", ONION: "Onion", OTHER: "Other" };

function wastedItemLabel(report) {
  if (report.item === "OTHER" && report.otherItemName) return report.otherItemName;
  return WASTED_ITEM_LABEL[report.item] || report.item;
}
function wastedQuantityLabel(report) {
  return report.item === "EGGS" ? `${report.quantityCount} egg${report.quantityCount === 1 ? "" : "s"}` : `${report.quantityKg}kg`;
}

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// WorkerActivityTab.jsx — the Activity tab: performing/submitting daily
// activities only. "My Activities" (the employee's own activity history)
// moved to Profile -> Performance History (see PerformanceHistoryScreen.jsx)
// — it isn't gone, just relocated, per the Activity-page unification.
//
// Every category (Cleaning Shelves/Facing/Refilling included) renders as
// the same cube/tile (SimpleActivityTile.jsx) and opens the same
// notes+photo SubmitTaskModal — Cleaning Shelves/Facing/Refilling used to
// have their own separate Not Started/In Progress/Completed Start/
// Complete workflow (DailyStatusTile.jsx), which has been removed so
// every activity in this grid has one consistent UI and one consistent
// submission architecture (see data/workspaceData.js's own comment).
export default function WorkerActivityTab() {
  const {
    data: wastedReports,
    setData: setWastedReports,
    error: wastedError,
    loading: wastedLoading,
    reload: loadWastedReports,
  } = useAsync(listMyWastedOverallReports, { fallbackError: "Could not load your waste reports." });

  const [activeOption, setActiveOption] = useState(null);
  const [labelFlowOpen, setLabelFlowOpen] = useState(false);
  const [wastedFlowOpen, setWastedFlowOpen] = useState(false);
  const [toast, setToast] = useToast();

  function handleWastedSaved(report, message) {
    setWastedReports((prev) => [report, ...(prev ?? [])]);
    setToast(message);
  }

  const handleSaved = (activity, message) => {
    setToast(message);
  };

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Daily Activity</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Expired & Wasted Items</h2>
        <ItemReportSection />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Shelf Labels</h2>
        <button
          type="button"
          onClick={() => setLabelFlowOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl hover:border-[#F47A20]/25 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
              <Tag size={18} />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Report a Label Issue</p>
              <p className="text-xs text-[#8B93A8]">Scan or search a product</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[#4C5266]" />
        </button>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Inventory Counting</h2>
        <InventoryCountingSection />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Wasted Overall</h2>
        <button
          type="button"
          onClick={() => setWastedFlowOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl hover:border-[#F47A20]/25 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
              <PackageX size={18} />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Report Wasted Produce</p>
              <p className="text-xs text-[#8B93A8]">Eggs, Tomato, Potato, Cucumber, Onion, Other</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[#4C5266]" />
        </button>

        {wastedLoading ? (
          <div className="mt-3"><SkeletonCard className="h-16" /></div>
        ) : wastedError ? (
          <div className="mt-3"><ErrorBanner message={wastedError} onRetry={loadWastedReports} /></div>
        ) : wastedReports?.length ? (
          <div className="mt-3 space-y-2">
            {wastedReports.slice(0, 5).map((r) => (
              <div key={r.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white">{wastedItemLabel(r)} — {wastedQuantityLabel(r)}</span>
                  <ActivityStatusPill status={r.status} />
                </div>
                <p className="mt-1 text-xs text-[#8B93A8]">{dateLabel(r.reportedAt)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Other Daily Activities</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACTIVITY_SUBMISSION_OPTIONS.map((option) => (
            <SimpleActivityTile key={option.category} option={option} onSelect={setActiveOption} />
          ))}
        </div>
      </section>

      <SubmitTaskModal option={activeOption} onClose={() => setActiveOption(null)} onSaved={handleSaved} />
      <ShelfLabelFlow open={labelFlowOpen} onClose={() => setLabelFlowOpen(false)} onSaved={handleSaved} />
      <WastedOverallFlow open={wastedFlowOpen} onClose={() => setWastedFlowOpen(false)} onSaved={handleWastedSaved} />

      <Toast message={toast} />
    </div>
  );
}
