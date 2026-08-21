import { useState } from "react";
import { Camera, Loader2, CheckCircle2, X } from "lucide-react";
import Modal from "../common/Modal";
import { submitCardSales } from "../../services/cardSalesService";
import { prepareImageForUpload } from "../../services/activityService";
import { ApiError } from "../../services/apiClient";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const SHIFT_OPTIONS = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "NIGHT", label: "Night" },
];

// SubmitCardSalesModal.jsx — spec §6-7: Supervisor or Overlooking picks
// the shift/reporting period, attaches 1-2 evidence photos of the
// physical card count, and submits. Report periods are labels only, not
// enforced clock times (spec: "should not be treated as rigid hardcoded
// times") — the actual submission time is just whenever this is sent.
export default function SubmitCardSalesModal({ open, onClose, defaultShift, onSaved }) {
  const [date, setDate] = useState(todayIso());
  const [shift, setShift] = useState(defaultShift ?? "MORNING");
  const [photos, setPhotos] = useState([]); // up to 2, { url } each
  const [photoBusy, setPhotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setDate(todayIso());
    setShift(defaultShift ?? "MORNING");
    setPhotos([]);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePhoto = async (file) => {
    if (!file || photos.length >= 2) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const url = await prepareImageForUpload(file);
      setPhotos((prev) => [...prev, url]);
    } catch {
      setError("Could not process that photo. Please try again.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      setError("Attach at least one photo of the card count.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const report = await submitCardSales({ date, shift, photoUrl: photos[0], photoUrl2: photos[1] });
      onSaved(report);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit this report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Submit Card Sales">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white outline-none focus:border-[#F47A20]/50"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Shift</label>
          <div className="grid grid-cols-3 gap-2">
            {SHIFT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setShift(opt.value)}
                className={`rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${
                  shift === opt.value ? "bg-[#F47A20] text-white" : "bg-white/[0.04] text-[#9AA1B4] hover:bg-white/[0.08]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">
            Card Count Photo{photos.length > 0 ? `s (${photos.length}/2)` : "s (1 required, 2 max)"}
          </label>
          <div className="flex gap-2 flex-wrap">
            {photos.map((url, i) => (
              <div key={i} className="relative h-24 w-24 rounded-lg overflow-hidden ring-1 ring-white/10">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove photo"
                  className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-black/80 grid place-items-center"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}
            {photos.length < 2 && (
              <label
                className={`h-24 w-24 rounded-lg border grid place-items-center transition-colors duration-200 cursor-pointer ${
                  photoBusy ? "opacity-50 pointer-events-none" : "hover:border-[#F47A20]/40"
                } bg-gradient-to-br from-[#2A3050] to-[#181C2C] border-white/[0.06]`}
              >
                {photoBusy ? <Loader2 size={18} className="text-[#4C5266] animate-spin" /> : <Camera size={20} className="text-[#4C5266]" />}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePhoto(e.target.files[0])}
                  aria-label="Add card count photo"
                />
              </label>
            )}
          </div>
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
