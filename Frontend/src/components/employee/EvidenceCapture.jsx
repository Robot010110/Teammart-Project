import { useState } from "react";
import { Camera, Upload, RotateCcw, Loader2 } from "lucide-react";
import { prepareImageForUpload } from "../../services/activityService";
import AuthenticatedImage from "../common/AuthenticatedImage";

// EvidenceCapture.jsx — Take Photo / Upload Photo -> preview -> Retake /
// keep. Shared by anything that needs a single evidence photo (Sudden
// Task completion today; the same shape as ItemReportFlow's photo step,
// pulled out standalone since here the preview+Retake step happens
// before submission rather than flowing straight through).
export default function EvidenceCapture({ photo, onPhotoChange }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const url = await prepareImageForUpload(file, { onProgress: setProgress });
      onPhotoChange(url);
    } catch {
      setError("Could not process that photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (photo) {
    return (
      <div className="rounded-xl overflow-hidden border border-white/[0.06]">
        <AuthenticatedImage src={photo} alt="Evidence" className="w-full max-h-64 object-cover" />
        <button
          type="button"
          onClick={() => onPhotoChange(null)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-[#9AA1B4] bg-[#1A1F33] hover:bg-[#1F2436] transition-colors"
        >
          <RotateCcw size={13} /> Retake
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200 cursor-pointer">
          <Camera size={20} className="text-[#F47A20]" />
          <span className="text-xs font-medium text-white">Take Photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </label>
        <label className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200 cursor-pointer">
          <Upload size={20} className="text-[#F47A20]" />
          <span className="text-xs font-medium text-white">Upload Photo</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </label>
      </div>
      {busy && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[#9AA1B4]">
          <Loader2 size={12} className="animate-spin" /> Processing photo... {progress}%
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
