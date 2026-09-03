import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, SlidersHorizontal, MinusCircle } from "lucide-react";

// AttendanceMonthGrid.jsx — a real month calendar grid for the employee's
// own attendance, replacing the previous vertical day-list on this page.
//
// AttendanceCalendar.jsx (the list) is deliberately NOT modified: it is
// shared with Supervisor Mode's EmployeeAttendanceScreen.jsx, so changing
// it would silently redesign the supervisor's screen too. This is a new
// component used only by the employee Attendance page.
//
// Every marker is a real AttendanceRecord from GET /api/attendance/month.
// A day with no record renders as a plain date with no dot — the API only
// returns days that actually have a record, and nothing here invents a
// status for the rest.
//
// Status -> colour uses only values that exist in the AttendanceStatus
// enum (schema.prisma). There is no "Half Day" in this data model, so
// none is shown; DAY_OFF/APPROVED_LEAVE share the violet "Off / Leave"
// bucket and EARLY_LEAVE/INCOMPLETE/PENDING_REVIEW share the sky
// "Needs review" bucket.

const WEEK_START_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const BUCKETS = {
  PRESENT: { key: "present", label: "Present", dot: "#34D399", glow: "rgba(52,211,153,0.85)" },
  LATE: { key: "late", label: "Late", dot: "#F9A03C", glow: "rgba(249,160,60,0.85)" },
  ABSENT: { key: "absent", label: "Absent", dot: "#FF5C5C", glow: "rgba(255,92,92,0.85)" },
  DAY_OFF: { key: "off", label: "Off / Leave", dot: "#A78BFA", glow: "rgba(167,139,250,0.85)" },
  APPROVED_LEAVE: { key: "off", label: "Off / Leave", dot: "#A78BFA", glow: "rgba(167,139,250,0.85)" },
  EARLY_LEAVE: { key: "review", label: "Needs review", dot: "#38BDF8", glow: "rgba(56,189,248,0.85)" },
  INCOMPLETE: { key: "review", label: "Needs review", dot: "#38BDF8", glow: "rgba(56,189,248,0.85)" },
  PENDING_REVIEW: { key: "review", label: "Needs review", dot: "#38BDF8", glow: "rgba(56,189,248,0.85)" },
};

const STATUS_LABEL = {
  PRESENT: "Present",
  LATE: "Late",
  EARLY_LEAVE: "Early Leave",
  ABSENT: "Absent",
  DAY_OFF: "Day Off",
  APPROVED_LEAVE: "Approved Leave",
  INCOMPLETE: "Incomplete",
  PENDING_REVIEW: "Pending Review",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const timeLabel = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "--:--";

export default function AttendanceMonthGrid({ year, month, days, onChangeMonth }) {
  const [selectedDay, setSelectedDay] = useState(null);

  // Index real records by day-of-month for O(1) lookup while building the
  // grid, rather than scanning the array per cell.
  //
  // getUTCDate, not getDate: AttendanceRecord.date is a date-only marker
  // serialised at exactly midnight UTC (verified against the live API),
  // so reading it in the VIEWER's local time would shift every record a
  // day earlier for anyone west of UTC and silently drop the 1st of the
  // month out of the grid entirely. UTC getters read back exactly the
  // day the backend stored, from any timezone.
  const byDay = useMemo(() => {
    const map = new Map();
    for (const d of days ?? []) map.set(new Date(d.date).getUTCDate(), d);
    return map;
  }, [days]);

  const { cells, legend } = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const total = new Date(year, month, 0).getDate();
    // Monday-first, matching this app's existing startOfWeek convention
    // (activitiesController.js) and the desktop reference's Mon-Sun row.
    const lead = (first.getDay() + 6) % 7;

    const out = [];
    for (let i = 0; i < lead; i += 1) out.push({ blank: true, key: `b${i}` });
    for (let d = 1; d <= total; d += 1) out.push({ key: `d${d}`, day: d, record: byDay.get(d) ?? null });

    const counts = {};
    for (const rec of days ?? []) {
      const b = BUCKETS[rec.status];
      if (!b) continue;
      counts[b.key] = counts[b.key] ?? { ...b, count: 0 };
      counts[b.key].count += 1;
    }
    return { cells: out, legend: Object.values(counts) };
  }, [year, month, byDay, days]);

  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => onChangeMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)}
          aria-label="Previous month"
          className="w-9 h-9 grid place-items-center rounded-xl text-[#9AA1B4] hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="font-display text-[15px] sm:text-[17px] font-bold text-white">
          {MONTHS[month - 1]} {year}
        </p>
        <button
          type="button"
          onClick={() => onChangeMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)}
          aria-label="Next month"
          className="w-9 h-9 grid place-items-center rounded-xl text-[#9AA1B4] hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEK_START_MON.map((w) => (
          <div key={w} className="text-center text-[10px] sm:text-[11px] font-medium text-[#5C6479] pb-1.5">
            <span className="lg:hidden">{w[0]}</span>
            <span className="hidden lg:inline">{w}</span>
          </div>
        ))}

        {cells.map((c) =>
          c.blank ? (
            <div key={c.key} />
          ) : (
            (() => {
              const bucket = c.record ? BUCKETS[c.record.status] : null;
              const isToday = isThisMonth && c.day === today.getDate();
              const isSelected = selectedDay === c.day;
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={!c.record}
                  onClick={() => setSelectedDay(isSelected ? null : c.day)}
                  aria-label={
                    c.record
                      ? `${MONTHS[month - 1]} ${c.day}: ${STATUS_LABEL[c.record.status] ?? c.record.status}`
                      : `${MONTHS[month - 1]} ${c.day}: no record`
                  }
                  aria-pressed={isSelected}
                  className={`relative mx-auto flex h-9 w-9 sm:h-10 sm:w-10 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
                    isSelected
                      ? "bg-violet-500/[0.18] ring-1 ring-violet-400/60 shadow-[0_0_16px_-2px_rgba(167,139,250,0.7)]"
                      : isToday
                        ? "ring-1 ring-[#F47A20]/50"
                        : c.record
                          ? "hover:bg-white/[0.05]"
                          : ""
                  } ${c.record ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span
                    className={`text-[12px] sm:text-[13px] leading-none tabular-nums ${
                      c.record ? "text-white font-medium" : "text-[#3C4256]"
                    }`}
                  >
                    {c.day}
                  </span>
                  {bucket && (
                    <span
                      className="mt-1 h-[5px] w-[5px] rounded-full"
                      style={{ background: bucket.dot, boxShadow: `0 0 6px 1px ${bucket.glow}` }}
                    />
                  )}
                </button>
              );
            })()
          )
        )}
      </div>

      {legend.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2">
          {legend.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5 text-[11px] text-[#9AA1B4]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: l.dot, boxShadow: `0 0 6px 1px ${l.glow}` }}
              />
              {l.label}
              <span className="text-white font-semibold tabular-nums">{l.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Selected-day detail — real record fields only. */}
      {selectedDay != null && byDay.get(selectedDay) && (
        <SelectedDay record={byDay.get(selectedDay)} monthLabel={MONTHS[month - 1]} day={selectedDay} />
      )}
    </div>
  );
}

function SelectedDay({ record, monthLabel, day }) {
  const isOff = record.status === "DAY_OFF" || record.status === "APPROVED_LEAVE";
  const bucket = BUCKETS[record.status];

  return (
    <div className="animate-fade-up mt-4 rounded-2xl p-3.5 bg-[#12172A]/80 border border-white/[0.07]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-white">
          {monthLabel} {day}
        </p>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{ color: bucket?.dot ?? "#9AA1B4", background: `${bucket?.dot ?? "#9AA1B4"}1A` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: bucket?.dot ?? "#9AA1B4" }} />
          {STATUS_LABEL[record.status] ?? record.status}
        </span>
      </div>

      {!isOff && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[#9AA1B4]">
          <span>In {timeLabel(record.checkIn)}</span>
          <span>Out {timeLabel(record.checkOut)}</span>
          {record.workingHours != null && <span>{record.workingHours.toFixed(1)}h worked</span>}
          <span>{record.requiredHours}h required</span>
          {record.extraHours > 0 && <span className="text-emerald-400">+{record.extraHours.toFixed(1)}h extra</span>}
        </div>
      )}

      {record.status === "ABSENT" && (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#FF5C5C]">
          <AlertTriangle size={12} /> No check-in recorded
        </p>
      )}
      {(record.status === "INCOMPLETE" || record.status === "PENDING_REVIEW") && (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-sky-400">
          <AlertTriangle size={12} />
          {record.status === "INCOMPLETE" ? "Missing check-in or check-out" : "Awaiting supervisor review"}
        </p>
      )}
      {record.status === "DAY_OFF" && record.dayOffType && (
        <p className="mt-2 text-[11.5px] text-[#9AA1B4]">
          {record.dayOffType.charAt(0) + record.dayOffType.slice(1).toLowerCase()} off day
        </p>
      )}

      {record.punishmentHours > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#FF5C5C]">
          <MinusCircle size={12} /> Penalty −{record.punishmentHours.toFixed(1)}h
          {record.punishmentReason ? ` · ${record.punishmentReason}` : ""}
        </p>
      )}
      {(record.adjustments ?? []).map((a) => (
        <p key={a.id} className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#F9A03C]">
          <SlidersHorizontal size={12} /> Required {a.previousRequiredHours}h → {a.newRequiredHours}h · {a.reason}
        </p>
      ))}
    </div>
  );
}
