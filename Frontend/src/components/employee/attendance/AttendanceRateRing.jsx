import { useEffect, useId, useState } from "react";

// AttendanceRateRing.jsx — the animated Attendance Rate ring.
//
// `rate` is the real summary.attendanceRate from
// GET /api/attendance/month (present days / working days, computed
// server-side in computeMonthSummary) — or null when the month has no
// working days to measure yet, which renders an em dash rather than a
// fabricated 0%.
//
// The ring is built the same way as the Performance page's hero ring so
// the two read as one system: a wide blurred copy of the arc for the
// bloom, a tighter one for the hot edge, then the crisp gradient stroke,
// over a radial light-spill halo. Fills from 0 on mount, and skips
// straight to the value under prefers-reduced-motion.
//
// Gradient tone follows the same severity convention the rest of the app
// already uses for this metric (see AttendanceSummaryCards.rateTone):
// >=98 excellent, >=95 acceptable, below that flagged.
function toneFor(rate) {
  if (rate == null) return { from: "#5C6479", mid: "#4C5266", to: "#3A4055", glow: "rgba(140,150,170,0.25)" };
  if (rate >= 98) return { from: "#6EE7B7", mid: "#34D399", to: "#059669", glow: "rgba(52,211,153,0.35)" };
  if (rate >= 95) return { from: "#FFC26A", mid: "#F9A03C", to: "#E0561A", glow: "rgba(244,122,32,0.35)" };
  return { from: "#FFB067", mid: "#FF7A5C", to: "#EF4444", glow: "rgba(255,92,92,0.35)" };
}

export default function AttendanceRateRing({ rate, size = 150, label = "This Month" }) {
  const uid = useId();
  const stroke = Math.round(size * 0.075);
  const radius = (size - stroke) / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const tone = toneFor(rate);

  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFilled(true);
      return;
    }
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const offset = filled ? circumference * (1 - pct / 100) : circumference;
  const ease = "stroke-dashoffset 1.5s cubic-bezier(0.22, 1, 0.36, 1)";

  const arc = {
    cx: size / 2,
    cy: size / 2,
    r: radius,
    fill: "none",
    strokeLinecap: "round",
    strokeDasharray: circumference,
    strokeDashoffset: offset,
    stroke: `url(#${uid}-g)`,
    strokeWidth: stroke,
  };

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={rate == null ? "Attendance rate: no data yet" : `Attendance rate ${rate.toFixed(1)} percent, ${label}`}
    >
      <div
        className="absolute inset-0 rounded-full animate-glow-pulse"
        style={{ background: `radial-gradient(circle, ${tone.glow} 0%, transparent 68%)` }}
        aria-hidden="true"
      />

      {/* Decorative mesh behind the ring — the reference's faint wave
          texture inside this card. */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.16]" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M2 72 C 18 60, 30 84, 48 70 S 80 52, 98 64" fill="none" stroke={tone.mid} strokeWidth="0.6" />
        <path d="M2 80 C 20 68, 32 92, 52 78 S 82 60, 98 72" fill="none" stroke={tone.mid} strokeWidth="0.5" opacity="0.7" />
      </svg>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90 overflow-visible">
        <defs>
          <linearGradient id={`${uid}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tone.from} />
            <stop offset="55%" stopColor={tone.mid} />
            <stop offset="100%" stopColor={tone.to} />
          </linearGradient>
          <filter id={`${uid}-bloom`} x="-75%" y="-75%" width="250%" height="250%">
            <feGaussianBlur stdDeviation={stroke * 1.1} />
          </filter>
          <filter id={`${uid}-edge`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={stroke * 0.38} />
          </filter>
        </defs>

        {/* Track. Deliberately more visible than a hairline: at a real
            0% there is no arc to draw at all, and an invisible track
            would make the card look broken rather than showing an
            honest zero. */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />

        {rate != null && (
          <>
            <circle {...arc} filter={`url(#${uid}-bloom)`} opacity="0.75" style={{ transition: ease }} />
            <circle {...arc} filter={`url(#${uid}-edge)`} opacity="0.9" style={{ transition: ease }} />
            <circle {...arc} style={{ transition: ease }} />
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span
          className={`font-display font-extrabold tabular-nums ${rate == null ? "text-[#4C5266]" : "text-white"}`}
          style={{
            fontSize: rate == null ? size * 0.16 : size * 0.2,
            lineHeight: 1,
            textShadow: rate == null ? "none" : "0 0 22px rgba(255,255,255,0.22)",
          }}
        >
          {rate == null ? "—" : `${rate.toFixed(1)}%`}
        </span>
        <span className="mt-1 text-[11px] text-[#8B93A8]">{label}</span>
      </div>
    </div>
  );
}
