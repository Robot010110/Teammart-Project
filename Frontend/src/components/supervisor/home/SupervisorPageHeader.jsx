import { ArrowLeft } from "lucide-react";

// SupervisorPageHeader.jsx — the shared header for the four dedicated
// pages Today Overview's cards open (Alerts, Recent Activity, Pending
// Tasks, Team Attendance). Deliberately simple/consistent rather than
// each page inventing its own — the visual system is already carrying
// enough weight in the hero card.
export default function SupervisorPageHeader({ title, subtitle, onBack }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="shrink-0 w-10 h-10 grid place-items-center rounded-xl text-[#9AA1B4] hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all"
      >
        <ArrowLeft size={19} />
      </button>
      <div className="min-w-0">
        <h1 className="font-display text-lg font-bold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-[#8B93A8] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
