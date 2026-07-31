import { useState } from "react";
import { Camera, ZoomIn } from "lucide-react";
import Modal from "./Modal";

// PhotoEvidence.jsx — "Before / After" image placeholders (no real uploads
// yet — backend not required per spec). Clicking a thumbnail opens it in a
// simple modal viewer.

function Thumb({ label, onOpen }) {
  return (
    <button
      onClick={onOpen}
      aria-label={`View ${label} photo`}
      className="group relative flex-1 aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-[#2A3050] to-[#181C2C] border border-white/[0.06] grid place-items-center"
    >
      <Camera size={18} className="text-[#4C5266] group-hover:text-[#F47A20] transition-colors duration-200" />
      <span className="absolute bottom-1.5 left-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8] bg-black/40 rounded px-1.5 py-0.5">
        {label}
      </span>
      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 grid place-items-center opacity-0 group-hover:opacity-100">
        <ZoomIn size={16} className="text-white" />
      </span>
    </button>
  );
}

export default function PhotoEvidence({ compact = false, retentionLabel }) {
  const [openLabel, setOpenLabel] = useState(null);

  return (
    <>
      <div className={`flex gap-2 ${compact ? "mt-2" : "mt-3"}`}>
        <Thumb label="Before" onOpen={() => setOpenLabel("Before")} />
        <Thumb label="After" onOpen={() => setOpenLabel("After")} />
      </div>
      {retentionLabel && (
        <p className="mt-1.5 text-[10px] text-[#4C5266]">{retentionLabel}</p>
      )}

      <Modal open={!!openLabel} onClose={() => setOpenLabel(null)} title={`Photo — ${openLabel}`}>
        <div className="aspect-video rounded-xl bg-gradient-to-br from-[#2A3050] to-[#181C2C] border border-white/[0.06] grid place-items-center">
          <div className="text-center">
            <Camera size={28} className="mx-auto text-[#4C5266]" />
            <p className="mt-2 text-xs text-[#8B93A8]">
              Image placeholder — connect uploads to display the real photo here.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
