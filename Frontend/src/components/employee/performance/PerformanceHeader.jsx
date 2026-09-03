import { useState } from "react";
import { ArrowLeft, Info, X } from "lucide-react";

// PerformanceHeader.jsx — the Performance page's own header, deliberately
// NOT the standard left-aligned AppShell top bar every other Employee
// screen uses. AppShell suppresses its own bar for this route (see its
// `selfHeaderedRoutes` prop) so there is exactly one logo on screen.
//
// Composition follows the reference exactly:
//   row 1   TM mark + TEAMMART wordmark, horizontal, centred
//   row 2   [back]        Performance        [info]
//   row 3   Your work, your progress.
//
// Back uses the caller's own onBack rather than a hardcoded route, so
// Performance returns wherever it was actually opened from. The info
// control is real — it explains how the score is computed, which is the
// one thing people reliably ask when shown a performance number.
export default function PerformanceHeader({ onBack }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <header className="pt-2">
      {/* Row 1 — centred brand lockup, horizontal like the reference. */}
      <div className="flex items-center justify-center gap-2.5">
        <div className="relative">
          <div className="absolute -inset-2 rounded-2xl bg-[#F47A20]/25 blur-lg" aria-hidden="true" />
          <div className="relative h-9 w-9 rounded-[11px] bg-gradient-to-br from-[#FF9A4D] to-[#E0561A] grid place-items-center shadow-[0_0_16px_2px_rgba(244,122,32,0.45)]">
            <span className="font-display font-extrabold text-white text-[15px] tracking-tight">TM</span>
          </div>
        </div>
        <p className="font-display font-extrabold text-[19px] tracking-[0.03em] leading-none">
          <span className="text-white">TEAM</span>
          <span className="text-[#F47A20]">MART</span>
        </p>
      </div>

      {/* Row 2 — title flanked by the two controls. */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="shrink-0 w-11 h-11 grid place-items-center rounded-2xl bg-white/[0.03] border border-white/[0.09] text-white hover:bg-white/[0.07] active:scale-95 transition-all duration-150"
        >
          <ArrowLeft size={19} />
        </button>

        <h1 className="font-display text-[30px] leading-none font-extrabold text-white text-center">Performance</h1>

        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-label={showInfo ? "Hide how this is calculated" : "How is this calculated?"}
          aria-expanded={showInfo}
          className={`shrink-0 w-11 h-11 grid place-items-center rounded-full border active:scale-95 transition-all duration-150 ${
            showInfo
              ? "text-sky-300 bg-sky-500/10 border-sky-400/40 shadow-[0_0_14px_1px_rgba(56,189,248,0.3)]"
              : "text-white bg-white/[0.03] border-white/[0.09] hover:bg-white/[0.07]"
          }`}
        >
          {showInfo ? <X size={18} /> : <Info size={18} />}
        </button>
      </div>

      <p className="mt-2 text-center text-[13.5px] text-[#8B93A8]">Your work, your progress.</p>

      {showInfo && (
        <div className="mt-4 rounded-2xl p-4 bg-sky-500/[0.06] border border-sky-500/20 animate-fade-in">
          <p className="text-[13px] leading-relaxed text-[#C3C9D8]">
            Your score is the share of your reviewed activities that were approved — approved ÷ (approved + rejected).
            Drafts and activities still awaiting review are not counted either way, so the number only moves once a
            supervisor has actually decided on your work.
          </p>
        </div>
      )}
    </header>
  );
}
