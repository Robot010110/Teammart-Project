import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Megaphone, Users, Moon,
  CalendarCheck2, Clock, CheckCircle2, BarChart3, MessageCircle,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { useUnreadBadges } from "../../hooks/useUnreadBadges";
import PerformanceCircle from "./PerformanceCircle";
import PerformanceHistoryScreen from "./PerformanceHistoryScreen";
import TodayWorkLogScreen from "./TodayWorkLogScreen";
import WeeklyHoursChart from "./WeeklyHoursChart";
import PerformanceAtmosphere from "./PerformanceAtmosphere";
import QuickActionCard from "./QuickActionCard";
import AttendanceQuickBar from "./AttendanceQuickBar";
import TaskRow from "./TaskRow";
import ActivityMetricCard from "./ActivityMetricCard";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import AnimatedNumber from "../common/AnimatedNumber";
import { getProfile } from "../../services/profileService";
import { getPerformanceSummary } from "../../services/activityService";
import { listSuddenTasks } from "../../services/suddenTaskService";
import { getTodayAttendance, getAttendanceMonth } from "../../services/attendanceService";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isWithinLast7Days(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  cutoff.setHours(0, 0, 0, 0);
  return d >= cutoff;
}

function hoursLabel(hours) {
  if (hours == null) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// HomeTab.jsx — the Worker/Cashier personal dashboard: a "Today's
// Performance" hero card + real Quick Actions + Today's Tasks + a
// period-scoped Activity Overview. Every number here is real:
//   - Performance: the existing GET /activities/performance approval
//     rate (see PerformanceCircle.jsx's `bare`/`size` props).
//   - Hours today: derived from GET /attendance/today's real
//     checkIn/checkOut/breakStart/breakEnd — "hours today" while still
//     checked in has no backend field (confirmed — none exists), so
//     it's computed client-side from real timestamps, same live-elapsed
//     convention AttendanceCheckInCard.jsx uses.
//   - Tasks today / Activity Overview: real SuddenTask data, period-
//     filtered client-side (This Week = last 7 days, This Month = the
//     real GET /attendance/month response's own days[]/summary).
//   - Compliance: this app has no such stored metric anywhere (see
//     WorkerActivityTab.jsx's identical note) — shown as the same honest
//     completed/(completed+pending) ratio used there, not invented.
//
// Attendance on this page is intentionally partial, not absent: a
// compact status row in the hero, a "View Attendance" Quick Action, and
// AttendanceQuickBar.jsx's real check-in/checkOut/startBreak/endBreak
// actions (the exact same GET /attendance/today state and calls
// AttendanceCheckInCard.jsx already uses on the Attendance page — see
// that component's own comment on why the two timing constants are
// deliberately duplicated rather than shared). What Home does NOT
// contain is the full Attendance page's calendar/month grid/history —
// that stays exactly one place, Profile -> Attendance
// (ProfileTab.jsx's own AttendanceSection), which is what both the
// hero's Attendance row and the Quick Action tile navigate to now that
// there's no local attendance section on this page to scroll to.
//
// Photo-change and WhatsApp self-service (previously on this page via
// ProfileHeaderCard) remain fully available — ProfileHeaderCard.jsx is
// still rendered at the top of the Profile tab, unchanged.
export default function HomeTab({ onNavigate, basePath }) {
  const navigate = useNavigate();
  const { chatUnread } = useUnreadBadges();

  const { data: profile, error: profileError, loading: profileLoading, reload: reloadProfile } = useAsync(getProfile, { deps: [] });
  const { data: performance } = useAsync(getPerformanceSummary, { deps: [] });
  // One fetch, sliced client-side by real status — My Tasks redesign
  // added a real IN_PROGRESS state between ASSIGNED and COMPLETED, so
  // "pending" here means "not yet completed" (ASSIGNED or IN_PROGRESS),
  // not just ASSIGNED.
  const { data: allTasks } = useAsync(listSuddenTasks, { deps: [] });
  const pendingTasks = useMemo(() => (allTasks ?? []).filter((t) => t.status !== "COMPLETED"), [allTasks]);
  const completedTasks = useMemo(() => (allTasks ?? []).filter((t) => t.status === "COMPLETED"), [allTasks]);
  const { data: todayAttendance } = useAsync(getTodayAttendance, { deps: [] });
  const now = new Date();
  const { data: monthAttendance } = useAsync(() => getAttendanceMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }), { deps: [] });

  const [showPerformanceHistory, setShowPerformanceHistory] = useState(false);
  const [showWorkLog, setShowWorkLog] = useState(false);
  const [period, setPeriod] = useState("week"); // "week" | "month"

  const pendingCount = (pendingTasks ?? []).length;
  const completedToday = (completedTasks ?? []).filter((t) => isToday(t.completedAt));
  const todaysTasks = [...(pendingTasks ?? []), ...completedToday].slice(0, 3);

  const isCheckedIn = !!(todayAttendance?.checkIn && !todayAttendance?.checkOut);
  const isCheckedOut = !!todayAttendance?.checkOut;
  const attendanceLabel = isCheckedIn ? "Checked in" : isCheckedOut ? "Checked out" : "Not checked in";
  const goToAttendance = () => navigate(`${basePath}/profile/attendance`);

  // Hours worked today — real timestamps, computed client-side (no
  // backend field exists for an in-progress day, see this file's own
  // top comment). Minus any completed break, same as the backend's own
  // computeWorkingHours does for a finished day.
  const hoursToday = useMemo(() => {
    if (!todayAttendance?.checkIn) return null;
    const start = new Date(todayAttendance.checkIn).getTime();
    const end = todayAttendance.checkOut ? new Date(todayAttendance.checkOut).getTime() : Date.now();
    let ms = end - start;
    if (todayAttendance.breakStart && todayAttendance.breakEnd) {
      ms -= new Date(todayAttendance.breakEnd).getTime() - new Date(todayAttendance.breakStart).getTime();
    }
    return Math.max(ms / (1000 * 60 * 60), 0);
  }, [todayAttendance]);

  const periodCompletedCount = useMemo(() => {
    const list = completedTasks ?? [];
    return period === "week"
      ? list.filter((t) => isWithinLast7Days(t.completedAt)).length
      : list.filter((t) => isToday(t.completedAt) || (t.completedAt && new Date(t.completedAt).getMonth() === now.getMonth() && new Date(t.completedAt).getFullYear() === now.getFullYear())).length;
  }, [completedTasks, period]);

  const periodHours = useMemo(() => {
    if (!monthAttendance?.days) return null;
    if (period === "month") return monthAttendance.summary?.totalHoursWorked ?? null;
    const weekDays = monthAttendance.days.filter((d) => d.workingHours != null && isWithinLast7Days(d.date));
    if (weekDays.length === 0) return null;
    return weekDays.reduce((sum, d) => sum + d.workingHours, 0);
  }, [monthAttendance, period]);

  const periodTotal = periodCompletedCount + pendingCount;
  const complianceLabel = periodTotal > 0 ? `${Math.round((periodCompletedCount / periodTotal) * 100)}%` : "—";
  const performanceLabel = performance?.rate != null ? `${Math.round(performance.rate)}%` : "—";

  if (showPerformanceHistory) {
    return (
      <div className="min-h-full bg-[#050A18]">
        <PerformanceHistoryScreen onBack={() => setShowPerformanceHistory(false)} />
      </div>
    );
  }

  if (showWorkLog) {
    return (
      <div className="min-h-full bg-[#050A18]">
        <TodayWorkLogScreen onBack={() => setShowWorkLog(false)} />
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-full bg-[#050A18] px-4 sm:px-6 py-6 max-w-4xl mx-auto space-y-4">
        <SkeletonCard className="h-16" />
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-24" />
      </div>
    );
  }
  if (profileError) {
    return (
      <div className="min-h-full bg-[#050A18] px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <ErrorBanner message={profileError} onRetry={reloadProfile} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#050A18] px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="mb-5">
        <p className="text-sm text-[#8B93A8]">{greeting()}</p>
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
          {profile.name} <span aria-hidden="true">👋</span>
        </h1>
        <p className="text-sm text-[#9AA1B4] mt-0.5">
          {profile.position}
          {profile.department ? ` · ${profile.department}` : ""}
        </p>
      </div>

      {profile.operationalShift === "NIGHT" && (
        <button
          type="button"
          onClick={() => navigate(`${basePath}/night-shift`)}
          className="mb-5 w-full flex items-center gap-3 rounded-2xl p-4 bg-gradient-to-br from-[#1D2D5C]/60 to-[#171C2E]/80 border border-[#F47A20]/20 hover:border-[#F47A20]/40 backdrop-blur-xl transition-colors text-left"
        >
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-[#F47A20]/15 text-[#F47A20] shrink-0">
            <Moon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Night Shift</p>
            <p className="text-xs text-[#9AA1B4]">Tonight's tasks, Washing Market, and your departments</p>
          </div>
        </button>
      )}

      {/* Today's Performance — hero card. The centerpiece: a deep navy
          glass surface (per the brief's #050A18-#0B1830 family) with the
          canvas-based ambient particle+wave atmosphere layered behind
          the ring/stats — see PerformanceAtmosphere.jsx's own comment
          for why this is canvas+refs rather than DOM particles (kept
          fully isolated from React's render cycle for performance). A
          hairline inner highlight (card-premium) plus a soft outer glow
          give it the "physical glass surface" depth the brief asks for,
          without tipping into heavy glassmorphism. */}
      <section className="card-premium relative mb-5 rounded-2xl p-5 bg-gradient-to-br from-[#0B1830]/85 to-[#050A18]/95 border border-white/[0.07] backdrop-blur-xl overflow-hidden shadow-[0_0_40px_-12px_rgba(244,122,32,0.15)]">
        <PerformanceAtmosphere />
        <h2 className="relative mb-4 text-sm font-semibold text-white">Today's Performance</h2>
        <div className="relative flex items-center gap-5">
          <PerformanceCircle rate={performance?.rate} onClick={() => setShowPerformanceHistory(true)} bare size={112} />
          <div className="flex-1 min-w-0 divide-y divide-white/[0.06]">
            <div className="flex items-center justify-between py-2 first:pt-0">
              <span className="flex items-center gap-1.5 text-xs text-[#9AA1B4]"><CheckCircle2 size={13} className="text-emerald-400" /> Tasks Today</span>
              <span className="text-xs font-semibold text-white">
                <AnimatedNumber value={completedToday.length} /> / <AnimatedNumber value={completedToday.length + pendingCount} />
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-1.5 text-xs text-[#9AA1B4]"><Users size={13} className="text-sky-400" /> Attendance</span>
              <button type="button" onClick={goToAttendance} className="text-xs font-semibold text-sky-400 hover:text-sky-300">
                {attendanceLabel}
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-1.5 text-xs text-[#9AA1B4]"><Clock size={13} className="text-[#F47A20]" /> Hours Today</span>
              <button type="button" onClick={() => setShowWorkLog(true)} className="text-xs font-semibold text-white hover:text-[#F47A20]">
                {hoursLabel(hoursToday)}
              </button>
            </div>
            <div className="flex items-center justify-between py-2 last:pb-0">
              <span className="flex items-center gap-1.5 text-xs text-[#9AA1B4]"><ClipboardList size={13} className="text-violet-400" /> Department</span>
              <span className="text-xs font-semibold text-white truncate max-w-[120px]">{profile.department || "—"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5">
        <AttendanceQuickBar />
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
          <button type="button" onClick={() => onNavigate?.("tasks")} className="text-xs font-semibold text-[#F47A20] hover:text-[#ff8b36]">
            View All
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
          <QuickActionCard icon={ClipboardList} label="My Tasks" tone="orange" badge={pendingCount} onClick={() => onNavigate?.("tasks")} />
          <QuickActionCard icon={Megaphone} label="Daily Activity" tone="orange" onClick={() => onNavigate?.("activity")} />
          <QuickActionCard icon={Users} label="Attendance" tone="blue" onClick={goToAttendance} />
          <QuickActionCard icon={MessageCircle} label="Chat" tone="violet" badge={chatUnread} onClick={() => onNavigate?.("chat")} />
        </div>
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Today's Tasks</h2>
          <button type="button" onClick={() => onNavigate?.("tasks")} className="text-xs font-semibold text-[#F47A20] hover:text-[#ff8b36]">
            View All
          </button>
        </div>
        {todaysTasks.length === 0 ? (
          <p className="text-sm text-[#4C5266] text-center py-6">You're all caught up — no tasks are waiting for you.</p>
        ) : (
          <div className="space-y-2">
            {todaysTasks.map((t, i) => (
              <div key={t.id} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <TaskRow task={t} onClick={() => navigate(`${basePath}/tasks/${t.id}`)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Activity Overview</h2>
          <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setPeriod("week")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${period === "week" ? "bg-[#F47A20] text-white" : "text-[#9AA1B4]"}`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setPeriod("month")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${period === "month" ? "bg-[#F47A20] text-white" : "text-[#9AA1B4]"}`}
            >
              This Month
            </button>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <ActivityMetricCard icon={CalendarCheck2} value={periodCompletedCount} label="Completed" tone="emerald" />
          <ActivityMetricCard icon={Clock} value={hoursLabel(periodHours)} label="Hours" tone="orange" />
          <ActivityMetricCard icon={CheckCircle2} value={complianceLabel} label="Compliance" tone="emerald" />
          <ActivityMetricCard icon={BarChart3} value={performanceLabel} label="Performance" tone="violet" />
        </div>
        <WeeklyHoursChart days={monthAttendance?.days} />
      </section>
    </div>
  );
}
