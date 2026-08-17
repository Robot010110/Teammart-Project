import { useState } from "react";
import { Star, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import Modal from "../common/Modal";
import { rateMarket, addMarketNote, sendMarketFeedback } from "../../services/marketManagementService";
import { ApiError } from "../../services/apiClient";

// InspectionModals.jsx — the three Regional Manager market-evaluation
// actions (spec §20-24): a 1-10 rating, an internal management note, and
// formal Warning/Recognition feedback to the market's Supervisor. Kept
// structurally and visually distinct from Chat (spec §21) — these post
// to marketManagementService, never chatService, and render as a plain
// form + confirmation, not a message bubble. All three share the same
// small "star rating" / textarea / title+description shape, so they live
// in one file rather than three near-identical ones.

export function RateMarketModal({ open, marketId, visitId, onClose, onSaved }) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (rating < 1) {
      setError("Choose a rating from 1 to 10.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await rateMarket(marketId, { rating, notes: notes.trim() || undefined, visitId });
      onSaved(created);
      setRating(0);
      setNotes("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this rating.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Rate Market">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-2">Rating (1-10)</label>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                  n <= rating ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] hover:bg-white/[0.09]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="mt-2 flex items-center gap-1 text-sm text-amber-400">
              <Star size={14} className="fill-current" /> {rating}/10
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What informed this rating?"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />}
          Submit Rating
        </button>
      </div>
    </Modal>
  );
}

export function AddNoteModal({ open, marketId, visitId, onClose, onSaved }) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (!content.trim()) {
      setError("Write a note before saving.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await addMarketNote(marketId, { content: content.trim(), category: category.trim() || undefined, visitId });
      onSaved(created);
      setContent("");
      setCategory("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this note.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Management Note">
      <div className="space-y-4">
        <p className="text-xs text-[#8B93A8]">Internal only — never shown to the market's Supervisor.</p>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Note</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="e.g. Freezer section needs better organization. Follow up next visit."
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Category (optional)</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Cleanliness, Staffing"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : "Save Note"}
        </button>
      </div>
    </Modal>
  );
}

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

export function SendFeedbackModal({ open, type, marketId, visitId, onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isWarning = type === "WARNING";

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      setError("Title and description are both required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await sendMarketFeedback(marketId, {
        type,
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || undefined,
        priority: isWarning ? priority : undefined,
        visitId,
      });
      onSaved(created);
      setTitle("");
      setDescription("");
      setCategory("");
      setPriority("NORMAL");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send this.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isWarning ? "Send Warning" : "Send Recognition"}>
      <div className="space-y-4">
        <p className={`flex items-center gap-1.5 text-xs ${isWarning ? "text-red-400" : "text-emerald-400"}`}>
          {isWarning ? <ShieldAlert size={13} /> : <Sparkles size={13} />}
          Sent directly to this market's Supervisor as a formal record — not a chat message.
        </p>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isWarning ? "e.g. Fresh section cleanliness" : "e.g. Excellent teamwork"}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={
              isWarning
                ? "Today we visited your market and noticed the Fresh section requires improvement..."
                : "We visited your market today and found it clean and well organized..."
            }
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Category (optional)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Cleanliness"
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
            />
          </div>
          {isWarning && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50"
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
            isWarning ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : isWarning ? <ShieldAlert size={15} /> : <Sparkles size={15} />}
          {isWarning ? "Send Warning" : "Send Recognition"}
        </button>
      </div>
    </Modal>
  );
}
