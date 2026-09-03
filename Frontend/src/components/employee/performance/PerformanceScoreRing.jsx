import { useEffect, useId, useState } from "react";

// PerformanceScoreRing.jsx — the page's visual centrepiece.
//
// Distinct from the existing PerformanceCircle.jsx, which stays exactly
// as it is — that one is a small tap-through tile used on Home and in
// Profile, tone-coloured by band and sized ~88px. This is the Performance
// page's hero treatment, and it is a different object: a much larger
// ring, a multi-stop orange gradient rather than a flat tone colour, and
// three stacked glow layers rather than a single box-shadow.
//
// How the neon is actually built (the reference's ring is luminous, not
// merely bright-coloured):
//   1. a wide, heavily-blurred copy of the progress arc  — the outer bloom
//   2. a tighter, lightly-blurred copy                   — the hot edge
//   3. the crisp gradient arc itself                     — the ring
//   4. a radial-gradient halo behind the whole SVG       — light spill
// Layers 1-2 use feGaussianBlur on the same path, so the glow always
// traces the real arc and ends exactly where the value ends.
//
// `rate` is 0-100 or null. Null renders an empty track and an em dash —
// never a fabricated percentage.
export default function PerformanceScoreRing({ rate, size = 188 }) {
  const uid = useId();
  const stroke = Math.round(size * 0.055);
  const radius = (size - stroke) / 2 - 6;
  const circumference = 2 * Math.PI * radius;

  // One-frame delay so the browser paints the ring empty first and then
  // transitions to the real value. prefers-reduced-motion skips straight
  // to the final offset instead of transitioning to it.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setFilled(true);
      return;
    }
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const offset = filled ? circumference * (1 - pct / 100) : circumference;
  const ease = "stroke-dashoffset 1.5s cubic-bezier(0.22, 1, 0.36, 1)";

  const arcProps = {
    cx: size / 2,
    cy: size / 2,
    r: radius,
    fill: "none",
    strokeLinecap: "round",
    strokeDasharray: circumference,
    strokeDashoffset: offset,
    stroke: `url(#${uid}-grad)`,
  };

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={rate == null ? "Overall score: no data yet" : `Overall score: ${Math.round(rate)} percent`}
    >
      {/* Ambient light spill onto the card surface behind the ring. */}
      <div
        className="absolute inset-0 rounded-full animate-glow-pulse"
        style={{ background: "radial-gradient(circle, rgba(244,122,32,0.20) 0%, rgba(244,122,32,0.06) 45%, transparent 70%)" }}
        aria-hidden="true"
      />

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90 overflow-visible">
        <defs>
          <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFC26A" />
            <stop offset="40%" stopColor="#FF9330" />
            <stop offset="100%" stopColor="#F05A0F" />
          </linearGradient>
          <filter id={`${uid}-bloom`} x="-75%" y="-75%" width="250%" height="250%">
            <feGaussianBlur stdDeviation={stroke * 1.15} />
          </filter>
          <filter id={`${uid}-edge`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={stroke * 0.4} />
          </filter>
        </defs>

        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />

        {rate != null && (
          <>
            {/* 1 — outer bloom */}
            <circle {...arcProps} strokeWidth={stroke} filter={`url(#${uid}-bloom)`} opacity="0.75" style={{ transition: ease }} />
            {/* 2 — hot edge */}
            <circle {...arcProps} strokeWidth={stroke} filter={`url(#${uid}-edge)`} opacity="0.9" style={{ transition: ease }} />
            {/* 3 — the crisp ring */}
            <circle {...arcProps} strokeWidth={stroke} style={{ transition: ease }} />
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span
          className={`font-display font-extrabold tabular-nums ${rate == null ? "text-[#4C5266]" : "text-white"}`}
          style={{
            // The em dash is rendered smaller than a real value — at the
            // percentage's own size it reads as a solid white bar rather
            // than "no data".
            fontSize: rate == null ? size * 0.16 : size * 0.235,
            lineHeight: 1,
            textShadow: rate == null ? "none" : "0 0 24px rgba(255,255,255,0.25)",
          }}
        >
          {rate == null ? "—" : `${Math.round(rate)}%`}
        </span>
        <span className="mt-1 text-[11.5px] text-[#9AA1B4]">Overall Score</span>
      </div>
    </div>
  );
}
