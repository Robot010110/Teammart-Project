import { useState } from "react";
import { Camera, ImagePlus, Loader2, Check, RotateCcw } from "lucide-react";
import Modal from "../common/Modal";
import { prepareImageForUpload } from "../../services/activityService";
import { updateMyProfilePhoto } from "../../services/profileService";
import { ApiError } from "../../services/apiClient";

// ChangePhotoModal.jsx — Profile → Profile Photo → Change Photo (spec
// §3). Take Photo / Choose From Gallery -> preview -> Confirm/Cancel ->
// saved via the existing PATCH /api/profile (profileService.
// updateMyProfilePhoto), same prepareImageForUpload data-URL convention
// as every other photo in this app. Ownership is enforced server-side
// (the token always identifies the caller as themselves) — this modal
// has no way to target anyone else's profile even in principle.
export default function ChangePhotoModal({ open, onClose, onSaved }) {
  const [preview, setPreview] = useState(null); // data URL, staged but not yet saved
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setPreview(null);
    setBusy(false);
    setProgress(0);
    setSaving(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await prepareImageForUpload(file, { onProgress: setProgress });
      setPreview(url);
    } catch {
      setError("Could not process that photo. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await updateMyProfilePhoto(preview);
      onSaved(res.profilePictureUrl);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Change Photo">
      {preview ? (
        <div className="space-y-4">
          <div className="mx-auto h-40 w-40 rounded-2xl overflow-hidden ring-1 ring-white/10">
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          </div>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] disabled:opacity-50 transition-colors duration-200"
            >
              <RotateCcw size={14} /> Retake
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200 cursor-pointer">
              <Camera size={22} className="text-[#F47A20]" />
              <span className="text-xs font-medium text-white">Take Photo</span>
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                disabled={busy}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </label>
            <label className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200 cursor-pointer">
              <ImagePlus size={22} className="text-[#F47A20]" />
              <span className="text-xs font-medium text-white">Choose From Gallery</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </label>
          </div>
          {busy && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-[#9AA1B4]">
              <Loader2 size={12} className="animate-spin" /> Processing photo... {progress}%
            </p>
          )}
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl py-3 text-sm font-medium text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      )}
    </Modal>
  );
}
