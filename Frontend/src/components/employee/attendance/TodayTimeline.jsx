import { LogIn, Coffee, LogOut, Check } from "lucide-react";

// TodayTimeline.jsx — today's four real attendance events, in order:
// Checked In, Break Started, Break Ended, Checked Out.
//
// Sourced entirely from GET /api/attendance/today's own
// checkIn/breakStart/breakEnd/checkOut. An event that has not happened
// yet renders its real empty placeholder ("--:--") in a dimmed row —
// never a fabricated time and never hidden, so the shape of the day is
// always legible.
//
// The "On Time" / "Late" note on check-in is not invented either: it
// reflects the record's own AttendanceStatus (LATE is a real enum value
// the backend sets), and is omitted entirely when there's no record.

const timeLabel = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "--:--";

function duration(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const mins = Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

const TONES = {
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/[0.12]", glow: "shadow-[0_0_14px_-2px_rgba(52,211,153,0.7)]", line: "bg-emerald-400/40" },
  violet: { text: "text-violet-400", bg: "bg-violet-500/[0.12]", glow: "shadow-[0_0_14px_-2px_rgba(167,139,250,0.7)]", line: "bg-violet-400/40" },
  red: { text: "text-[#FF5C5C]", bg: "bg-red-500/[0.12]", glow: "shadow-[0_0_14px_-2px_rgba(255,92,92,0.7)]", line: "bg-red-400/40" },
  idle: { text: "text-[#4C5266]", bg: "bg-white/[0.04]", glow: "", line: "bg-white/[0.07]" },
};

export default function TodayTimeline({ record }) {
  const events = [
    {
      key: "in",
      icon: LogIn,
      label: "Checked In",
      time: record?.checkIn,
      tone: "emerald",
      note: record?.checkIn ? (record.status === "LATE" ? "Late" : "On Time") : null,
      noteTone: record?.status === "LATE" ? "text-[#F9A03C] bg-[#F47A20]/[0.12]" : "text-emerald-400 bg-emerald-500/[0.12]",
    },
    {
      key: "bs",
      icon: Coffee,
      label: "Break Started",
      time: record?.breakStart,
      tone: "violet",
      note: duration(record?.breakStart, record?.breakEnd),
      noteTone: "text-violet-400 bg-violet-500/[0.12]",
    },
    {
      key: "be",
      icon: Check,
      label: "Break Ended",
      time: record?.breakEnd,
      tone: "violet",
      note: duration(record?.breakStart, record?.breakEnd),
      noteTone: "text-violet-400 bg-violet-500/[0.12]",
    },
    {
      key: "out",
      icon: LogOut,
      label: "Checked Out",
      time: record?.checkOut,
      tone: "red",
      note: null,
    },
  ];

  return (
    <div className="space-y-1.5">
      {events.map((e, i) => {
        const done = !!e.time;
        const t = TONES[done ? e.tone : "idle"];
        const isLast = i === events.length - 1;

        return (
          <div
            key={e.key}
            className="animate-fade-up relative flex items-center gap-3 rounded-xl px-3 py-2.5 bg-[#12172A]/60 border border-white/[0.05]"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="relative shrink-0">
              <span className={`w-9 h-9 rounded-lg grid place-items-center ${t.bg} ${t.glow} ${t.text}`}>
                <e.icon size={15} strokeWidth={2.1} />
              </span>
              {/* Connector into the next event — the timeline's spine. */}
              {!isLast && (
                <span
                  className={`absolute left-1/2 -translate-x-1/2 top-full h-[10px] w-[2px] ${t.line}`}
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-semibold ${done ? "text-white" : "text-[#5C6479]"}`}>{e.label}</p>
              <p className={`text-[11.5px] tabular-nums ${done ? "text-[#9AA1B4]" : "text-[#3C4256]"}`}>
                {timeLabel(e.time)}
              </p>
            </div>

            {done && e.note && (
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${e.noteTone}`}>
                {e.note}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
