import { useState } from "react";
import { Camera, Upload, X, Loader2, CheckCircle2 } from "lucide-react";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { prepareImageForUpload, addActivityImage, deleteActivityImage } from "../../services/nightShiftService";
import { ApiError } from "../../services/apiClient";

// MultiPhotoEvidence.jsx — the Washing Market (and any future
// multi-photo Night Shift task) evidence step: take/upload any number of
// photos, preview each as a grid, remove any of them, see a live
// "X/minRequired" count. Every add/remove round-trips through the real
// backend immediately (POST/DELETE /api/activities/:id/images) rather
// than staging photos locally and uploading on submit — this is the same
// "upload now, submit later" shape ItemReportFlow/InventoryCountingFlow
// already use, just extended to more than one photo. The live count
// shown here is always `images.length` from what the server actually has
// — never a client-side guess — because the backend independently
// recounts on submit and must never disagree with what the UI showed
// (spec §13).
export default function MultiPhotoEvidence({ activityId, images, minRequired, editable, onImagesChanged }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const url = await prepareImageForUpload(file, { onProgress: setProgress });
      const image = await addActivityImage(activityId, url);
      onImagesChanged([...images, image]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that photo. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(imageId) {
    setRemovingId(imageId);
    setError(null);
    try {
      await deleteActivityImage(activityId, imageId);
      onImagesChanged(images.filter((img) => img.id !== imageId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that photo.");
    } finally {
      setRemovingId(null);
    }
  }

  const count = images.length;
  const met = count >= minRequired;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">Evidence Photos</p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            met ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {met && <CheckCircle2 size={12} />}
          {count}/{minRequired}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {images.map((img) => (
          <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-white/[0.06]">
            <AuthenticatedImage src={img.url} alt="Evidence" className="w-full h-full object-cover" />
            {editable && (
              <button
                type="button"
                onClick={() => handleRemove(img.id)}
                disabled={removingId === img.id}
                aria-label="Remove photo"
                className="absolute top-1 right-1 grid place-items-center h-6 w-6 rounded-full bg-black/70 text-white hover:bg-red-500/80 transition-colors disabled:opacity-50"
              >
                {removingId === img.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
              </button>
            )}
          </div>
        ))}

        {editable && (
          <>
            <label
              className={`aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] hover:border-[#F47A20]/40 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                uploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <Camera size={17} className="text-[#F47A20]" />
              <span className="text-[10px] font-medium text-[#9AA1B4]">Take Photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </label>
            <label
              className={`aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] hover:border-[#F47A20]/40 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                uploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <Upload size={17} className="text-[#F47A20]" />
              <span className="text-[10px] font-medium text-[#9AA1B4]">Upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </label>
          </>
        )}
      </div>

      {uploading && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[#9AA1B4]">
          <Loader2 size={12} className="animate-spin" /> Uploading photo... {progress}%
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {!met && !uploading && (
        <p className="mt-3 text-xs text-[#8B93A8]">{minRequired - count} more photo{minRequired - count === 1 ? "" : "s"} required.</p>
      )}
    </div>
  );
}
