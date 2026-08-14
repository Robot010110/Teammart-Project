import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import Modal from "../common/Modal";
import EvidenceCapture from "./EvidenceCapture";
import { createWastedOverallReport } from "../../services/wastedOverallService";
import { ApiError } from "../../services/apiClient";

// Matches the backend WastedItem enum exactly — the five fixed produce
// items plus Other, for anything not on the list.
const ITEMS = [
  { value: "EGGS", label: "Eggs" },
  { value: "TOMATO", label: "Tomato" },
  { value: "POTATO", label: "Potato" },
  { value: "CUCUMBER", label: "Cucumber" },
  { value: "ONION", label: "Onion" },
  { value: "OTHER", label: "Other" },
];

// WastedOverallFlow.jsx — item -> photo -> quantity -> submit. employeeId
// and marketId are never sent from here at all — the backend derives both
// from the authenticated token (see wastedOverallController.js), so
// there's nothing for this form to even get wrong on that front.
//
// Quantity unit is item-dependent, not just a label swap: Eggs is a
// whole-number count of eggs (quantityCount), sent and validated as such
// end to end (see validate.js/schema.prisma) — never coerced into
// kilograms. Every other item, including Other, stays kg-based
// (quantityKg). Selecting Other also requires a short "Specify item" name
// so the report is useful, not just the literal word "Other".
export default function WastedOverallFlow({ open, onClose, onSaved }) {
  const [step, setStep] = useState("item");
  const [item, setItem] = useState(null);
  const [otherItemName, setOtherItemName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [quantityInvalid, setQuantityInvalid] = useState(false);
  const [otherNameInvalid, setOtherNameInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isEggs = item === "EGGS";
  const isOther = item === "OTHER";

  const reset = () => {
    setStep("item");
    setItem(null);
    setOtherItemName("");
    setPhoto(null);
    setQuantity("");
    setQuantityInvalid(false);
    setOtherNameInvalid(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectItem = (value) => {
    setItem(value);
    setStep("details");
  };

  async function handleSubmit() {
    if (isOther && !otherItemName.trim()) {
      setOtherNameInvalid(true);
      setError("Specify what this item is.");
      return;
    }
    setOtherNameInvalid(false);

    const qty = Number(quantity);
    if (!quantity || Number.isNaN(qty) || qty <= 0) {
      setQuantityInvalid(true);
      setError(isEggs ? "Enter a number of eggs greater than 0." : "Enter a quantity greater than 0.");
      return;
    }
    if (isEggs && !Number.isInteger(qty)) {
      setQuantityInvalid(true);
      setError("Enter a whole number of eggs.");
      return;
    }
    if (qty > 1000) {
      setQuantityInvalid(true);
      setError(isEggs ? "That count looks too large." : "That quantity looks too large — enter kilograms, not grams.");
      return;
    }
    setQuantityInvalid(false);
    setSubmitting(true);
    setError(null);
    try {
      const report = await createWastedOverallReport({
        item,
        ...(isEggs ? { quantityCount: qty } : { quantityKg: qty }),
        ...(isOther ? { otherItemName: otherItemName.trim() } : {}),
        photoUrl: photo || undefined,
      });
      onSaved(report, "Wasted Overall report submitted.");
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit this report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const itemLabel = ITEMS.find((i) => i.value === item)?.label;
  const stepTitle = step === "item" ? "Wasted Overall" : itemLabel;

  return (
    <Modal open={open} onClose={handleClose} title={stepTitle}>
      {step === "item" && (
        <div className="grid grid-cols-2 gap-3">
          {ITEMS.map((i) => (
            <button
              key={i.value}
              onClick={() => handleSelectItem(i.value)}
              className="rounded-xl p-4 text-sm font-medium text-white bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200"
            >
              {i.label}
            </button>
          ))}
        </div>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-[#8B93A8] mb-2">Take Picture</p>
            <EvidenceCapture photo={photo} onPhotoChange={setPhoto} />
          </div>

          {isOther && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Specify Item</label>
              <input
                type="text"
                value={otherItemName}
                onChange={(e) => { setOtherItemName(e.target.value); setOtherNameInvalid(false); }}
                placeholder="e.g. Bread, Milk"
                maxLength={100}
                aria-invalid={otherNameInvalid}
                className={`w-full rounded-lg bg-white/[0.04] border px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none transition-colors duration-200 ${
                  otherNameInvalid ? "border-red-500/60 focus:border-red-500/60" : "border-white/[0.06] focus:border-[#F47A20]/50"
                }`}
              />
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">
              {isEggs ? "Quantity Wasted (eggs)" : "Quantity Wasted (kg)"}
            </label>
            <input
              type="number"
              inputMode={isEggs ? "numeric" : "decimal"}
              step={isEggs ? "1" : "0.1"}
              min="0"
              value={quantity}
              onChange={(e) => { setQuantity(e.target.value); setQuantityInvalid(false); }}
              placeholder={isEggs ? "0" : "0.0"}
              aria-invalid={quantityInvalid}
              className={`w-full rounded-lg bg-white/[0.04] border px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none transition-colors duration-200 ${
                quantityInvalid ? "border-red-500/60 focus:border-red-500/60" : "border-white/[0.06] focus:border-[#F47A20]/50"
              }`}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {submitting ? "Submitting..." : "Submit Waste Report"}
          </button>
        </div>
      )}
    </Modal>
  );
}
