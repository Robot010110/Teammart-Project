import { useState } from "react";
import { Camera, Loader2, CheckCircle2, X, DollarSign } from "lucide-react";
import Modal from "../common/Modal";
import AuthenticatedImage from "../common/AuthenticatedImage";
import MoneyInput from "../common/MoneyInput";
import { submitTotalSales } from "../../services/totalSalesService";
import { prepareImageForUpload } from "../../services/activityService";
import { ApiError } from "../../services/apiClient";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// SubmitTotalSalesModal.jsx — spec §5: Supervisor enters the market's
// total money sold for one 24-hour day, attaches evidence, reviews, and
// submits. There is deliberately no "view past submissions" screen for
// the Supervisor here (see totalSalesController.js's own comment — the
// Regional Manager is the only viewer); this modal's confirmation
// (Toast, from the caller) is the only feedback the Supervisor ever gets
// about a submission after the fact.
export default function SubmitTotalSalesModal({ open, onClose, onSaved }) {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [photo, setPhoto] = useState(null); // { url, progress } | null
  const [photoBusy, setPhotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const reset = () => {
    setDate(todayIso());
    setAmount("");
    setPhoto(null);
    setError(null);
    setFieldErrors({});
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
    const errors = {};
    if (!amount || Number(amount) <= 0) errors.amount = true;
    if (!photo?.url) errors.photo = true;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Enter the total amount and attach the evidence photo.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const report = await submitTotalSales({ date, amount: Number(amount), photoUrl: photo.url });
      onSaved(report);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit this report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Submit Total Sales">
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
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Total Amount Sold</label>
          <div className="relative">
            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
            {/* Cleanup Phase §11 — a comma-formatted display ("1,000,000")
                while the value this component ever hands back via
                onChange stays a plain digits-only string; Number(amount)
                below (unchanged) is exactly what gets submitted. */}
            <MoneyInput
              value={amount}
              onChange={(v) => { setAmount(v); setFieldErrors((f) => ({ ...f, amount: false })); }}
              placeholder="0"
              aria-invalid={fieldErrors.amount}
              className={`w-full rounded-lg bg-white/[0.04] border pl-8 pr-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none transition-colors duration-200 ${
                fieldErrors.amount ? "border-red-500/60" : "border-white/[0.06] focus:border-[#F47A20]/50"
              }`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Evidence Photo</label>
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
              } bg-gradient-to-br from-[#2A3050] to-[#181C2C] ${fieldErrors.photo ? "border-red-500/60" : "border-white/[0.06]"}`}
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
                aria-label="Add evidence photo"
              />
            </label>
          )}
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
