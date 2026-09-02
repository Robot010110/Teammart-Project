import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Megaphone, Users, Moon,
  CalendarCheck2, Clock, CheckCircle2, BarChart3, MessageCircle,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { useUnreadBadges } from "../../hooks/useUnreadBadges";
import PerformanceCircle from "./PerformanceCircle";
import PerformanceHistoryScreen from "./PerformanceHistoryScreen";
import AttendanceSection from "./AttendanceSection";
import QuickActionCard from "./QuickActionCard";
import AnnouncementCard from "./AnnouncementCard";
import TaskRow from "./TaskRow";
import ActivityMetricCard from "./ActivityMetricCard";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getProfile } from "../../services/profileService";
import { getPerformanceSummary } from "../../services/activityService";
import { listSuddenTasks } from "../../services/suddenTaskService";
import { getTodayAttendance, getAttendanceMonth } from "../../services/attendanceService";
import { listMyCommunications } from "../../services/communicationsService";

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

// HomeTab.jsx — the Worker/Cashier personal dashboard, redesigned around
// a "Today's Performance" hero card + real Quick Actions + Today's
// Tasks + a period-scoped Activity Overview, replacing the older
// Profile-header-plus-two-tiles layout. Every number here is real:
//   - Performance: the existing GET /activities/performance approval
//     rate (unchanged data source, just a bigger ring — see
//     PerformanceCircle.jsx's new `bare`/`size` props).
//   - Attendance status / hours today: derived from GET
//     /attendance/today's real checkIn/checkOut/breakStart/breakEnd,
//     same fields AttendanceCheckInCard.jsx already reads — "hours
//     today" while still checked in has no backend field (confirmed —
//     none exists), so it's computed client-side from real timestamps,
//     same live-elapsed convention AttendanceCheckInCard already uses.
//   - Tasks today / Activity Overview: real SuddenTask data, period-
//     filtered client-side (This Week = last 7 days, This Month = the
//     real GET /attendance/month response's own days[]/summary).
//   - Compliance: this app has no such stored metric anywhere (see
//     WorkerActivityTab.jsx's identical note) — shown as the same honest
//     completed/(completed+pending) ratio used there, not invented.
//   - Team Announcement: the most recent real Communication of type
//     ANNOUNCEMENT this employee can see (GET /communications/my),
//     opening the real CommunicationDetailScreen — an honest empty state
//     when there isn't one.
//
// Photo-change and WhatsApp self-service (previously on this page via
// ProfileHeaderCard) remain fully available — ProfileHeaderCard.jsx is
// still rendered at the top of the Profile tab, unchanged.
export default function HomeTab({ onNavigate, basePath }) {
  const navigate = useNavigate();
  const { chatUnread } = useUnreadBadges();

  const { data: profile, error: profileError, loading: profileLoading, reload: reloadProfile } = useAsync(getProfile, { deps: [] });
  const { data: performance } = useAsync(getPerformanceSummary, { deps: [] });
  const { data: pendingTasks } = useAsync(() => listSuddenTasks({ status: "ASSIGNED" }), { deps: [] });
  const { data: completedTasks } = useAsync(() => listSuddenTasks({ status: "COMPLETED" }), { deps: [] });
  const { data: todayAttendance } = useAsync(getTodayAttendance, { deps: [] });
  const now = new Date();
  const { data: monthAttendance } = useAsync(() => getAttendanceMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }), { deps: [] });
  const { data: communications } = useAsync(listMyCommunications, { deps: [] });

  const [showPerformanceHistory, setShowPerformanceHistory] = useState(false);
  const [period, setPeriod] = useState("week"); // "week" | "month"
  const attendanceRef = useRef(null);

  const pendingCount = (pendingTasks ?? []).length;
  const completedToday = (completedTasks ?? []).filter((t) => isToday(t.completedAt));
  const todaysTasks = [...(pendingTasks ?? []), ...completedToday].slice(0, 3);

  const isCheckedIn = !!(todayAttendance?.checkIn && !todayAttendance?.checkOut);
  const isCheckedOut = !!todayAttendance?.checkOut;
  const attendanceLabel = isCheckedIn ? "Checked in" : isCheckedOut ? "Checked out" : "Not checked in";

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

  const announcement = (communications ?? []).find((c) => c.type === "ANNOUNCEMENT") ?? null;

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
      <div className="min-h-full bg-[#1A1A1A]">
        <PerformanceHistoryScreen onBack={() => setShowPerformanceHistory(false)} />
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto space-y-4">
        <SkeletonCard className="h-16" />
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-24" />
      </div>
    );
  }
  if (profileError) {
    return (
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <ErrorBanner message={profileError} onRetry={reloadProfile} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
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

      {/* Today's Performance — hero card */}
      <section className="relative mb-5 rounded-2xl p-5 bg-gradient-to-br from-[#1D2D5C]/50 to-[#171C2E]/90 border border-white/[0.06] backdrop-blur-xl overflow-hidden">
        <div
          className="absolute -bottom-16 -right-10 w-52 h-52 rounded-full bg-[#F47A20]/[0.07] blur-3xl animate-ambient-drift pointer-events-none"
          aria-hidden="true"
        />
        <h2 className="relative mb-4 text-sm font-semibold text-white">Today's Performance</h2>
        <div className="relative flex items-center gap-5">
          <PerformanceCircle rate={performance?.rate} onClick={() => setShowPerformanceHistory(true)} bare size={112} />
          <div className="flex-1 min-w-0 divide-y divide-white/[0.06]">
            <div className="flex items-center justify-between py-2 first:pt-0">
              <span className="flex items-center gap-1.5 text-xs text-[#9AA1B4]"><CheckCircle2 size={13} className="text-emerald-400" /> Tasks Today</span>
              <span className="text-xs font-semibold text-white">{completedToday.length} / {completedToday.length + pendingCount}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-1.5 text-xs text-[#9AA1B4]"><Users size={13} className="text-sky-400" /> Attendance</span>
              <button type="button" onClick={() => attendanceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="text-xs font-semibold text-sky-400 hover:text-sky-300">
                {attendanceLabel}
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-1.5 text-xs text-[#9AA1B4]"><Clock size={13} className="text-[#F47A20]" /> Hours Today</span>
              <span className="text-xs font-semibold text-white">{hoursLabel(hoursToday)}</span>
            </div>
            <div className="flex items-center justify-between py-2 last:pb-0">
              <span className="flex items-center gap-1.5 text-xs text-[#9AA1B4]"><ClipboardList size={13} className="text-violet-400" /> Department</span>
              <span className="text-xs font-semibold text-white truncate max-w-[120px]">{profile.department || "—"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5">
        <AnnouncementCard announcement={announcement} onClick={() => navigate(`${basePath}/communications/${announcement.id}`)} />
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
          <QuickActionCard icon={Users} label="Attendance" tone="blue" onClick={() => attendanceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
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
            {todaysTasks.map((t) => (
              <TaskRow key={t.id} task={t} onClick={() => navigate(`${basePath}/tasks/${t.id}`)} />
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
        <div className="flex gap-2">
          <ActivityMetricCard icon={CalendarCheck2} value={periodCompletedCount} label="Completed" tone="emerald" />
          <ActivityMetricCard icon={Clock} value={hoursLabel(periodHours)} label="Hours" tone="orange" />
          <ActivityMetricCard icon={CheckCircle2} value={complianceLabel} label="Compliance" tone="emerald" />
          <ActivityMetricCard icon={BarChart3} value={performanceLabel} label="Performance" tone="violet" />
        </div>
      </section>

      <section ref={attendanceRef} className="scroll-mt-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Attendance</h2>
        <AttendanceSection />
      </section>
    </div>
  );
}
