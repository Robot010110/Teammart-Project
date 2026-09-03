import { LogIn, LogOut } from "lucide-react";

// ShiftProgressBar.jsx — the desktop reference's check-in -> check-out
// progress rail. Desktop-only (lg:) by design: on a phone the same
// information is already carried by the status hero and the timeline,
// and a wide rail there would just add height without adding meaning.
//
// Progress is real elapsed time against the day's OWN requiredHours
// (AttendanceRecord.requiredHours — the per-day value the backend
// stores and staff can adjust), not a hardcoded 8. Nothing is drawn at
// all until there is a real check-in.
export default function ShiftProgressBar({ record, now }) {
  const checkIn = record?.checkIn ? new Date(record.checkIn).getTime() : null;
  if (checkIn == null) return null;

  const checkOut = record?.checkOut ? new Date(record.checkOut).getTime() : null;
  const requiredH = record.requiredHours ?? 8;
  const elapsedMs = (checkOut ?? now) - checkIn;
  const pct = Math.max(0, Math.min(100, (elapsedMs / (requiredH * 3600000)) * 100));
  const done = checkOut != null;

  const timeLabel = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <section className="hidden lg:block rounded-[20px] p-4 bg-[#0D1223]/80 border border-white/[0.06]">
      <div className="flex items-center gap-4">
        <div className="shrink-0 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 bg-emerald-500/[0.08] border border-emerald-500/25">
          <span className="w-9 h-9 rounded-lg grid place-items-center bg-emerald-500/[0.14] text-emerald-400 shadow-[0_0_14px_-2px_rgba(52,211,153,0.7)]">
            <LogIn size={15} strokeWidth={2.1} />
          </span>
          <div>
            <p className="text-[12.5px] font-semibold text-emerald-400 leading-none">Check In</p>
            <p className="mt-1 text-[11.5px] text-[#9AA1B4] tabular-nums">{timeLabel(checkIn)}</p>
          </div>
        </div>

        <div className="relative flex-1 h-[2px] rounded-full bg-white/[0.08]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-[#F47A20] transition-[width] duration-1000 ease-out"
            style={{ width: `${pct}%`, boxShadow: "0 0 10px 1px rgba(244,122,32,0.55)" }}
          />
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-[#F47A20] transition-[left] duration-1000 ease-out"
            style={{ left: `${pct}%`, boxShadow: "0 0 10px 2px rgba(244,122,32,0.8)" }}
            aria-hidden="true"
          />
        </div>

        <div
          className={`shrink-0 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border ${
            done ? "bg-red-500/[0.08] border-red-500/25" : "bg-[#F47A20]/[0.06] border-[#F47A20]/25 border-dashed"
          }`}
        >
          <span
            className={`w-9 h-9 rounded-lg grid place-items-center ${
              done
                ? "bg-red-500/[0.14] text-[#FF5C5C] shadow-[0_0_14px_-2px_rgba(255,92,92,0.7)]"
                : "bg-[#F47A20]/[0.12] text-[#F9A03C]"
            }`}
          >
            <LogOut size={15} strokeWidth={2.1} />
          </span>
          <div>
            <p className={`text-[12.5px] font-semibold leading-none ${done ? "text-[#FF5C5C]" : "text-[#F9A03C]"}`}>
              Check Out
            </p>
            <p className="mt-1 text-[11.5px] text-[#9AA1B4] tabular-nums">
              {done ? timeLabel(checkOut) : `${requiredH}h required`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
