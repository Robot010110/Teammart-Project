import { useState } from "react";
import { AlertTriangle, Plus, Loader2, Check, History, Trash2 } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import AuthenticatedImage from "../common/AuthenticatedImage";
import EvidenceCapture from "../employee/EvidenceCapture";
import { listMarketProblems, createMarketProblem, updateMarketProblemStatus, deleteMarketProblem } from "../../services/marketProblemsService";

const PROBLEM_TYPES = [
  "Freezer not working",
  "Electricity problem",
  "Computer not working",
  "Cashier monitor not working",
  "Door broken",
  "Equipment problem",
  "Internet/network problem",
  "Other market problem",
];

const STATUS_TONE = { OPEN: "bg-red-500/10 text-red-400 ring-red-500/20", IN_PROGRESS: "bg-amber-500/10 text-amber-400 ring-amber-500/20", RESOLVED: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" };
const STATUS_LABEL = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" };
const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "RESOLVED"];

// ReportsProblemsSection.jsx — Repair Pass §4: physical/technical market
// issues, now backed by the real MarketProblem model (previously mock/
// in-memory frontend data). Active queue and History are two genuinely
// separate views (view=active|history — see marketProblemsController.js):
// resolving a problem here removes it from the Active list immediately
// and it only ever reappears under History, surviving a refresh since
// it's a real persisted row, not React state.
export default function ReportsProblemsSection({ marketId }) {
  const [tab, setTab] = useState("active");
  const { data: problems, setData: setProblems, loading, reload } = useAsync(
    () => listMarketProblems(marketId, tab),
    { deps: [marketId, tab] }
  );
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function handleCreated(problem) {
    if (tab === "active") setProblems((prev) => [problem, ...(prev ?? [])]);
    setShowForm(false);
  }

  async function cycleStatus(problem) {
    const nextIndex = (STATUS_ORDER.indexOf(problem.status) + 1) % STATUS_ORDER.length;
    const updated = await updateMarketProblemStatus(problem.id, STATUS_ORDER[nextIndex]);
    // The updated row may no longer belong in whichever tab is currently
    // shown (e.g. it just became RESOLVED while viewing Active) — refetch
    // rather than trying to patch it in place, so the active/history
    // split is always exactly what the backend says it is.
    reload();
    setSelected(updated);
  }

  const [deleting, setDeleting] = useState(false);
  async function handleDelete(problem) {
    setDeleting(true);
    try {
      await deleteMarketProblem(problem.id);
      setSelected(null);
      reload();
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <SkeletonCard className="h-40" />;

  const openCount = tab === "active" ? problems.length : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1">
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
        {tab === "active" && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#F47A20] border border-[#F47A20]/40 hover:bg-[#F47A20]/10 transition-colors"
          >
            <Plus size={14} /> Report Problem
          </button>
        )}
      </div>

      {tab === "active" && openCount !== null && <p className="text-xs text-[#8B93A8] mb-2">{openCount} unresolved issue{openCount === 1 ? "" : "s"}</p>}

      {problems.length === 0 ? (
        <p className="text-sm text-[#4C5266] text-center py-8">
          {tab === "active" ? "No active problems reported." : "No resolved problems yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {problems.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p)}
              className="w-full text-left flex items-start gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
            >
              <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${p.status === "OPEN" ? "bg-red-500/10 text-red-400" : "bg-white/[0.06] text-[#9AA1B4]"}`}>
                <AlertTriangle size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">{p.problemType}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                <p className="text-xs text-[#8B93A8] mt-0.5">{p.location}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Report a Problem">
        <ProblemForm onCreated={handleCreated} />
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.problemType}>
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-[#9AA1B4]">{selected.description}</p>
            <div className="flex justify-between text-sm py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Location</span><span className="text-white">{selected.location}</span></div>
            <div className="flex justify-between text-sm py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Reported by</span><span className="text-white">{selected.reportedByUser?.name}</span></div>
            {selected.photoUrl && <AuthenticatedImage src={selected.photoUrl} alt="" className="rounded-lg w-full max-h-56 object-cover" />}
            {selected.status !== "RESOLVED" && (
              <button
                type="button"
                onClick={() => cycleStatus(selected)}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ring-1 ring-inset ${STATUS_TONE[selected.status]}`}
              >
                <Check size={14} /> Mark as {STATUS_LABEL[STATUS_ORDER[(STATUS_ORDER.indexOf(selected.status) + 1) % STATUS_ORDER.length]]}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDelete(selected)}
              disabled={deleting}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-red-400 bg-red-500/[0.06] border border-red-500/20 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete Report
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProblemForm({ onCreated }) {
  const [problemType, setProblemType] = useState(PROBLEM_TYPES[0]);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (!location.trim() || !description.trim()) {
      setError("Location and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const problem = await createMarketProblem({ problemType, location: location.trim(), description: description.trim(), photoUrl: photo });
      onCreated(problem);
    } catch {
      setError("Could not submit this report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Problem Type</label>
        <select value={problemType} onChange={(e) => setProblemType(e.target.value)} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-sm text-white outline-none focus:border-[#F47A20]/50">
          {PROBLEM_TYPES.map((t) => <option key={t} value={t} className="bg-[#1F2436]">{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Freezer section" className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50" />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-sm text-white outline-none focus:border-[#F47A20]/50 resize-none" />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Photo (optional)</label>
        <EvidenceCapture photo={photo} onPhotoChange={setPhoto} />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button type="button" onClick={handleSubmit} disabled={submitting} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50">
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Submit Report
      </button>
    </div>
  );
}
