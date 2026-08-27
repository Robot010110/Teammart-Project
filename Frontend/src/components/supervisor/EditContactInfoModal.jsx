import { useState } from "react";
import { Check, Loader2, Phone, MessageCircle } from "lucide-react";
import Modal from "../common/Modal";
import { updateMyPhoneNumber, updateMyWhatsApp } from "../../services/profileService";
import { ApiError } from "../../services/apiClient";

// EditContactInfoModal.jsx — Repair Pass §3: a Supervisor editing their
// own phone number / WhatsApp number, through the exact same shared
// PATCH /api/profile endpoint and validated shape (updateMyProfileSchema)
// an Employee's WhatsApp field already used — see
// profileController.updateMyProfile's staff branch. Ownership is
// enforced server-side from the auth token; this modal has no way to
// target anyone else's profile even in principle.
export default function EditContactInfoModal({ open, onClose, initialPhone, initialWhatsapp, onSaved }) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const phoneTrimmed = phone.trim() || null;
      const whatsappTrimmed = whatsapp.trim() || null;
      const [phoneRes, whatsappRes] = await Promise.all([
        phoneTrimmed !== (initialPhone ?? null) ? updateMyPhoneNumber(phoneTrimmed) : null,
        whatsappTrimmed !== (initialWhatsapp ?? null) ? updateMyWhatsApp(whatsappTrimmed) : null,
      ]);
      onSaved({
        phoneNumber: phoneRes?.phoneNumber !== undefined ? phoneRes.phoneNumber : initialPhone,
        whatsappNumber: whatsappRes?.whatsappNumber !== undefined ? whatsappRes.whatsappNumber : initialWhatsapp,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your contact info.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50";

  return (
    <Modal open={open} onClose={onClose} title="Edit Contact Info">
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#8B93A8] mb-1.5">
            <Phone size={13} /> Phone number
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9647501234567"
            inputMode="tel"
            className={inputClass}
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#8B93A8] mb-1.5">
            <MessageCircle size={13} /> WhatsApp number
          </label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="e.g. 9647501234567"
            inputMode="tel"
            className={inputClass}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors duration-150"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save
        </button>
      </div>
    </Modal>
  );
}
