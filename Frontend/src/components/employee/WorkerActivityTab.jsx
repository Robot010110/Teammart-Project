import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tag, PackageX, Building2, Sparkles, Palette, ClipboardList,
  CalendarCheck2, Clock, CheckCircle2, BarChart3, PackagePlus,
} from "lucide-react";
import SubmitTaskModal from "../workspace/SubmitTaskModal";
import ItemReportSection from "./ItemReportSection";
import ShelfLabelFlow from "./ShelfLabelFlow";
import WastedOverallFlow from "./WastedOverallFlow";
import DepartmentClosingFlow from "./DepartmentClosingFlow";
import InventoryCountingSection from "./InventoryCountingSection";
import QuickReportRow from "./QuickReportRow";
import ActivityMetricCard from "./ActivityMetricCard";
import ActivityCarousel from "./ActivityCarousel";
import DailyActivityCard from "./DailyActivityCard";
import TaskRow from "./TaskRow";
import ActivityStatusPill from "../common/ActivityStatusPill";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import Toast from "../common/Toast";
import { ACTIVITY_SUBMISSION_OPTIONS } from "../../data/workspaceData";
import { listMyWastedOverallReports } from "../../services/wastedOverallService";
import { listSuddenTasks } from "../../services/suddenTaskService";
import { getPerformanceSummary } from "../../services/activityService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

const WASTED_ITEM_LABEL = { EGGS: "Eggs", TOMATO: "Tomato", POTATO: "Potato", CUCUMBER: "Cucumber", ONION: "Onion", OTHER: "Other" };
const SHELF_CLEANING_OPTION = ACTIVITY_SUBMISSION_OPTIONS.find((o) => o.category === "SHELF_CLEANING");
const PRODUCT_CUSTOMIZATION_OPTION = ACTIVITY_SUBMISSION_OPTIONS.find((o) => o.category === "PRODUCT_CUSTOMIZATION");
const DAILY_CLEANING_OPTION = ACTIVITY_SUBMISSION_OPTIONS.find((o) => o.category === "DAILY_CLEANING");

function wastedItemLabel(report) {
  if (report.item === "OTHER" && report.otherItemName) return report.otherItemName;
  return WASTED_ITEM_LABEL[report.item] || report.item;
}
function wastedQuantityLabel(report) {
  return report.item === "EGGS" ? `${report.quantityCount} egg${report.quantityCount === 1 ? "" : "s"}` : `${report.quantityKg}kg`;
}
function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// WorkerActivityTab.jsx — Activity tab, redesigned to match the
// reference mobile mockup (Today Overview / Quick Reports / Daily
// Activities carousel / My Tasks) while keeping every existing
// submission flow exactly as it worked before this pass — only the
// presentation changed, not the underlying architecture:
//   - Quick Reports rows open the same real flow components this tab
//     already used (ShelfLabelFlow/DepartmentClosingFlow/
//     WastedOverallFlow directly; Expired/Wasted Items opens
//     ItemReportSection — its report button AND month-scoped history —
//     inside a modal, so the redesign doesn't quietly drop the ability
//     to browse past item reports, which lives nowhere else in this app)
//     — "My Activities" (Activity-model history) still lives at
//     Profile -> Performance History, unchanged.
//   - "Cleaning Status"/"Product Customization" open the same generic
//     SubmitTaskModal + ACTIVITY_SUBMISSION_OPTIONS entries the old
//     "Other Daily Activities" grid used.
//   - "Daily Counting" un-orphans InventoryCountingSection.jsx (real,
//     fully built, just not mounted anywhere since Cleanup Phase §13) —
//     reused as-is inside a modal rather than rebuilt.
//   - "My Tasks" is real SuddenTask data (suddenTaskService.js), the
//     same model/endpoints the dedicated Tasks tab already uses.
//
// Today Overview's four numbers are all derived from real data, never
// invented:
//   - Completed / Pending: today's SuddenTasks by status.
//   - Performance: the existing GET /activities/performance approval
//     rate (activityService.getPerformanceSummary), same figure
//     HomeTab.jsx's PerformanceCircle already shows elsewhere.
//   - Compliance: this app has no stored "compliance" metric anywhere
//     (confirmed — no such field/endpoint exists), so rather than
//     inventing one, it's shown as the real completed/(completed+pending)
//     ratio for today's tasks — an honest arithmetic derivation of the
//     other two real numbers, not a fabricated figure. "—" when there's
//     nothing assigned today to compute a ratio from.
export default function WorkerActivityTab() {
  const navigate = useNavigate();
  const [toast, setToast] = useToast();

  const { data: wastedReports, setData: setWastedReports, error: wastedError, loading: wastedLoading, reload: loadWastedReports } = useAsync(
    listMyWastedOverallReports,
    { fallbackError: "Could not load your waste reports." }
  );
  // One fetch, sliced client-side by real status — My Tasks redesign
  // added a real IN_PROGRESS state between ASSIGNED and COMPLETED, so
  // "pending" here means "not yet completed" (ASSIGNED or IN_PROGRESS).
  const { data: allTasks } = useAsync(listSuddenTasks, { deps: [] });
  const pendingTasks = useMemo(() => (allTasks ?? []).filter((t) => t.status !== "COMPLETED"), [allTasks]);
  const completedTasks = useMemo(() => (allTasks ?? []).filter((t) => t.status === "COMPLETED"), [allTasks]);
  const { data: performance } = useAsync(getPerformanceSummary, { deps: [] });

  const [activeOption, setActiveOption] = useState(null);
  const [itemReportsOpen, setItemReportsOpen] = useState(false);
  const [labelFlowOpen, setLabelFlowOpen] = useState(false);
  const [wastedFlowOpen, setWastedFlowOpen] = useState(false);
  const [departmentClosingOpen, setDepartmentClosingOpen] = useState(false);
  const [countingOpen, setCountingOpen] = useState(false);

  const pendingWastedReports = (wastedReports ?? []).filter((r) => r.status === "PENDING");
  const completedToday = (completedTasks ?? []).filter((t) => isToday(t.completedAt));
  const pendingCount = (pendingTasks ?? []).length;
  const totalToday = completedToday.length + pendingCount;
  const complianceLabel = totalToday > 0 ? `${Math.round((completedToday.length / totalToday) * 100)}%` : "—";
  const performanceLabel = performance?.rate != null ? `${Math.round(performance.rate)}` : "—";

  const myTasks = [...(pendingTasks ?? []), ...completedToday].slice(0, 4);

  function handleWastedSaved(report, message) {
    setWastedReports((prev) => [report, ...(prev ?? [])]);
    setToast(message);
  }
  function handleSaved(activity, message) {
    setToast(message);
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">Activity</h1>
        <p className="text-sm text-[#8B93A8] mt-0.5">Track, report and keep your market running smoothly.</p>
      </div>

      <section className="mb-6 rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Today Overview</h2>
          <button type="button" onClick={() => navigate("/me/profile/performance")} className="text-xs font-semibold text-[#F47A20] hover:text-[#ff8b36]">
            View all
          </button>
        </div>
        <div className="flex gap-2">
          <ActivityMetricCard icon={CalendarCheck2} value={completedToday.length} label="Completed" tone="emerald" />
          <ActivityMetricCard icon={Clock} value={pendingCount} label="Pending" tone="orange" />
          <ActivityMetricCard icon={CheckCircle2} value={complianceLabel} label="Compliance" tone="emerald" />
          <ActivityMetricCard icon={BarChart3} value={performanceLabel} label="Performance" tone="violet" />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-white">Quick Reports</h2>
        <div className="space-y-2">
          <QuickReportRow
            icon={PackageX}
            title="Expired / Wasted Items"
            subtitle="Report expired or wasted products"
            onClick={() => setItemReportsOpen(true)}
          />
          <QuickReportRow
            icon={Tag}
            title="Label Issue"
            subtitle="Report label problems"
            onClick={() => setLabelFlowOpen(true)}
          />
          <QuickReportRow
            icon={Building2}
            title="Department Closing"
            subtitle="End of day closing report"
            onClick={() => setDepartmentClosingOpen(true)}
          />
          <QuickReportRow
            icon={PackageX}
            title="Waste Report"
            subtitle="Report wasted produce"
            badge={pendingWastedReports.length}
            onClick={() => setWastedFlowOpen(true)}
          />
          <QuickReportRow
            icon={PackagePlus}
            title="Daily Cleaning"
            subtitle="Report general daily cleaning"
            onClick={() => setActiveOption(DAILY_CLEANING_OPTION)}
          />
        </div>

        {wastedLoading ? (
          <div className="mt-3"><SkeletonCard className="h-16" /></div>
        ) : wastedError ? (
          <div className="mt-3"><ErrorBanner message={wastedError} onRetry={loadWastedReports} /></div>
        ) : pendingWastedReports.length ? (
          <div className="mt-3 space-y-2">
            {pendingWastedReports.slice(0, 3).map((r) => (
              <div key={r.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white">{wastedItemLabel(r)} — {wastedQuantityLabel(r)}</span>
                  <ActivityStatusPill status={r.status} />
                </div>
                <p className="mt-1 text-xs text-[#8B93A8]">{dateLabel(r.reportedAt)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-white">Daily Activities</h2>
        <ActivityCarousel>
          <DailyActivityCard
            icon={Sparkles}
            title="Cleaning Status"
            description="Report cleaning & hygiene"
            onClick={() => setActiveOption(SHELF_CLEANING_OPTION)}
          />
          <DailyActivityCard
            icon={Palette}
            title="Product Customization"
            description="Report display & adjustments"
            onClick={() => setActiveOption(PRODUCT_CUSTOMIZATION_OPTION)}
          />
          <DailyActivityCard
            icon={ClipboardList}
            title="Daily Counting"
            description="Report stock & inventory"
            onClick={() => setCountingOpen(true)}
          />
        </ActivityCarousel>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">My Tasks</h2>
          <button type="button" onClick={() => navigate("/me/tasks")} className="text-xs font-semibold text-[#F47A20] hover:text-[#ff8b36]">
            View all
          </button>
        </div>
        {myTasks.length === 0 ? (
          <p className="text-sm text-[#4C5266] text-center py-6">No tasks assigned right now.</p>
        ) : (
          <div className="space-y-2">
            {myTasks.map((t) => (
              <TaskRow key={t.id} task={t} onClick={() => navigate(`/me/tasks/${t.id}`)} />
            ))}
          </div>
        )}
      </section>

      <SubmitTaskModal option={activeOption} onClose={() => setActiveOption(null)} onSaved={handleSaved} />
      <ShelfLabelFlow open={labelFlowOpen} onClose={() => setLabelFlowOpen(false)} onSaved={handleSaved} />
      <WastedOverallFlow open={wastedFlowOpen} onClose={() => setWastedFlowOpen(false)} onSaved={handleWastedSaved} />
      <DepartmentClosingFlow open={departmentClosingOpen} onClose={() => setDepartmentClosingOpen(false)} onSaved={handleSaved} />

      <Modal open={itemReportsOpen} onClose={() => setItemReportsOpen(false)} title="Expired / Wasted Items">
        <ItemReportSection />
      </Modal>

      <Modal open={countingOpen} onClose={() => setCountingOpen(false)} title="Daily Counting">
        <InventoryCountingSection />
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
