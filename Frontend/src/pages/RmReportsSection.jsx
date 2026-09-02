import { useMemo, useState } from "react";
import { AlertTriangle, History, Check, Trash2, Loader2, Store } from "lucide-react";
import Modal from "../components/common/Modal";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import { useAsync } from "../hooks/useAsync";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ErrorBanner from "../components/common/ErrorBanner";
import { listZoneMarketProblems, updateMarketProblemStatus, deleteMarketProblem } from "../services/marketProblemsService";

const STATUS_TONE = { OPEN: "bg-red-500/10 text-red-400 ring-red-500/20", IN_PROGRESS: "bg-amber-500/10 text-amber-400 ring-amber-500/20", RESOLVED: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" };
const STATUS_LABEL = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" };
const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "RESOLVED"];

function timeLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// RmReportsSection.jsx — Chat Hub §8: every operational issue reported
// across every market in the Regional Manager's zone(s), in one place,
// instead of opening each market's own Reports & Problems separately.
// Real data — GET /api/market-problems?zoneId= (see
// marketProblemsController.listMarketProblems's own comment on the RM
// zone-wide branch added for this), the exact same MarketProblem model/
// lifecycle Supervisor's ReportsProblemsSection.jsx already uses, not a
// second reporting system. A Regional Manager can act on a report
// (cycle its status) the same way a Supervisor can — assertMarketAccess
// already allows it, since the market is in one of their own zones.
export default function RmReportsSection({ zoneIds }) {
  const [tab, setTab] = useState("active");
  const { data: byZone, error, loading, reload } = useAsync(
    () => Promise.all(zoneIds.map((zoneId) => listZoneMarketProblems(zoneId, tab))),
    { deps: [zoneIds.join(","), tab], fallbackError: "Could not load reports." }
  );
  const [selected, setSelected] = useState(null);
  const [acting, setActing] = useState(false);

  const problems = useMemo(() => (byZone ?? []).flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [byZone]);

  async function cycleStatus(problem) {
    setActing(true);
    try {
      const nextIndex = (STATUS_ORDER.indexOf(problem.status) + 1) % STATUS_ORDER.length;
      const updated = await updateMarketProblemStatus(problem.id, STATUS_ORDER[nextIndex]);
      setSelected(updated);
      reload();
    } finally {
      setActing(false);
    }
  }

  async function handleDelete(problem) {
    setActing(true);
    try {
      await deleteMarketProblem(problem.id);
      setSelected(null);
      reload();
    } finally {
      setActing(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 mb-3 w-fit">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${tab === "active" ? "bg-[#F47A20] text-white" : "text-[#9AA1B4] hover:text-white"}`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${tab === "history" ? "bg-[#F47A20] text-white" : "text-[#9AA1B4] hover:text-white"}`}
        >
          <History size={12} /> History
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-[90px]" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : problems.length === 0 ? (
        <div className="rounded-2xl p-8 bg-[#171C2E]/80 border border-white/[0.06] text-center">
          <p className="text-sm text-[#8B93A8]">{tab === "active" ? "No active reports across your zone." : "No resolved reports yet."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {problems.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p)}
              className="w-full text-left flex items-start gap-3 rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
            >
              <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${p.status === "OPEN" ? "bg-red-500/10 text-red-400" : "bg-white/[0.06] text-[#9AA1B4]"}`}>
                <AlertTriangle size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">{p.problemType}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                <p className="flex items-center gap-1 text-xs text-[#8B93A8] mt-0.5">
                  <Store size={11} /> {p.market?.name ?? "Market"} &middot; {p.location}
                </p>
                <p className="text-[11px] text-[#4C5266] mt-1">{p.reportedByUser?.name} &middot; {timeLabel(p.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.problemType}>
        {selected && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Market</span><span className="text-white">{selected.market?.name}</span></div>
            <div className="flex justify-between text-sm py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Location</span><span className="text-white">{selected.location}</span></div>
            <div className="flex justify-between text-sm py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Reported by</span><span className="text-white">{selected.reportedByUser?.name}</span></div>
            <div className="flex justify-between text-sm py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Reported</span><span className="text-white">{timeLabel(selected.createdAt)}</span></div>
            <p className="text-sm text-[#9AA1B4]">{selected.description}</p>
            {selected.photoUrl && <AuthenticatedImage src={selected.photoUrl} alt="" className="rounded-lg w-full max-h-56 object-cover" />}
            {selected.status !== "RESOLVED" && (
              <button
                type="button"
                onClick={() => cycleStatus(selected)}
                disabled={acting}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ring-1 ring-inset disabled:opacity-50 ${STATUS_TONE[selected.status]}`}
              >
                {acting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Mark as {STATUS_LABEL[STATUS_ORDER[(STATUS_ORDER.indexOf(selected.status) + 1) % STATUS_ORDER.length]]}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDelete(selected)}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-red-400 bg-red-500/[0.06] border border-red-500/20 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {acting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete Report
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
