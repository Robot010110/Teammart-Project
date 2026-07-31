import { useState } from "react";
import { Camera, Loader2, CheckCircle2, X } from "lucide-react";
import Modal from "../common/Modal";
import { createPriceReport } from "../../services/priceReportService";
import { prepareImageForUpload } from "../../services/activityService";
import { ApiError } from "../../services/apiClient";

// PriceReportFlow.jsx — a Cashier flags a shelf-price vs. POS-system-price
// mismatch. A single form (not a multi-step wizard like ItemReportFlow) —
// the spec asks for a plain optional barcode text field here, not a
// barcode-scan step, so there's no camera/search flow to orchestrate.
// The photo capture reuses prepareImageForUpload (activityService.js) —
// the exact same compression pipeline already built for Activities and
// Item Reports, zero new image-handling code.

export default function PriceReportFlow({ open, onClose, onSaved }) {
  const [photo, setPhoto] = useState(null); // { url, progress } | null
  const [photoBusy, setPhotoBusy] = useState(false);
  const [productName, setProductName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [shelfPrice, setShelfPrice] = useState("");
  const [systemPrice, setSystemPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const reset = () => {
    setPhoto(null);
    setProductName("");
    setBarcode("");
    setShelfPrice("");
    setSystemPrice("");
    setNotes("");
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
    } catch (err) {
      setError("Could not process that photo. Please try again.");
      setPhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = async () => {
    const errors = {};
    if (!productName.trim()) errors.productName = true;
    if (!shelfPrice || Number(shelfPrice) < 0) errors.shelfPrice = true;
    if (!systemPrice || Number(systemPrice) < 0) errors.systemPrice = true;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Fill in the product name, shelf price, and system price.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const report = await createPriceReport({
        productName: productName.trim(),
        barcode: barcode.trim() || undefined,
        shelfPrice: Number(shelfPrice),
        systemPrice: Number(systemPrice),
        notes: notes.trim() || undefined,
        photoUrl: photo?.url || undefined,
      });
      onSaved(report, "Price report sent to your Supervisor.");
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit this report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (invalid) =>
    `w-full rounded-lg bg-white/[0.04] border px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none transition-colors duration-200 ${
      invalid ? "border-red-500/60 focus:border-red-500/60" : "border-white/[0.06] focus:border-[#F47A20]/50"
    }`;

  return (
    <Modal open={open} onClose={handleClose} title="Report Price Difference">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Product Photo (optional)</label>
          {photo?.url ? (
            <div className="relative h-24 w-24 rounded-lg overflow-hidden ring-1 ring-white/10">
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
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
              className={`h-24 w-24 rounded-lg border grid place-items-center transition-colors duration-200 cursor-pointer ${
                photoBusy ? "opacity-50 pointer-events-none" : "hover:border-[#F47A20]/40"
              } bg-gradient-to-br from-[#2A3050] to-[#181C2C] border-white/[0.06]`}
            >
              {photoBusy ? (
                <div className="flex flex-col items-center gap-1">
                  <Loader2 size={18} className="text-[#4C5266] animate-spin" />
                  <span className="text-[9px] text-[#4C5266]">{photo?.progress ?? 0}%</span>
                </div>
              ) : (
                <Camera size={20} className="text-[#4C5266]" />
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files[0])}
                aria-label="Add product photo"
              />
            </label>
          )}
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Product Name</label>
          <input
            value={productName}
            onChange={(e) => { setProductName(e.target.value); setFieldErrors((f) => ({ ...f, productName: false })); }}
            placeholder="e.g. Lays Chips 150g"
            aria-invalid={fieldErrors.productName}
            className={inputClass(fieldErrors.productName)}
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Barcode (optional)</label>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Barcode number"
            inputMode="numeric"
            className={inputClass(false)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Shelf Price</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={shelfPrice}
              onChange={(e) => { setShelfPrice(e.target.value); setFieldErrors((f) => ({ ...f, shelfPrice: false })); }}
              placeholder="0.00"
              aria-invalid={fieldErrors.shelfPrice}
              className={inputClass(fieldErrors.shelfPrice)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">System Price</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={systemPrice}
              onChange={(e) => { setSystemPrice(e.target.value); setFieldErrors((f) => ({ ...f, systemPrice: false })); }}
              placeholder="0.00"
              aria-invalid={fieldErrors.systemPrice}
              className={inputClass(fieldErrors.systemPrice)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={`${inputClass(false)} resize-none`}
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
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
