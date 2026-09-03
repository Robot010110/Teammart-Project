import { Clock, Coffee, Zap } from "lucide-react";

// WorkTimeSummary.jsx — Total / Break / Net work time for today.
//
// All three are derived from today's real timestamps, using the same
// arithmetic the backend's own computeWorkingHours does (net = elapsed
// minus a COMPLETED break):
//
//   Total Work Time  checkIn -> checkOut, or checkIn -> now while still
//                    checked in (there is no backend field for an
//                    in-progress day — confirmed; HomeTab.jsx computes
//                    "hours today" the same way for the same reason).
//   Break Time       breakStart -> breakEnd, only once the break is
//                    finished. An in-progress break has no end yet, so
//                    it shows as running rather than a completed total.
//   Net Work Time    Total minus Break.
//
// Nothing is shown as a number until its inputs actually exist — a day
// with no check-in renders "--:--" everywhere rather than 0h 0m, which
// would read as "worked zero" instead of "hasn't started".

function hm(ms) {
  if (ms == null) return "--:--";
  const mins = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const TONES = {
  blue: { text: "text-sky-400", bg: "bg-sky-500/[0.12]", glow: "shadow-[0_0_14px_-2px_rgba(56,189,248,0.7)]" },
  violet: { text: "text-violet-400", bg: "bg-violet-500/[0.12]", glow: "shadow-[0_0_14px_-2px_rgba(167,139,250,0.7)]" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/[0.12]", glow: "shadow-[0_0_14px_-2px_rgba(52,211,153,0.7)]" },
};

export default function WorkTimeSummary({ record, now }) {
  const checkIn = record?.checkIn ? new Date(record.checkIn).getTime() : null;
  const checkOut = record?.checkOut ? new Date(record.checkOut).getTime() : null;
  const bStart = record?.breakStart ? new Date(record.breakStart).getTime() : null;
  const bEnd = record?.breakEnd ? new Date(record.breakEnd).getTime() : null;

  const totalMs = checkIn == null ? null : (checkOut ?? now) - checkIn;
  const breakMs = bStart != null && bEnd != null ? bEnd - bStart : null;
  const netMs = totalMs == null ? null : totalMs - (breakMs ?? 0);
  const breakRunning = bStart != null && bEnd == null;

  const items = [
    { key: "total", icon: Clock, label: "Total Work Time", value: hm(totalMs), tone: "blue" },
    {
      key: "break",
      icon: Coffee,
      label: "Break Time",
      value: breakRunning ? hm(now - bStart) : hm(breakMs),
      tone: "violet",
      note: breakRunning ? "running" : null,
    },
    { key: "net", icon: Zap, label: "Net Work Time", value: hm(netMs), tone: "emerald" },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-2.5">
      {items.map(({ key, icon: Icon, label, value, tone, note }, i) => {
        const t = TONES[tone];
        return (
          <div
            key={key}
            style={{ animationDelay: `${i * 60}ms` }}
            className="animate-fade-up flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 rounded-xl px-2.5 py-2.5 lg:px-3.5 lg:py-3 bg-[#12172A]/60 border border-white/[0.05]"
          >
            <span className={`w-8 h-8 lg:w-10 lg:h-10 shrink-0 rounded-full grid place-items-center ${t.bg} ${t.glow} ${t.text}`}>
              <Icon size={15} strokeWidth={2.1} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[14px] lg:text-[17px] font-bold text-white leading-none tabular-nums">
                {value}
                {note && <span className={`ml-1.5 text-[10px] font-medium ${t.text}`}>{note}</span>}
              </p>
              <p className="mt-1 text-[10px] lg:text-[11px] leading-tight text-[#8B93A8]">{label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
