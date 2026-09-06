import { useState } from "react";
import { Loader2, Store } from "lucide-react";
import Modal from "../common/Modal";
import { useAsync } from "../../hooks/useAsync";
import { createMarket } from "../../services/marketService";
import { listZones } from "../../services/zoneService";
import { ApiError } from "../../services/apiClient";

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "CLOSED", label: "Inactive" },
];

// AddMarketModal.jsx — a real create, not a decorative button:
// POST /api/markets with { name, zoneId, status }. The zone list comes
// from GET /api/zones, which is already scoped server-side to this
// Regional Manager's own zones, and the backend independently rejects
// any zone outside them (marketsController.createMarket) — so this form
// can only ever offer, and only ever succeed at, what the account is
// genuinely allowed to do.
export default function AddMarketModal({ open, onClose, onCreated }) {
  const { data: zones, loading: zonesLoading } = useAsync(listZones, { deps: [open] });

  const [name, setName] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const zoneList = zones ?? [];
  const effectiveZoneId = zoneId || (zoneList.length === 1 ? String(zoneList[0].number) : "");

  function reset() {
    setName(""); setZoneId(""); setStatus("ACTIVE"); setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError("Enter a market name (at least 2 characters)."); return; }

    // listZones returns a display id like "zone-3"; the create endpoint
    // wants the numeric Zone.id, so resolve it from the chosen row
    // rather than parsing the label.
    const chosen = zoneList.find((z) => String(z.number) === String(effectiveZoneId));
    if (!chosen) { setError("Choose a zone for this market."); return; }
    const numericZoneId = Number(String(chosen.id).replace("zone-", ""));

    setSaving(true);
    setError(null);
    try {
      const created = await createMarket({ name: trimmed, zoneId: numericZoneId, status });
      reset();
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the market. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Market" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4 sm:px-5">
        <div>
          <label htmlFor="market-name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8B93A8]">
            Market name
          </label>
          <div className="relative">
            <Store size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6479]" />
            <input
              id="market-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Qushtapa 3"
              autoFocus
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 pl-10 pr-3.5 text-[15px] text-white outline-none transition-colors placeholder:text-[#4C5266] focus:border-[#F47A20]/60"
            />
          </div>
        </div>

        <div>
          <label htmlFor="market-zone" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8B93A8]">
            Zone
          </label>
          <select
            id="market-zone"
            value={effectiveZoneId}
            onChange={(e) => setZoneId(e.target.value)}
            disabled={zonesLoading}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-[15px] text-white outline-none transition-colors focus:border-[#F47A20]/60 disabled:opacity-60"
          >
            <option value="" className="bg-[#1F2436]">{zonesLoading ? "Loading zones…" : "Select a zone"}</option>
            {zoneList.map((z) => (
              <option key={z.id} value={z.number} className="bg-[#1F2436]">Zone {z.number}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8B93A8]">Status</span>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                aria-pressed={status === s.value}
                className={`rounded-xl border py-2.5 text-[12.5px] font-semibold transition-all duration-200 ${
                  status === s.value
                    ? "border-[#F47A20]/60 bg-[#F47A20]/[0.14] text-white shadow-[0_0_16px_-4px_rgba(244,122,32,0.55)]"
                    : "border-white/[0.08] bg-white/[0.03] text-[#8B93A8] hover:border-white/[0.16]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-[12.5px] text-red-400">{error}</p>}

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-[14px] font-semibold text-[#9AA1B4] transition-colors hover:bg-white/[0.07]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F47A20] to-[#E0561A] py-3 text-[14px] font-semibold text-white shadow-[0_0_20px_-4px_rgba(244,122,32,0.7)] transition-all duration-200 hover:from-[#ff8b36] hover:to-[#F47A20] active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : "Create Market"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
