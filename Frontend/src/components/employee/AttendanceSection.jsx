import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import AttendanceHistoryList from "./AttendanceHistoryList";
import SubmitExtraHoursModal from "./SubmitExtraHoursModal";
import MissingCheckoutBanner from "./MissingCheckoutBanner";
import AttendanceHeader from "./attendance/AttendanceHeader";
import AttendanceStatusCenter from "./attendance/AttendanceStatusCenter";
import TodayOverviewGrid from "./attendance/TodayOverviewGrid";
import AttendanceRateRing from "./attendance/AttendanceRateRing";
import AttendanceMonthGrid from "./attendance/AttendanceMonthGrid";
import TodayTimeline from "./attendance/TodayTimeline";
import WorkTimeSummary from "./attendance/WorkTimeSummary";
import ShiftProgressBar from "./attendance/ShiftProgressBar";
import AttendanceSkeleton from "./attendance/AttendanceSkeleton";
import ErrorBanner from "../common/ErrorBanner";
import Toast from "../common/Toast";
import { getAttendanceMonth, getTodayAttendance } from "../../services/attendanceService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

// AttendanceSection.jsx — the employee's own Attendance page, reached
// from Profile -> Attendance (ProfileTab.jsx owns that route, so back
// navigation is unchanged and this component stays route-agnostic).
//
// ONE design system, TWO purpose-built compositions:
//   mobile   a single vertical column — status hero, 3-across overview,
//            rate ring above the calendar, timeline, work-time row.
//   desktop  the same components in a wider grid — six-across overview,
//            rate ring beside a full-width calendar, a shift progress
//            rail, and timeline beside a stacked work-time column.
// Both are the same components and the same data; only the layout
// changes at `lg`.
//
// BUSINESS LOGIC UNCHANGED. Check-in/out/break still go through the same
// attendanceService calls with the same server-side rules — see
// AttendanceStatusCenter.jsx, which is a re-presentation of exactly what
// AttendanceCheckInCard.jsx already did (that component is untouched and
// still used by RegionalManagerProfile.jsx).
//
// Deliberately NOT modified, because Supervisor Mode's
// EmployeeAttendanceScreen.jsx renders them too and changing them would
// silently redesign the supervisor's screen: AttendanceCalendar.jsx (the
// day list) and AttendanceSummaryCards.jsx. This page uses its own
// AttendanceMonthGrid/TodayOverviewGrid instead.
//
// Everything that existed here still exists: the missing-checkout
// banner, month paging, per-day adjustment/penalty reasons (now inside
// the calendar's selected-day panel), History, and Submit Extra Hours.

// `onBack` is optional so any existing caller that renders this without
// a header (or inside its own chrome) keeps working unchanged; the
// header only appears when a back handler is actually supplied.
export default function AttendanceSection({ onBack }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [toast, setToast] = useToast();
  const historyRef = useRef(null);
  const calendarRef = useRef(null);

  // Ticks the live "still checked in" durations (work-time summary and
  // the shift rail). One interval for the page rather than one per card.
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const { data, error, loading, reload } = useAsync(() => getAttendanceMonth({ year, month }), {
    deps: [year, month],
    fallbackError: "Could not load your attendance.",
  });

  // Today's record drives the timeline / work-time / shift rail. Loaded
  // separately from the month so a failure in one never blanks the other.
  const { data: today, reload: reloadToday } = useAsync(getTodayAttendance, {
    deps: [],
    fallbackError: "Could not load today's attendance.",
  });

  function handleSubmitted() {
    setSubmitOpen(false);
    setHistoryKey((k) => k + 1);
    setToast("Extra hours sent to your Supervisor for review.");
  }

  // A real check-in/out/break changes today's record AND the month
  // summary, so both are refreshed off the same confirmed backend result.
  function handleAttendanceChanged() {
    reload();
    reloadToday();
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto space-y-4 animate-fade-up">
      {onBack && (
        <AttendanceHeader
          onBack={onBack}
          onJumpToCalendar={() => calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      )}

      <AttendanceStatusCenter
        onChanged={handleAttendanceChanged}
        onViewHistory={() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
      />

      <MissingCheckoutBanner />

      {loading && <AttendanceSkeleton />}
      {!loading && error && <ErrorBanner message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <section>
            <h2 className="mb-2.5 text-[15px] font-bold text-white">Today Overview</h2>
            <TodayOverviewGrid summary={data.summary} />
          </section>

          {/* Rate + calendar. The mobile reference groups these as ONE
              card (rate above the calendar); the desktop reference shows
              two cards side by side. So the wrapper IS the card below lg
              and dissolves into a 2-column grid at lg, where each child
              becomes its own card — one component set, two compositions,
              no duplicated markup. */}
          <div className="rounded-[20px] p-4 bg-[#0D1223]/80 border border-white/[0.06] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.85)] lg:p-0 lg:bg-transparent lg:border-0 lg:shadow-none lg:grid lg:gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            {/* flex-col on desktop so the ring centres in the space the
                taller calendar beside it creates, instead of sitting at
                the top with dead space beneath. */}
            <section className="card-premium relative overflow-hidden lg:flex lg:flex-col lg:rounded-[20px] lg:p-4 lg:bg-[#0D1223]/80 lg:border lg:border-white/[0.06] lg:shadow-[0_10px_40px_-14px_rgba(0,0,0,0.85)]">
              <div className="absolute -bottom-16 -left-10 w-52 h-52 rounded-full bg-[#F47A20]/[0.07] blur-3xl animate-ambient-drift pointer-events-none" aria-hidden="true" />
              <h2 className="relative text-[15px] font-bold text-white">Attendance Rate</h2>
              <div className="relative mt-2 flex justify-center lg:flex-1 lg:items-center">
                <AttendanceRateRing
                  rate={data.summary.attendanceRate}
                  label={isCurrentMonth ? "This Month" : "Selected Month"}
                />
              </div>
            </section>

            {/* Divider only exists in the merged mobile card. */}
            <div className="my-4 h-px bg-white/[0.06] lg:hidden" aria-hidden="true" />

            <section ref={calendarRef} className="scroll-mt-4 lg:rounded-[20px] lg:p-4 lg:bg-[#0D1223]/80 lg:border lg:border-white/[0.06] lg:shadow-[0_10px_40px_-14px_rgba(0,0,0,0.85)]">
              <AttendanceMonthGrid
                year={year}
                month={month}
                days={data.days}
                onChangeMonth={(y, m) => {
                  setYear(y);
                  setMonth(m);
                }}
              />
            </section>
          </div>

          <ShiftProgressBar record={today} now={tick} />

          {/* Timeline + work-time. Mobile stacks; desktop pairs them. */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <section className="rounded-[20px] p-4 bg-[#0D1223]/80 border border-white/[0.06] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.85)]">
              <h2 className="mb-3 text-[15px] font-bold text-white">Today's Timeline</h2>
              <TodayTimeline record={today} />
            </section>

            <section className="rounded-[20px] p-4 bg-[#0D1223]/80 border border-white/[0.06] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.85)]">
              <h2 className="mb-3 text-[15px] font-bold text-white lg:block hidden">Work Time</h2>
              <WorkTimeSummary record={today} now={tick} />
            </section>
          </div>
        </>
      )}

      <section ref={historyRef} className="scroll-mt-4 pt-1">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-[15px] font-bold text-white">History</h2>
          <button
            type="button"
            onClick={() => setSubmitOpen(true)}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:scale-95 shadow-[0_0_18px_-3px_rgba(244,122,32,0.7)] transition-all duration-150"
          >
            <Clock3 size={14} /> Submit Extra Hours
          </button>
        </div>
        <AttendanceHistoryList key={historyKey} />
      </section>

      {submitOpen && <SubmitExtraHoursModal onClose={() => setSubmitOpen(false)} onSubmitted={handleSubmitted} />}
      <Toast message={toast} />
    </div>
  );
}
