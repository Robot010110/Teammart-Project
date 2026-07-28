import { CalendarDays, ClipboardList } from "lucide-react";

// ActivityCalendar.jsx — full month grid. Green = activity completed,
// gray = no activity, blue ring = today, orange dot = monthly "Counting
// Items" day. Clicking a day notifies the parent (opens the side panel).

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function ActivityCalendar({ calendar, selectedDay, onSelectDay }) {
  const firstWeekday = new Date(calendar.year, calendar.month, 1).getDay();
  const monthLabel = new Date(calendar.year, calendar.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 font-display font-semibold text-white">
          <CalendarDays size={17} className="text-[#F47A20]" />
          Monthly Activity — {monthLabel}
        </h2>
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-[#8B93A8]">
          <Legend swatch="bg-emerald-400" label="Activity" />
          <Legend swatch="bg-[#3A3F52]" label="No activity" />
          <Legend swatch="bg-[#2E8FD1]" label="Today" />
          <Legend swatch="bg-[#F47A20]" label="Counting" dot />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-[#4C5266] font-medium py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
        {calendar.days.map((day) => {
          const isSelected = selectedDay === day.day;
          const base = day.isFuture
            ? "bg-white/[0.02] text-[#3A3F52] cursor-default"
            : day.hasActivity
            ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
            : "bg-white/[0.04] text-[#6B7284] hover:bg-white/[0.08] cursor-pointer";

          return (
            <button
              key={day.day}
              disabled={day.isFuture}
              onClick={() => onSelectDay(day.day)}
              className={`relative aspect-square rounded-lg text-xs font-medium grid place-items-center transition-all duration-150
                ${base}
                ${day.isToday ? "ring-2 ring-[#2E8FD1]" : ""}
                ${isSelected ? "ring-2 ring-[#F47A20]" : ""}
              `}
            >
              {day.day}
              {day.isCountingDay && !day.isFuture && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#F47A20]" />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[#4C5266]">
        <ClipboardList size={12} /> Counting Items is a bi-monthly task — flagged days above are inventory counts.
      </p>
    </section>
  );
}

function Legend({ swatch, label, dot }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`${dot ? "h-1.5 w-1.5" : "h-2.5 w-2.5"} rounded-full ${swatch}`} />
      {label}
    </span>
  );
}
