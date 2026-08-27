import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import RmMarketOverview from "./RmMarketOverview";
import Modal from "../components/common/Modal";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/apiClient";
import { startMarketVisit, completeMarketVisit, cancelMarketVisit, listMarketVisits } from "../services/adminService";

// AdminMarketDetailPage.jsx — Admin Phase 3 §6: "when Admin starts an
// inspection for a Market, open the existing Market page/data. Do NOT
// build a separate duplicate Market implementation." Wraps
// RmMarketOverview.jsx entirely unchanged — the exact same real
// Employees/Supervisor/Departments/Attendance/Activities view a Regional
// Manager already gets — and adds only the explicit Visit/Inspection
// action bar on top (spec §1: a normal market page open must never
// itself count as a visit).
export default function AdminMarketDetailPage({ marketId }) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const { data: openVisits, reload } = useAsync(
    () => listMarketVisits({ marketId, status: "STARTED", pageSize: 1 }),
    { deps: [marketId] }
  );
  const openVisit = openVisits?.visits?.[0] ?? null;

  return (
    <div>
      <div className="px-4 sm:px-6 md:px-10 pt-6 max-w-4xl mx-auto">
        <VisitBar marketId={marketId} openVisit={openVisit} onChanged={reload} starting={starting} setStarting={setStarting} />
      </div>
      <RmMarketOverview
        marketId={marketId}
        onOpenEmployee={(employeeId) => navigate(`/admin/employees/${employeeId}`)}
        onOpenSection={() => {}}
        onOpenHistory={() => {}}
        onOpenTotalSales={() => {}}
        onOpenCardSales={() => {}}
        onBack={() => navigate("/admin/markets")}
      />
    </div>
  );
}

function VisitBar({ marketId, openVisit, onChanged, starting, setStarting }) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleStart(visitType) {
    setStarting(true);
    setError(null);
    try {
      await startMarketVisit(marketId, { visitType });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start this visit.");
    } finally {
      setStarting(false);
    }
  }

  if (openVisit) {
    return (
      <>
        <div className="rounded-xl p-3.5 mb-4 bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <ShieldAlert size={15} />
            {openVisit.visitType === "INSPECTION" ? "Administrative Inspection" : "Market Visit"} in progress
          </div>
          <button
            type="button"
            onClick={() => setCompleting(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors"
          >
            <CheckCircle2 size={13} /> Complete
          </button>
        </div>
        {completing && (
          <CompleteCancelModal
            visit={openVisit}
            onClose={() => setCompleting(false)}
            onDone={() => { setCompleting(false); onChanged(); }}
          />
        )}
      </>
    );
  }

  return (
    <div className="rounded-xl p-3.5 mb-4 bg-[#171C2E]/80 border border-white/[0.06] flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => handleStart("VISIT")}
        disabled={starting}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 transition-colors"
      >
        <ClipboardCheck size={13} /> Start Market Visit
      </button>
      <button
        type="button"
        onClick={() => handleStart("INSPECTION")}
        disabled={starting}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
      >
        <ShieldAlert size={13} /> Start Administrative Inspection
      </button>
      {error && <p className="text-xs text-red-400 w-full">{error}</p>}
    </div>
  );
}

function CompleteCancelModal({ visit, onClose, onDone }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleComplete() {
    setBusy(true);
    setError(null);
    try {
      await completeMarketVisit(visit.id, notes.trim() || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete this visit.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelMarketVisit(visit.id, notes.trim() || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel this visit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={visit.visitType === "INSPECTION" ? "Complete Inspection" : "Complete Visit"}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Notes / Findings (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50" />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleCancel} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/15 disabled:opacity-50 transition-colors">
            <XCircle size={14} /> Cancel Visit
          </button>
          <button type="button" onClick={handleComplete} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
            <CheckCircle2 size={14} /> {busy ? "Saving..." : "Complete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
