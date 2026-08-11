const SIZE = 88;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function toneColor(rate) {
  if (rate == null) return "#4C5266";
  if (rate >= 90) return "#34d399"; // emerald-400
  if (rate >= 75) return "#fbbf24"; // amber-400
  return "#f87171"; // red-400
}

// PerformanceCircle.jsx — a real circular performance indicator (spec:
// tap-through to Performance History). `rate` is 0-100 or null (no
// reviewed activity data yet — shown as a neutral empty ring + "No data
// yet" rather than a fabricated number).
export default function PerformanceCircle({ rate, onClick }) {
  const pct = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const offset = CIRCUMFERENCE * (1 - pct / 100);
  const color = toneColor(rate);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 flex flex-col items-center gap-2 rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl active:bg-[#1A1F33] transition-colors"
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
          {rate != null && (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{rate == null ? "—" : `${Math.round(rate)}%`}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-[#9AA1B4]">Performance</span>
    </button>
  );
}
