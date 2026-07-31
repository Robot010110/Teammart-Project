import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { startScanning, stopScanning } from "../../../utils/barcodeScanner";

// BarcodeScanStep.jsx — owns the camera lifecycle (start on mount, stop
// on unmount/back) entirely locally, so the orchestrator (ItemReportFlow)
// doesn't need to know anything about @zxing/browser or video elements —
// it just gets an onDetected(barcode) callback once a code is found (or
// the manual-entry fallback is used).

export default function BarcodeScanStep({ onDetected, onBack }) {
  const videoRef = useRef(null);
  const [scanError, setScanError] = useState(null);
  const [manualBarcode, setManualBarcode] = useState("");

  useEffect(() => {
    setScanError(null);
    startScanning(videoRef.current, (text) => {
      stopScanning();
      onDetected(text);
    }).catch(() => {
      setScanError("Could not access the camera. Enter the barcode manually below instead.");
    });
    return () => stopScanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = () => {
    if (!manualBarcode.trim()) return;
    onDetected(manualBarcode.trim());
  };

  return (
    <div className="space-y-3">
      {/* Taller than a 16:9 aspect-video box — most phones hold the
          camera in portrait, so a taller frame gives a bigger, more
          natural scan target instead of a cramped landscape strip. */}
      <div className="rounded-xl overflow-hidden bg-black h-72 sm:h-80">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      </div>
      {scanError && (
        <div className="space-y-2">
          <p className="text-xs text-red-400">{scanError}</p>
          <div className="flex gap-2">
            <input
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="Enter barcode number"
              inputMode="numeric"
              className="flex-1 min-w-0 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
            />
            <button
              onClick={handleManualSubmit}
              className="shrink-0 rounded-lg px-4 py-3 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18]"
            >
              Search
            </button>
          </div>
        </div>
      )}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 py-2 text-xs text-[#9AA1B4] hover:text-white"
      >
        <ArrowLeft size={12} /> Back
      </button>
    </div>
  );
}
