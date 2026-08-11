import { useState } from "react";
import { MessageCircle, Pencil, Loader2, Check } from "lucide-react";
import { updateMyWhatsApp } from "../../services/profileService";
import { ApiError } from "../../services/apiClient";

// Digits-only (strip spaces/dashes/parens/leading "+") before building
// the wa.me link — same normalization the backend applies on save, done
// again defensively here in case an older, un-normalized value is still
// stored, so this can never build a malformed wa.me URL.
function digitsOnly(value) {
  return (value || "").replace(/[\s\-().]/g, "").replace(/^\+/, "");
}

// WhatsAppField.jsx — a dedicated, tappable WhatsApp contact card on the
// profile header. Tapping the number opens wa.me directly; tapping the
// pencil (or the "Add" state when no number is set yet) opens an inline
// editor that saves via PATCH /api/profile. No fake in-app chat is ever
// created — this only ever opens the real WhatsApp app/web link.
export default function WhatsAppField({ number, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(number || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await updateMyWhatsApp(value.trim() || null);
      onSaved(res.whatsappNumber);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this number.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl p-3 bg-white/[0.03] border border-[#F47A20]/30 col-span-2 sm:col-span-1">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1.5">
          <MessageCircle size={11} /> WhatsApp
        </p>
        <input
          autoFocus
          inputMode="tel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="+964 750 123 4567"
          className="w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-2.5 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
        />
        {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Save
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setValue(number || ""); setError(null); }}
            disabled={saving}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!number) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-xl p-3 bg-white/[0.03] border border-dashed border-white/[0.12] hover:border-[#F47A20]/30 text-left transition-colors"
      >
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]">
          <MessageCircle size={11} /> WhatsApp
        </p>
        <p className="mt-1 text-sm font-medium text-[#F47A20]">+ Add number</p>
      </button>
    );
  }

  return (
    <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06] flex items-start justify-between gap-2">
      <a href={`https://wa.me/${digitsOnly(number)}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]">
          <MessageCircle size={11} className="text-emerald-400" /> WhatsApp
        </p>
        <p className="mt-1 text-sm font-medium text-emerald-400 truncate">+{digitsOnly(number)}</p>
      </a>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 p-1 text-[#4C5266] hover:text-white"
        aria-label="Edit WhatsApp number"
      >
        <Pencil size={13} />
      </button>
    </div>
  );
}
