import { useEffect, useState } from "react";

function toneColor(rate) {
  if (rate == null) return "#4C5266";
  if (rate >= 90) return "#34d399"; // emerald-400
  if (rate >= 75) return "#fbbf24"; // amber-400
  return "#f87171"; // red-400
}

function toneMessage(rate) {
  if (rate == null) return "No data yet";
  if (rate >= 90) return "Great job!";
  if (rate >= 75) return "Good work";
  return "Keep going";
}

// PerformanceCircle.jsx — a real circular performance indicator (spec:
// tap-through to Performance History). `rate` is 0-100 or null (no
// reviewed activity data yet — shown as a neutral empty ring + "No data
// yet" rather than a fabricated number).
//
// `bare` skips the outer card/button chrome so a caller (HomeTab's own
// "Today's Performance" hero card) can lay the ring out next to other
// content instead of it always being its own standalone tile — the
// default (unset) keeps every existing caller's look exactly as before.
// `size` lets that same hero usage render a larger ring without a second
// component. The ring fills in from 0 on mount (not just on `rate`
// changing later) via a one-frame-delayed state flip, reusing the
// stroke-dashoffset transition that was already here — genuinely
// smoother, not a new mechanism. A soft tone-colored glow sits behind
// the ring (`.animate-glow-pulse`, defined in index.css, already
// disabled under prefers-reduced-motion same as every other animation
// class in this app).
export default function PerformanceCircle({ rate, onClick, bare = false, size = 88 }) {
  const stroke = Math.max(6, Math.round(size * 0.08));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const offset = filled ? circumference * (1 - pct / 100) : circumference;
  const color = toneColor(rate);

  const ring = (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full animate-glow-pulse"
        style={{ boxShadow: `0 0 ${Math.round(size * 0.35)}px ${Math.round(size * 0.08)}px ${color}33` }}
        aria-hidden="true"
      />
      <svg width={size} height={size} className="-rotate-90 relative">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {rate != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-white" style={{ fontSize: size * 0.24 }}>{rate == null ? "—" : `${Math.round(rate)}%`}</span>
        {bare && <span className="text-[11px] text-[#9AA1B4] mt-0.5">{toneMessage(rate)}</span>}
      </div>
    </div>
  );

  if (bare) {
    return (
      <button type="button" onClick={onClick} aria-label="View performance history">
        {ring}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 flex flex-col items-center gap-2 rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl active:bg-[#1A1F33] transition-colors"
    >
      {ring}
      <span className="text-xs font-medium text-[#9AA1B4]">Performance</span>
    </button>
  );
}
