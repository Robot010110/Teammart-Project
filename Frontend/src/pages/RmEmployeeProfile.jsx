import { useMemo, useState } from "react";
import {
  MessageCircle, ChevronLeft, ChevronRight, Sparkles, PackageX, ClipboardList,
  CalendarCheck, Phone, Image as ImageIcon,
} from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import Modal from "../components/common/Modal";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ActivityStatusPill from "../components/common/ActivityStatusPill";
import { useAsync } from "../hooks/useAsync";
import { getEmployee } from "../services/staffEmployeeService";
import { getEmployeeAttendanceMonth } from "../services/attendanceService";
import { listActivitiesForMarket } from "../services/activityService";
import { listItemReportsForMarket } from "../services/itemReportService";
import { listWastedOverallReportsForMarket } from "../services/wastedOverallService";
import { listSuddenTasks } from "../services/suddenTaskService";

const CATEGORY_LABEL = {
  EXPIRED_ITEMS: "expired items", SHELF_CLEANING: "shelf cleaning", PRODUCT_CUSTOMIZATION: "product customization",
  DAILY_CLEANING: "daily cleaning", ITEM_COUNTING: "item counting", LABEL_CHECKING: "a label issue",
  FACING: "facing", REFILLING: "refilling",
};

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dayKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
}
function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// RmEmployeeProfile.jsx — spec §11/§15-19: profile info (real, via
// GET /api/employees/:id + GET /api/profile shape), a real attendance
// summary for the current month, DM entry point, and a History Calendar
// merging every real recorded event (Activities, Expired/Wasted Item
// reports, Wasted Overall reports, completed Sudden Tasks — the exact
// same four sources Supervisor Mode's TodayActivityFeed already merges,
// generalized here across a whole month instead of just "today") — a day
// with at least one event is marked; clicking it opens the day's full
// timeline with evidence. Read-only throughout — no employee-level
// operational controls here (spec §12).
export default function RmEmployeeProfile({ marketId, employeeId, onBack, onOpenChat }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const { data: employee, error: empError, loading: empLoading, reload: reloadEmp } = useAsync(() => getEmployee(employeeId), { deps: [employeeId] });
  const { data: attendance } = useAsync(() => getEmployeeAttendanceMonth(employeeId, { year, month }), { deps: [employeeId, year, month] });

  const { data: events, error: eventsError, loading: eventsLoading } = useAsync(
    async () => {
      const [activities, itemReports, wasted, tasks] = await Promise.all([
        listActivitiesForMarket({ marketId, employeeId }),
        listItemReportsForMarket({ marketId, employeeId }),
        listWastedOverallReportsForMarket({ marketId, employeeId }),
        listSuddenTasks({ employeeId, status: "COMPLETED" }),
      ]);

      return [
        ...activities.map((a) => ({
          id: `activity-${a.id}`,
          icon: Sparkles,
          title: `Completed ${CATEGORY_LABEL[a.category] ?? a.category.toLowerCase()}`,
          subtitle: a.notes,
          status: a.status,
          timestamp: a.updatedAt ?? a.createdAt,
          images: a.images?.map((img) => img.url) ?? [],
        })),
        ...itemReports.map((r) => ({
          id: `item-${r.id}`,
          icon: PackageX,
          title: `Reported ${r.condition === "EXPIRED" ? "expired" : "wasted"} items`,
          subtitle: `${r.product?.name ?? "Item"} × ${r.quantity}`,
          status: r.status,
          timestamp: r.reportedAt,
          images: r.imageUrl ? [r.imageUrl] : [],
        })),
        ...wasted.map((r) => ({
          id: `wasted-${r.id}`,
          icon: PackageX,
          title: "Submitted a waste report",
          subtitle: r.item,
          status: r.status,
          timestamp: r.reportedAt,
          images: r.photoUrl ? [r.photoUrl] : [],
        })),
        ...tasks.map((t) => ({
          id: `task-${t.id}`,
          icon: ClipboardList,
          title: `Completed "${t.title}"`,
          subtitle: t.description,
          status: "APPROVED",
          timestamp: t.completedAt ?? t.assignedAt,
          images: t.evidenceUrl ? [t.evidenceUrl] : [],
        })),
      ];
    },
    { deps: [marketId, employeeId] }
  );

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const e of events ?? []) {
      const d = new Date(e.timestamp);
      if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
      const key = dayKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return map;
  }, [events, year, month]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday-first

  const selectedEvents = selectedDay ? (eventsByDay.get(dayKey(selectedDay)) ?? []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) : [];
  const [evidence, setEvidence] = useState(null);

  if (empLoading) return <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto"><SkeletonCard className="h-64" /></div>;
  if (empError) return <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto"><ErrorBanner message={empError} onRetry={reloadEmp} /></div>;

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto animate-fade-up">
      <Breadcrumb items={[{ label: "Market", onClick: onBack }, { label: employee.name }]} />

      <div className="mt-4 rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1D2D5C] to-[#324a8f] grid place-items-center ring-1 ring-white/10 text-lg font-bold text-white shrink-0">
            {employee.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-white">{employee.name}</h1>
            <p className="text-sm text-[#9AA1B4]">{employee.position}{employee.department ? ` · ${employee.department}` : ""} · {employee.employeeCode}</p>
            {employee.whatsappNumber && (
              <a href={`https://wa.me/${employee.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                <Phone size={11} /> {employee.whatsappNumber}
              </a>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenChat}
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors shrink-0"
        >
          <MessageCircle size={15} /> Message
        </button>
      </div>

      {attendance && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatChip icon={CalendarCheck} label="Attendance Rate" value={attendance.summary.attendanceRate != null ? `${Math.round(attendance.summary.attendanceRate)}%` : "—"} />
          <StatChip icon={ClipboardList} label="Hours Worked" value={`${attendance.summary.totalHoursWorked.toFixed(1)}h`} />
          <StatChip icon={ClipboardList} label="Days Off" value={attendance.summary.daysOff} />
        </div>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">History</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMonthOffset((o) => o - 1)} className="p-1.5 rounded-lg text-[#9AA1B4] hover:bg-white/[0.06] hover:text-white">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-white font-medium min-w-[120px] text-center">
              {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button type="button" onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))} disabled={monthOffset >= 0} className="p-1.5 rounded-lg text-[#9AA1B4] hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {eventsLoading ? (
          <SkeletonCard className="h-72" />
        ) : eventsError ? (
          <ErrorBanner message={eventsError} />
        ) : (
          <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase tracking-wide text-[#4C5266] mb-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstWeekday }).map((_, i) => <span key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const d = new Date(year, month - 1, day);
                const hasActivity = eventsByDay.has(dayKey(d));
                const isToday = isSameDay(d, now);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors ${
                      hasActivity
                        ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 font-semibold"
                        : "bg-white/[0.03] text-[#6B7280] hover:bg-white/[0.06]"
                    } ${isToday ? "ring-1 ring-[#F47A20]/60" : ""}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-[#4C5266]">
              <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/40 mr-1.5" /> At least one recorded activity — a neutral day just means nothing was recorded, not poor performance.
            </p>
          </div>
        )}
      </section>

      <Modal open={!!selectedDay} onClose={() => setSelectedDay(null)} title={selectedDay ? selectedDay.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-[#8B93A8] text-center py-6">Nothing recorded for this employee on this day.</p>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((ev) => {
              const Icon = ev.icon;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => ev.images.length && setEvidence(ev.images)}
                  className="w-full flex items-start gap-3 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06] text-left hover:border-[#F47A20]/25 transition-colors"
                >
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">{ev.title}</p>
                    {ev.subtitle && <p className="text-xs text-[#8B93A8] mt-0.5">{ev.subtitle}</p>}
                    <p className="text-[11px] text-[#4C5266] mt-1 flex items-center gap-2">
                      {timeLabel(ev.timestamp)}
                      {ev.images.length > 0 && <span className="flex items-center gap-1 text-[#F47A20]"><ImageIcon size={10} /> {ev.images.length}</span>}
                    </p>
                  </div>
                  <ActivityStatusPill status={ev.status} />
                </button>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal open={!!evidence} onClose={() => setEvidence(null)} title="Evidence">
        <div className="grid grid-cols-2 gap-2">
          {evidence?.map((url, i) => (
            <img key={i} src={url} alt="" className="rounded-lg w-full aspect-square object-cover" />
          ))}
        </div>
      </Modal>
    </div>
  );
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06]">
      <p className="flex items-center gap-1.5 text-white font-bold text-base"><Icon size={14} className="text-[#8B93A8]" /> {value}</p>
      <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mt-1">{label}</p>
    </div>
  );
}
