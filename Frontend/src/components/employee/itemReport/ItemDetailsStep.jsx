import { Loader2, CheckCircle2 } from "lucide-react";

const CONDITIONS = [
  { value: "EXPIRED", label: "Expired" },
  { value: "WASTED", label: "Wasted" },
];

// ItemDetailsStep.jsx — condition/quantity/notes form + submit. All state
// (quantity, notes, etc.) is owned by the orchestrator here rather than
// locally, since handleSubmit (also in the orchestrator) needs to read
// it — unlike the other steps, this one is a plain controlled form.

export default function ItemDetailsStep({
  product,
  condition,
  onConditionChange,
  quantity,
  onQuantityChange,
  quantityInvalid,
  notes,
  onNotesChange,
  submitting,
  error,
  onSubmit,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg p-3 bg-white/[0.04]">
        <p className="text-sm text-white font-medium">{product.name}</p>
        <p className="text-[11px] text-[#8B93A8]">Barcode {product.barcode}</p>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Condition</label>
        <div className="flex gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c.value}
              onClick={() => onConditionChange(c.value)}
              className={`flex-1 rounded-lg py-3 text-sm font-medium transition-colors duration-150 ${
                condition === c.value ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] active:bg-white/[0.09]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Quantity</label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={quantity}
          onChange={(e) => onQuantityChange(e.target.value)}
          placeholder="Number of items"
          aria-invalid={quantityInvalid}
          className={`w-full rounded-lg bg-white/[0.04] border px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none transition-colors duration-200 ${
            quantityInvalid ? "border-red-500/60 focus:border-red-500/60" : "border-white/[0.06] focus:border-[#F47A20]/50"
          }`}
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
        {submitting ? "Submitting..." : "Submit Report"}
      </button>
    </div>
  );
}
