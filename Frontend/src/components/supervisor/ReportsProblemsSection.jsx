import { useState } from "react";
import { AlertTriangle, Plus, Loader2, Check } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import EvidenceCapture from "../employee/EvidenceCapture";
import { PROBLEM_TYPES, listMarketProblems, createMarketProblem, updateMarketProblemStatus } from "../../data/supervisorMockData";

const STATUS_TONE = { OPEN: "bg-red-500/10 text-red-400 ring-red-500/20", IN_PROGRESS: "bg-amber-500/10 text-amber-400 ring-amber-500/20", RESOLVED: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" };
const STATUS_LABEL = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" };
const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "RESOLVED"];

// ReportsProblemsSection.jsx — physical/technical market issues (spec
// §20). Local/mock state (data/supervisorMockData.js) — no backend
// model for market problems exists yet, structured as a plain
// {id, problemType, location, description, status, photoUrl, reporterName,
// createdAt} record so a future MarketProblem Prisma model would be a
// drop-in swap for this file's calls.
export default function ReportsProblemsSection({ reporterName }) {
  const { data: problems, setData: setProblems, loading } = useAsync(listMarketProblems, { deps: [] });
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function handleCreated(problem) {
    setProblems((prev) => [problem, ...(prev ?? [])]);
    setShowForm(false);
  }

  async function cycleStatus(problem) {
    const nextIndex = (STATUS_ORDER.indexOf(problem.status) + 1) % STATUS_ORDER.length;
    const updated = await updateMarketProblemStatus(problem.id, STATUS_ORDER[nextIndex]);
    setProblems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelected(updated);
  }

  if (loading) return <SkeletonCard className="h-40" />;

  const openCount = problems.filter((p) => p.status !== "RESOLVED").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#8B93A8]">{openCount} unresolved</p>
        <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36]">
          <Plus size={14} /> Report Problem
        </button>
      </div>

      {problems.length === 0 ? (
        <p className="text-sm text-[#4C5266] text-center py-8">No problems reported.</p>
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
        <ProblemForm reporterName={reporterName} onCreated={handleCreated} />
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.problemType}>
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-[#9AA1B4]">{selected.description}</p>
            <div className="flex justify-between text-sm py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Location</span><span className="text-white">{selected.location}</span></div>
            <div className="flex justify-between text-sm py-1.5 border-b border-white/[0.05]"><span className="text-[#8B93A8]">Reported by</span><span className="text-white">{selected.reporterName}</span></div>
            {selected.photoUrl && <img src={selected.photoUrl} alt="" className="rounded-lg w-full max-h-56 object-cover" />}
            <button
              type="button"
              onClick={() => cycleStatus(selected)}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ring-1 ring-inset ${STATUS_TONE[selected.status]}`}
            >
              <Check size={14} /> Mark as {STATUS_LABEL[STATUS_ORDER[(STATUS_ORDER.indexOf(selected.status) + 1) % STATUS_ORDER.length]]}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProblemForm({ reporterName, onCreated }) {
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
      const problem = await createMarketProblem({ problemType, location: location.trim(), description: description.trim(), photoUrl: photo, reporterName });
      onCreated(problem);
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
