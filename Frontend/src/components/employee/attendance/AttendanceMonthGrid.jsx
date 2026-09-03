import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, SlidersHorizontal, MinusCircle, Plus } from "lucide-react";
import OffDaySheet from "./OffDaySheet";

// AttendanceMonthGrid.jsx — a real month calendar grid for the employee's
// own attendance, replacing the previous vertical day-list on this page.
// Also the entry point for the Off-Day picker: tapping a blank, valid
// (today-or-future) date opens OffDaySheet.jsx — "Attendance -> Calendar
// -> Tap Date -> Choose Off Type".
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
// Status -> colour uses only values that exist in this app's real data
// model. DAY_OFF is split by its real dayOffType (WEEKLY/MONTHLY/
// EMERGENCY/OTHER) rather than one merged "Off" bucket, so the calendar
// visually distinguishes the three calendar-picked off types from each
// other and from an Earned Day Off. EARLY_LEAVE/INCOMPLETE/
// PENDING_REVIEW share the sky "Needs review" bucket — there is no
// "Half Day" anywhere in this data model, so none is shown.

const WEEK_START_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const BUCKETS = {
  PRESENT: { key: "present", label: "Present", dot: "#34D399", glow: "rgba(52,211,153,0.85)" },
  LATE: { key: "late", label: "Late", dot: "#F9A03C", glow: "rgba(249,160,60,0.85)" },
  ABSENT: { key: "absent", label: "Absent", dot: "#FF5C5C", glow: "rgba(255,92,92,0.85)" },
  APPROVED_LEAVE: { key: "leave", label: "Personal Leave", dot: "#2DD4BF", glow: "rgba(45,212,191,0.85)" },
  EARLY_LEAVE: { key: "review", label: "Needs review", dot: "#38BDF8", glow: "rgba(56,189,248,0.85)" },
  INCOMPLETE: { key: "review", label: "Needs review", dot: "#38BDF8", glow: "rgba(56,189,248,0.85)" },
  PENDING_REVIEW: { key: "review", label: "Needs review", dot: "#38BDF8", glow: "rgba(56,189,248,0.85)" },
};

// DAY_OFF's real dayOffType decides its colour — Weekly/Monthly/
// Emergency are visually distinct on purpose (spec: orange/purple/red),
// and OTHER (Earned Day Off) gets its own tone rather than being lumped
// in with any of the three.
const DAY_OFF_BUCKETS = {
  WEEKLY: { key: "weekly", label: "Weekly Off", dot: "#F9A03C", glow: "rgba(249,160,60,0.85)" },
  MONTHLY: { key: "monthly", label: "Monthly Off", dot: "#A78BFA", glow: "rgba(167,139,250,0.85)" },
  EMERGENCY: { key: "emergency", label: "Emergency Off", dot: "#FF5C5C", glow: "rgba(255,92,92,0.85)" },
  OTHER: { key: "earned", label: "Earned Day Off", dot: "#38BDF8", glow: "rgba(56,189,248,0.85)" },
};

function bucketFor(record) {
  if (record.status === "DAY_OFF") return DAY_OFF_BUCKETS[record.dayOffType] ?? DAY_OFF_BUCKETS.OTHER;
  return BUCKETS[record.status] ?? null;
}

const STATUS_LABEL = {
  PRESENT: "Present",
  LATE: "Late",
  EARLY_LEAVE: "Early Leave",
  ABSENT: "Absent",
  DAY_OFF: "Day Off",
  APPROVED_LEAVE: "Personal Leave",
  INCOMPLETE: "Incomplete",
  PENDING_REVIEW: "Pending Review",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const timeLabel = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "--:--";

export default function AttendanceMonthGrid({ year, month, days, onChangeMonth, onOffDayCreated }) {
  const [selectedDay, setSelectedDay] = useState(null);
  // The UTC-midnight Date of a tapped blank, valid date — opens
  // OffDaySheet when set. Distinct from selectedDay (which shows detail
  // for an EXISTING record) since these are two different interactions.
  const [pickerDate, setPickerDate] = useState(null);
  // Whether the currently-open sheet actually created something — a
  // ref, not state, since setting it must never itself trigger a
  // re-render (see the sheet's onClose below for why).
  const createdRef = useRef(false);

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
      const b = bucketFor(rec);
      if (!b) continue;
      counts[b.key] = counts[b.key] ?? { ...b, count: 0 };
      counts[b.key].count += 1;
    }
    return { cells: out, legend: Object.values(counts) };
  }, [year, month, byDay, days]);

  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  // UTC-midnight "today", matching how AttendanceRecord/LeaveRequest
  // dates are actually stored (see leaveRequestsController's own
  // comment on this exact convention) — a blank cell is only offered as
  // a real off-day pick when its date is >= this. Past blank cells stay
  // disabled and non-interactive, never opening the picker.
  const todayUtc = useMemo(
    () => new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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
              const bucket = c.record ? bucketFor(c.record) : null;
              const isToday = isThisMonth && c.day === today.getDate();
              const isSelected = selectedDay === c.day;
              const cellDateUtc = new Date(Date.UTC(year, month - 1, c.day));
              // A blank date only becomes a real off-day pick when it's
              // today or later — a past blank date has no record simply
              // because it predates this employee's history/imports, not
              // because it's available to claim.
              const isPickable = !c.record && cellDateUtc >= todayUtc;
              const disabled = !c.record && !isPickable;

              const handleClick = () => {
                if (c.record) {
                  setSelectedDay(isSelected ? null : c.day);
                } else if (isPickable) {
                  setPickerDate(cellDateUtc);
                }
              };

              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={disabled}
                  onClick={handleClick}
                  aria-label={
                    c.record
                      ? `${MONTHS[month - 1]} ${c.day}: ${STATUS_LABEL[c.record.status] ?? c.record.status}`
                      : isPickable
                        ? `${MONTHS[month - 1]} ${c.day}: add an off day`
                        : `${MONTHS[month - 1]} ${c.day}: no record`
                  }
                  aria-pressed={isSelected}
                  className={`group relative mx-auto flex h-9 w-9 sm:h-10 sm:w-10 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
                    isSelected
                      ? "bg-violet-500/[0.18] ring-1 ring-violet-400/60 shadow-[0_0_16px_-2px_rgba(167,139,250,0.7)]"
                      : isToday
                        ? "ring-1 ring-[#F47A20]/50"
                        : c.record || isPickable
                          ? "hover:bg-white/[0.05]"
                          : ""
                  } ${c.record || isPickable ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span
                    className={`text-[12px] sm:text-[13px] leading-none tabular-nums ${
                      c.record ? "text-white font-medium" : isPickable ? "text-[#8B93A8]" : "text-[#3C4256]"
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
                  {/* Faint "+" affordance on a pickable blank date — only
                      on hover/focus so the grid doesn't look cluttered
                      with plus signs on every open day at rest. */}
                  {isPickable && (
                    <span className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity text-[#F47A20]">
                      <Plus size={9} strokeWidth={3} />
                    </span>
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

      {pickerDate && (
        <OffDaySheet
          date={pickerDate}
          onClose={() => {
            setPickerDate(null);
            // Deferred to close, not fired the instant creation succeeds:
            // onOffDayCreated ultimately calls the parent's reload(),
            // which flips AttendanceSection's `loading` back to true and
            // unmounts the whole calendar block THIS component lives in
            // (see AttendanceSection.jsx's `{!loading && ... && (<>)}`)
            // — including this sheet. Calling it eagerly was yanking the
            // success screen out from under the employee before they
            // ever saw it. Waiting until the sheet is actually being
            // closed (Done, X, or Escape) means the confirmation is
            // always shown first; the calendar still refreshes from real
            // backend data immediately after, same as a reload would.
            if (createdRef.current) {
              createdRef.current = false;
              onOffDayCreated?.();
            }
          }}
          onCreated={() => {
            createdRef.current = true;
          }}
        />
      )}
    </div>
  );
}

function SelectedDay({ record, monthLabel, day }) {
  const isOff = record.status === "DAY_OFF" || record.status === "APPROVED_LEAVE";
  const bucket = bucketFor(record);

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
          {bucket?.label ?? STATUS_LABEL[record.status] ?? record.status}
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
