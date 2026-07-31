import { ScanBarcode, Camera } from "lucide-react";

// ChooseMethodStep.jsx — first step of ItemReportFlow: barcode scan vs.
// photo capture. Split out of the single ItemReportFlow.jsx file (was
// 360 lines handling all 4 steps) purely for maintainability — no
// behavior change from before.

export default function ChooseMethodStep({ onScanBarcode, onTakePicture, busy, progress, error }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onScanBarcode}
          className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200"
        >
          <ScanBarcode size={22} className="text-[#F47A20]" />
          <span className="text-xs font-medium text-white">Scan Barcode</span>
        </button>
        <label className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200 cursor-pointer">
          <Camera size={22} className="text-[#F47A20]" />
          <span className="text-xs font-medium text-white">Take Picture</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onTakePicture(e.target.files[0])}
          />
        </label>
      </div>

      {error && <p className="mt-4 text-xs text-red-400">{error}</p>}
      {busy && (
        <p className="mt-4 text-xs text-[#9AA1B4]">Processing photo... {progress ?? 0}%</p>
      )}
    </div>
  );
}
