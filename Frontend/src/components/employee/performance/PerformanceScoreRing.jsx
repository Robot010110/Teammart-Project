import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { bandForScore } from "./scoreColorBands";

// PerformanceScoreRing.jsx — the page's visual centrepiece.
//
// Distinct from the existing PerformanceCircle.jsx, which stays exactly
// as it is — that one is a small tap-through tile used on Home and in
// Profile, tone-coloured by band and sized ~88px. This is the Performance
// page's hero treatment, and it is a different object: a much larger
// ring, a multi-stop gradient rather than a flat tone colour, and three
// stacked glow layers rather than a single box-shadow.
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
//
// `label` is the caption under the number. It defaults to "Overall
// Score" so the Employee Performance page this was built for is
// completely unchanged; the Regional Manager's Zone Performance card
// reuses this exact ring with its own caption rather than cloning the
// four-layer glow build below into a second component.
//
// --- Score-band color mode (opt-in, `useScoreBandColor`) ---------------
//
// The RM Zone Performance card (a different metric entirely — see
// scoreColorBands.js's own comment) and any other existing caller keep
// the original flat orange gradient and simple fade-in by default:
// nothing about them changes. Only the Employee Performance page passes
// `useScoreBandColor`, which switches the gradient to the score's color
// band (scoreColorBands.js) and switches the reveal from a plain fade to
// the "arriving at its position" travel-and-settle animation below.
//
// `animateKey` — pass something that changes whenever the caller wants a
// fresh travel animation even if the score happens to be identical (e.g.
// the selected period's own key). Defaults to `rate` itself, which is
// enough on its own for the common case (a different period almost always
// has a different score).
export default function PerformanceScoreRing({ rate, size = 188, label, useScoreBandColor = false, animateKey }) {
  const { t } = useTranslation();
  // Default resolved in the body, not the parameter list: `t`
  // only exists once the component is running.
  label = label ?? t("emp.overallScore");
  const uid = useId();
  const stroke = Math.round(size * 0.055);
  const radius = (size - stroke) / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // --- legacy path: unchanged from before this redesign ----------------
  const [legacyFilled, setLegacyFilled] = useState(false);
  useEffect(() => {
    if (useScoreBandColor) return; // the new path owns its own reveal below
    if (reduceMotion) {
      setLegacyFilled(true);
      return;
    }
    const raf = requestAnimationFrame(() => setLegacyFilled(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useScoreBandColor]);

  // --- new path: banded color + "arriving at its position" reveal ------
  //
  // A hand-rolled rAF tween rather than a CSS transition, because a CSS
  // transition can only ever move monotonically toward its target — it
  // cannot overshoot and settle back, which is the entire visual idea
  // requested ("a gauge needle arriving at its destination"). The target
  // score itself is never touched by this: `rate` stays the real number
  // throughout, only a local `displayPct` state animates toward it.
  const [displayPct, setDisplayPct] = useState(0);
  const rafRef = useRef(null);
  const animKey = animateKey ?? rate;

  useEffect(() => {
    if (!useScoreBandColor) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const target = rate == null ? 0 : Math.max(0, Math.min(100, rate));

    if (reduceMotion) {
      setDisplayPct(target);
      return;
    }

    // Two phases: a fast rise that slightly overshoots the real value,
    // then a short settle back onto it. Overshoot is capped so it can
    // never visually imply a score above 100.
    const RISE_MS = 850;
    const SETTLE_MS = 380;
    const OVERSHOOT = Math.min(target + 6, 100) - target;
    const peak = target + OVERSHOOT;

    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
    const easeInOutQuad = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

    setDisplayPct(0);
    let start = null;

    const tick = (timestamp) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;

      if (elapsed < RISE_MS) {
        const t2 = easeOutCubic(elapsed / RISE_MS);
        setDisplayPct(t2 * peak);
        rafRef.current = requestAnimationFrame(tick);
      } else if (elapsed < RISE_MS + SETTLE_MS) {
        const t2 = easeInOutQuad((elapsed - RISE_MS) / SETTLE_MS);
        setDisplayPct(peak + (target - peak) * t2);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayPct(target);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useScoreBandColor, animKey, reduceMotion]);

  // The color band is resolved from the FINAL target score only, never
  // from the mid-flight displayPct — the ring must show exactly one
  // color per spec ("do not show multiple score-range colors
  // simultaneously"), not sweep through every band it passes on the way.
  const band = useScoreBandColor ? bandForScore(rate) : null;

  const pct = useScoreBandColor ? displayPct : legacyFilled && rate != null ? Math.max(0, Math.min(100, rate)) : 0;
  const offset = circumference * (1 - pct / 100);
  const transition = useScoreBandColor
    ? "none" // the rAF tween above already drives every frame
    : "stroke-dashoffset 1.5s cubic-bezier(0.22, 1, 0.36, 1)";

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

  const gradientStops = useScoreBandColor && band ? band.stops : ["#FFC26A", "#FF9330", "#F05A0F"];
  const glowRgb = useScoreBandColor && band ? band.glowRgb : "244,122,32";
  // Gold gets a visibly stronger glow than the other bands — the "premium
  // shimmer" called for specifically at the top of the scale.
  const glowStrength = useScoreBandColor && band?.key === "gold" ? 0.32 : 0.2;
  const showArc = useScoreBandColor ? rate != null : rate != null;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={rate == null ? t("emp.overallScoreNoDataYet") : `Overall score: ${Math.round(rate)} out of 100`}
    >
      {/* Ambient light spill onto the card surface behind the ring. */}
      <div
        className="absolute inset-0 rounded-full animate-glow-pulse"
        style={{ background: `radial-gradient(circle, rgba(${glowRgb},${glowStrength}) 0%, rgba(${glowRgb},${glowStrength * 0.3}) 45%, transparent 70%)` }}
        aria-hidden="true"
      />

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90 overflow-visible">
        <defs>
          <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientStops[0]} />
            <stop offset="40%" stopColor={gradientStops[1]} />
            <stop offset="100%" stopColor={gradientStops[2]} />
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

        {showArc && (
          <>
            {/* 1 — outer bloom */}
            <circle {...arcProps} strokeWidth={stroke} filter={`url(#${uid}-bloom)`} opacity="0.75" style={{ transition }} />
            {/* 2 — hot edge */}
            <circle {...arcProps} strokeWidth={stroke} filter={`url(#${uid}-edge)`} opacity="0.9" style={{ transition }} />
            {/* 3 — the crisp ring */}
            <circle {...arcProps} strokeWidth={stroke} style={{ transition }} />
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
          {/* No "%" — this is a score out of 100, not a percentage. The
              ring predates the scoring engine and used to show an
              approved/reviewed RATE, which genuinely was a percentage. */}
          {rate == null ? "—" : Math.round(rate)}
        </span>
        <span className="mt-1 text-[11.5px] leading-tight text-center text-[#9AA1B4] whitespace-pre-line">{label}</span>
      </div>
    </div>
  );
}
