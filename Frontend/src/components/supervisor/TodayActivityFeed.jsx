import { useMemo, useState } from "react";
import { CheckCircle2, PackageX, ClipboardList, Sparkles } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import { listActivitiesForMarket } from "../../services/activityService";
import { listItemReportsForMarket } from "../../services/itemReportService";
import { listWastedOverallReportsForMarket } from "../../services/wastedOverallService";
import { listSuddenTasks } from "../../services/suddenTaskService";

const CATEGORY_LABEL = {
  EXPIRED_ITEMS: "expired items", SHELF_CLEANING: "shelf cleaning", PRODUCT_CUSTOMIZATION: "product customization",
  DAILY_CLEANING: "daily cleaning", ITEM_COUNTING: "item counting", LABEL_CHECKING: "a label issue",
  FACING: "facing", REFILLING: "refilling",
};
const WASTED_LABEL = { EGGS: "eggs", TOMATO: "tomato", POTATO: "potato", CUCUMBER: "cucumber", ONION: "onion", OTHER: "other" };

function wastedItemLabel(w) {
  if (w.item === "OTHER" && w.otherItemName) return w.otherItemName;
  return WASTED_LABEL[w.item] ?? w.item.toLowerCase();
}
function wastedQuantityLabel(w) {
  return w.item === "EGGS" ? `${w.quantityCount} egg${w.quantityCount === 1 ? "" : "s"}` : `${w.quantityKg}kg`;
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// TodayActivityFeed.jsx — a real, automatic feed of what happened in the
// Supervisor's market today, merged from every real source that already
// exists: Activities (shelf cleaning, facing, item counting, etc.),
// Expired/Wasted Item reports, Wasted Overall reports, and completed
// Sudden Tasks. Nothing here is invented — this is "Automatically
// Received Information" (spec category A), a pure read/merge over
// endpoints that already exist, sorted by time, today only.
export default function TodayActivityFeed({ marketId }) {
  const { data, error, loading, reload } = useAsync(
    async () => {
      const [activities, itemReports, wasted, suddenTasks] = await Promise.all([
        listActivitiesForMarket({ marketId }),
        listItemReportsForMarket({ marketId }),
        listWastedOverallReportsForMarket({ marketId }),
        listSuddenTasks({ status: "COMPLETED" }),
      ]);

      const items = [
        ...activities.map((a) => ({
          id: `activity-${a.id}`,
          kind: "ACTIVITY",
          icon: Sparkles,
          employeeName: a.employee?.name ?? "Unknown",
          title: `completed ${CATEGORY_LABEL[a.category] ?? a.category.toLowerCase()}`,
          subtitle: a.notes || (a.images?.length ? `${a.images.length} photo(s)` : null),
          timestamp: a.updatedAt ?? a.createdAt,
          raw: a,
        })),
        ...itemReports.map((r) => ({
          id: `item-report-${r.id}`,
          kind: "ITEM_REPORT",
          icon: PackageX,
          employeeName: r.employee?.name ?? "Unknown",
          title: `reported ${r.condition === "EXPIRED" ? "expired" : "wasted"} items`,
          subtitle: `${r.product?.name ?? "Item"} × ${r.quantity}`,
          timestamp: r.reportedAt,
          raw: r,
        })),
        ...wasted.map((w) => ({
          id: `wasted-${w.id}`,
          kind: "WASTED_OVERALL",
          icon: PackageX,
          employeeName: w.employee?.name ?? "Unknown",
          title: "submitted a waste report",
          subtitle: `${wastedItemLabel(w)} — ${wastedQuantityLabel(w)}`,
          timestamp: w.reportedAt,
          raw: w,
        })),
        ...suddenTasks.map((t) => ({
          id: `sudden-task-${t.id}`,
          kind: "SUDDEN_TASK",
          icon: CheckCircle2,
          employeeName: t.employee?.name ?? "Unknown",
          title: `completed "${t.title}"`,
          subtitle: null,
          timestamp: t.completedAt ?? t.assignedAt,
          raw: t,
        })),
      ]
        .filter((item) => isToday(item.timestamp))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return items;
    },
    { deps: [marketId], fallbackError: "Could not load today's activity." }
  );

  const [selected, setSelected] = useState(null);

  if (loading) return <SkeletonCard className="h-40" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  if (data.length === 0) {
    return (
      <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
        <ClipboardList size={22} className="mx-auto text-[#4C5266] mb-2" />
        <p className="text-sm text-[#8B93A8]">No activity yet today.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {data.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="w-full text-left flex items-start gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
            >
              <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">
                  <span className="font-semibold">{item.employeeName}</span> {item.title}
                </p>
                {item.subtitle && <p className="text-xs text-[#8B93A8] mt-0.5">{item.subtitle}</p>}
                <p className="text-[11px] text-[#4C5266] mt-1">{timeLabel(item.timestamp)}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.employeeName}` : ""}>
        {selected && <FeedItemDetail item={selected} />}
      </Modal>
    </>
  );
}

function FeedItemDetail({ item }) {
  const { raw, kind } = item;
  const row = (label, value) =>
    value != null && value !== "" ? (
      <div className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-white/[0.05] last:border-0">
        <span className="text-[#8B93A8]">{label}</span>
        <span className="text-white text-right">{value}</span>
      </div>
    ) : null;

  return (
    <div>
      {row("Date", new Date(item.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))}
      {row("Time", new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))}

      {kind === "ACTIVITY" && (
        <>
          {row("Category", CATEGORY_LABEL[raw.category] ?? raw.category)}
          {row("Status", raw.status)}
          {row("Notes", raw.notes)}
        </>
      )}
      {kind === "ITEM_REPORT" && (
        <>
          {row("Item", raw.product?.name)}
          {row("Barcode", raw.product?.barcode)}
          {row("Condition", raw.condition)}
          {row("Quantity", raw.quantity)}
          {row("Status", raw.status)}
          {row("Notes", raw.notes)}
        </>
      )}
      {kind === "WASTED_OVERALL" && (
        <>
          {row("Item", wastedItemLabel(raw))}
          {row("Quantity", wastedQuantityLabel(raw))}
          {row("Status", raw.status)}
          {row("Notes", raw.notes)}
        </>
      )}
      {kind === "SUDDEN_TASK" && (
        <>
          {row("Task", raw.title)}
          {row("Description", raw.description)}
          {row("Priority", raw.priority)}
        </>
      )}

      {raw.imageUrl && <img src={raw.imageUrl} alt="" className="mt-3 rounded-lg w-full max-h-64 object-cover" />}
      {raw.photoUrl && <img src={raw.photoUrl} alt="" className="mt-3 rounded-lg w-full max-h-64 object-cover" />}
      {raw.images?.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {raw.images.map((img) => (
            <img key={img.id} src={img.url} alt="" className="rounded-lg aspect-square object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}
