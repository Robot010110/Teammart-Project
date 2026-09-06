import { useMemo, useState } from "react";
import {
  MessageCircle, ChevronLeft, ChevronRight, Sparkles, PackageX, ClipboardList,
  CalendarCheck, Phone, Image as ImageIcon, Clock3, MapPin, Star, Store, LayoutGrid,
} from "lucide-react";
import Modal from "../components/common/Modal";
import ErrorBanner from "../components/common/ErrorBanner";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ActivityStatusPill from "../components/common/ActivityStatusPill";
import { useAsync } from "../hooks/useAsync";
import { employeeState } from "../components/regionalManager/market/MarketEmployeeCard";
import { initialsOfName } from "../components/regionalManager/market/activityMeta";
import { getEmployee } from "../services/staffEmployeeService";
import { getMarketOverview } from "../services/marketManagementService";
import { getEmployeeAttendanceMonth, listExtraHoursRequestsForMarket } from "../services/attendanceService";
import { listActivitiesForMarket } from "../services/activityService";
import { listItemReportsForMarket } from "../services/itemReportService";
import { listWastedOverallReportsForMarket } from "../services/wastedOverallService";
import { listSuddenTasks } from "../services/suddenTaskService";
import { listCountingAssignmentsForMarket } from "../services/countingAssignmentService";

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

const LIVE_STATE = {
  ACTIVE: { label: "Active", chip: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30", dot: "bg-emerald-400" },
  ON_BREAK: { label: "On Break", chip: "bg-amber-500/15 text-amber-400 ring-amber-500/30", dot: "bg-amber-400" },
  OFF_SHIFT: { label: "Off Shift", chip: "bg-[#0D1424]/90 text-[#8B93A8] ring-white/10", dot: "bg-[#4C5266]" },
};

function InfoRow({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tone}`}>
        <Icon size={14} />
      </span>
      <span className="text-[12px] text-[#8B93A8]">{label}</span>
      <span className="ml-auto min-w-0 truncate text-right text-[12.5px] font-medium text-white">{value}</span>
    </div>
  );
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

  // Live shift state + the market's display name. getEmployee returns the
  // stored row only; the market overview is where this app computes
  // today's real attendance state (utils/employeeStatus.js), so this
  // reads it from there rather than re-deriving a second version of it.
  const { data: marketOverview } = useAsync(() => getMarketOverview(marketId), { deps: [marketId] });
  const live = useMemo(
    () => marketOverview?.employees?.find((e) => e.id === employeeId) ?? null,
    [marketOverview, employeeId]
  );
  const marketName = marketOverview?.name ?? null;

  // Performance, using the backend's own documented rule so this figure
  // and the employee's own Performance screen can never disagree:
  // approved ÷ (approved + rejected); null when nothing is reviewed yet.
  const { data: ownActivities } = useAsync(
    () => listActivitiesForMarket({ marketId, employeeId }),
    { deps: [marketId, employeeId] }
  );
  const performance = useMemo(() => {
    const list = ownActivities ?? [];
    const approved = list.filter((a) => a.status === "APPROVED").length;
    const rejected = list.filter((a) => a.status === "REJECTED").length;
    const totalReviewed = approved + rejected;
    return { approved, rejected, totalReviewed, rate: totalReviewed > 0 ? (approved / totalReviewed) * 100 : null };
  }, [ownActivities]);

  const { data: events, error: eventsError, loading: eventsLoading } = useAsync(
    async () => {
      const [activities, itemReports, wasted, tasks, extraHours, countingAssignments] = await Promise.all([
        listActivitiesForMarket({ marketId, employeeId }),
        listItemReportsForMarket({ marketId, employeeId }),
        listWastedOverallReportsForMarket({ marketId, employeeId }),
        listSuddenTasks({ employeeId, status: "COMPLETED" }),
        listExtraHoursRequestsForMarket({ marketId, employeeId }),
        listCountingAssignmentsForMarket({ marketId, employeeId }),
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
        // Extra Hours spec §10: "Related tasks... Reasons for additional
        // hours" belongs in this same audit-trail timeline, not a
        // separate screen.
        ...extraHours.map((r) => ({
          id: `extra-hours-${r.id}`,
          icon: Clock3,
          title: `Declared ${r.hours} extra hour${r.hours === 1 ? "" : "s"}`,
          subtitle:
            (r.reason ? `${r.reason} — ` : "") +
            (r.hasAttendanceRecord ? `attendance shows ${r.attendanceExtraHours?.toFixed(2)}h` : "no attendance record for that date"),
          status: r.status,
          timestamp: r.createdAt,
          images: [],
        })),
        // Inventory Counting spec §10: "Inventory-counting assignments"
        // is one of the review items the spec explicitly lists.
        ...countingAssignments.map((a) => ({
          id: `counting-${a.id}`,
          icon: MapPin,
          title: `Assigned to count ${a.assignedDepartment}${a.countingArea ? ` — ${a.countingArea}` : ""}`,
          subtitle: a.needsVerification
            ? a.verifiedAt
              ? `Verified by ${a.verifiedBy?.name ?? "Regional/Zone Manager"}`
              : "Awaiting Regional/Zone Manager verification"
            : `Assigned by ${a.assignedBy?.name ?? "Supervisor"}`,
          status: a.needsVerification ? (a.verifiedAt ? "APPROVED" : "PENDING") : "APPROVED",
          timestamp: a.createdAt,
          images: [],
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

  const liveState = live ? employeeState(live) : null;
  const stateCfg = liveState ? LIVE_STATE[liveState] : null;

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-4 pt-4 sm:max-w-3xl sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to employees"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/10 active:scale-95"
        >
          <ChevronLeft size={17} />
        </button>
        {employee.whatsappNumber && (
          <a
            href={`https://wa.me/${employee.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11.5px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/15"
          >
            <Phone size={12} /> {employee.whatsappNumber}
          </a>
        )}
      </div>

      {/* Identity — avatar, live state, name, role, employee code. */}
      <div className="mt-3 flex flex-col items-center text-center">
        <div className="relative">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[26px] font-bold text-white ring-2 ring-[#F47A20]/45 shadow-[0_0_28px_-6px_rgba(244,122,32,0.6)]">
            {employee.profilePictureUrl ? (
              <AuthenticatedImage src={employee.profilePictureUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
            ) : (
              initialsOfName(employee.name)
            )}
          </span>
          {stateCfg && (
            <span
              className={`absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-semibold ring-1 ring-inset backdrop-blur-md ${stateCfg.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${stateCfg.dot}`} />
              {stateCfg.label}
            </span>
          )}
        </div>

        <h1 className="mt-4 font-display text-[22px] font-bold leading-tight text-white">{employee.name}</h1>
        <p className="mt-0.5 text-[13px] text-[#9AA1B4]">{employee.position}</p>
        {employee.employeeCode && <p className="mt-0.5 text-[11.5px] tabular-nums text-[#5C6479]">{employee.employeeCode}</p>}
      </div>

      {/* Quick actions — only the ones this app can genuinely do. */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {employee.whatsappNumber ? (
          <a
            href={`https://wa.me/${employee.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 py-3 backdrop-blur-xl transition-all duration-200 hover:border-[#F47A20]/30 active:scale-[0.97]"
          >
            <Phone size={17} className="text-emerald-400" />
            <span className="text-[11px] font-medium text-[#C4C9D6]">WhatsApp</span>
          </a>
        ) : (
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.05] bg-[#111A2D]/40 py-3 opacity-50">
            <Phone size={17} className="text-[#5C6479]" />
            <span className="text-[11px] font-medium text-[#5C6479]">No number</span>
          </div>
        )}
        <button
          type="button"
          onClick={onOpenChat}
          disabled={!onOpenChat}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 py-3 backdrop-blur-xl transition-all duration-200 hover:border-[#F47A20]/30 active:scale-[0.97] disabled:opacity-50"
        >
          <MessageCircle size={17} className="text-[#F47A20]" />
          <span className="text-[11px] font-medium text-[#C4C9D6]">Message</span>
        </button>
      </div>

      {/* Assignment details — every row a real stored field. */}
      <div className="mt-2.5 divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 px-3.5 backdrop-blur-xl">
        <InfoRow icon={Store} label="Market" value={marketName ?? "—"} tone="text-[#F47A20] bg-[#F47A20]/10" />
        <InfoRow icon={LayoutGrid} label="Department" value={employee.department || "Unassigned"} tone="text-sky-400 bg-sky-500/10" />
        <InfoRow icon={Clock3} label="Shift" value={employee.shift || employee.operationalShift || employee.cashierShift || "—"} tone="text-violet-400 bg-violet-500/10" />
        <InfoRow
          icon={CalendarCheck}
          label="Employment Date"
          value={employee.startDate ? new Date(employee.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not recorded"}
          tone="text-emerald-400 bg-emerald-500/10"
        />
      </div>

      {/* Performance — computed from this employee's own reviewed
          activities using the backend's exact rule (approved ÷ approved+
          rejected; see activitiesController.computeActivityPerformance).
          Employee.performanceRate exists in the schema but nothing
          writes to it yet, so it is deliberately NOT read here. */}
      <div className="mt-2.5 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20">
            <Star size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-[#8B93A8]">Performance Rate</p>
            <p className="font-display text-[22px] font-bold leading-none text-white">
              {performance.rate == null ? "—" : `${Math.round(performance.rate)}%`}
            </p>
          </div>
          <span className="shrink-0 text-right text-[10.5px] leading-tight text-[#5C6479]">
            {performance.totalReviewed} reviewed
            <br />
            {performance.approved} approved
          </span>
        </div>
        <div className="mt-2.5 h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#F47A20] to-[#FFB35C] transition-[width] duration-1000 ease-out"
            style={{
              width: `${performance.rate ?? 0}%`,
              boxShadow: performance.rate ? "0 0 10px -1px rgba(244,122,32,0.65)" : "none",
            }}
          />
        </div>
        {performance.rate == null && (
          <p className="mt-2 text-[11px] text-[#5C6479]">No reviewed activity yet — a rate appears once work is approved or rejected.</p>
        )}
      </div>

      {attendance && (
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatChip icon={CalendarCheck} label="Attendance Rate" value={attendance.summary.attendanceRate != null ? `${Math.round(attendance.summary.attendanceRate)}%` : "—"} />
          <StatChip icon={ClipboardList} label="Hours Worked" value={`${attendance.summary.totalHoursWorked.toFixed(1)}h`} />
          <StatChip icon={Clock3} label="Extra Hours (attendance)" value={`${attendance.summary.extraHours.toFixed(1)}h`} />
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
            <AuthenticatedImage key={i} src={url} alt="" className="rounded-lg w-full aspect-square object-cover" />
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
