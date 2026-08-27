import { useState } from "react";
import { Camera, Loader2, CheckCircle2, X } from "lucide-react";
import Modal from "../common/Modal";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { createActivity } from "../../services/activityService";
import { prepareImageForUpload } from "../../services/activityService";
import { ApiError } from "../../services/apiClient";

function nowTimeLabel() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// InventoryCountingFlow.jsx — spec §4: complete the physical count using
// the market's own inventory system (outside this app), then submit
// proof — a photo of the completed counting sheet. Reuses the existing
// Activity/ITEM_COUNTING submission architecture (createActivity), just
// carrying the resolved assignment id along so the record keeps its own
// "assignment/authorization information" (spec §4) rather than a bare
// photo with no context — see Activity.countingAssignmentId's own
// schema comment.
export default function InventoryCountingFlow({ open, onClose, assignment, onSaved }) {
  const [photo, setPhoto] = useState(null); // { url, progress } | null
  const [photoBusy, setPhotoBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setPhoto(null);
    setNotes("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    setPhoto({ url: null, progress: 0 });
    try {
      const url = await prepareImageForUpload(file, { onProgress: (progress) => setPhoto({ url: null, progress }) });
      setPhoto({ url, progress: 100 });
    } catch {
      setError("Could not process that photo. Please try again.");
      setPhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!photo?.url) {
      setError("Take a photo of the completed counting sheet.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const activity = await createActivity({
        category: "ITEM_COUNTING",
        date: new Date().toISOString().slice(0, 10),
        time: nowTimeLabel(),
        status: "PENDING",
        notes: notes.trim() || undefined,
        imageUrls: [photo.url],
        countingAssignmentId: assignment?.id || undefined,
      });
      onSaved(activity, "Inventory count submitted.");
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit this count. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Submit Inventory Count">
      <div className="space-y-4">
        {assignment && (
          <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wide text-[#8B93A8]">Counting</p>
            <p className="mt-1 text-sm font-medium text-white">{assignment.assignedDepartment}</p>
            {assignment.countingArea && <p className="text-xs text-[#8B93A8]">{assignment.countingArea}</p>}
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Counting Sheet Photo</label>
          {photo?.url ? (
            <div className="relative h-28 w-28 rounded-lg overflow-hidden ring-1 ring-white/10">
              <AuthenticatedImage src={photo.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                aria-label="Remove photo"
                className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-black/80 grid place-items-center"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ) : (
            <label
              className={`h-28 w-28 rounded-lg border grid place-items-center transition-colors duration-200 cursor-pointer ${
                photoBusy ? "opacity-50 pointer-events-none" : "hover:border-[#F47A20]/40"
              } bg-gradient-to-br from-[#2A3050] to-[#181C2C] border-white/[0.06]`}
            >
              {photoBusy ? (
                <div className="flex flex-col items-center gap-1">
                  <Loader2 size={18} className="text-[#4C5266] animate-spin" />
                  <span className="text-[9px] text-[#4C5266]">{photo?.progress ?? 0}%</span>
                </div>
              ) : (
                <Camera size={22} className="text-[#4C5266]" />
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files[0])}
                aria-label="Add counting sheet photo"
              />
            </label>
          )}
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || photoBusy}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
