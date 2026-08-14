import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, PackageX, Sparkles, Hash, CheckCircle2, Tag, Layers } from "lucide-react";
import ActivityCalendarScreen from "./ActivityCalendarScreen";
import { listActivitiesForMarket } from "../../services/activityService";
import { listItemReportsForMarket } from "../../services/itemReportService";
import { listWastedOverallReportsForMarket } from "../../services/wastedOverallService";
import { listSuddenTasks } from "../../services/suddenTaskService";

// Month range helper — every fetchMonth below asks for one calendar
// month's worth of one employee's records via the real market-scoped
// staff endpoints (activities/market, item-reports/market, wasted-
// overall/market — see backend), filtered client-side to the month
// (none of those endpoints take year/month, only Activity dates are
// already granular per-record, so this is a plain filter, not a
// separate query pattern per category).
function inMonth(dateIso, year, month) {
  const d = new Date(dateIso);
  return d.getFullYear() === year && d.getMonth() === month - 1;
}

function detailRow(label, value) {
  return value != null && value !== "" ? (
    <div className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-white/[0.05] last:border-0">
      <span className="text-[#8B93A8]">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  ) : null;
}

const CATEGORY_LABEL = { ITEM_COUNTING: "Counting Items", SHELF_CLEANING: "Shelf Cleaning", DAILY_CLEANING: "Daily Cleaning", FACING: "Facing", REFILLING: "Refilling", PRODUCT_CUSTOMIZATION: "Product Customization", LABEL_CHECKING: "Label Checking" };

function CATEGORIES(employeeId) {
  return [
    {
      key: "EXPIRED_ITEMS", label: "Expired Items", icon: PackageX,
      fetchMonth: async (year, month) => {
        const reports = await listItemReportsForMarket({ employeeId, condition: "EXPIRED" });
        return reports.filter((r) => inMonth(r.reportedAt, year, month)).map((r) => ({ date: r.reportedAt, raw: r }));
      },
      renderDetail: (item) => (
        <div>
          {detailRow("Item", item.raw.product?.name)}
          {detailRow("Quantity", item.raw.quantity)}
          {detailRow("Status", item.raw.status)}
          {detailRow("Notes", item.raw.notes)}
          {detailRow("Time", new Date(item.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))}
          {item.raw.imageUrl && <img src={item.raw.imageUrl} alt="" className="mt-3 rounded-lg w-full max-h-56 object-cover" />}
        </div>
      ),
    },
    {
      key: "WASTE", label: "Waste", icon: PackageX,
      fetchMonth: async (year, month) => {
        const [itemReports, wastedOverall] = await Promise.all([
          listItemReportsForMarket({ employeeId, condition: "WASTED" }),
          listWastedOverallReportsForMarket({}).then((all) => all.filter((w) => w.employeeId === employeeId)),
        ]);
        return [
          ...itemReports.filter((r) => inMonth(r.reportedAt, year, month)).map((r) => ({ date: r.reportedAt, raw: { ...r, wasteKind: "item" } })),
          ...wastedOverall.filter((w) => inMonth(w.reportedAt, year, month)).map((w) => ({ date: w.reportedAt, raw: { ...w, wasteKind: "overall" } })),
        ];
      },
      renderDetail: (item) => (
        <div>
          {item.raw.wasteKind === "item" ? (
            <>
              {detailRow("Item", item.raw.product?.name)}
              {detailRow("Quantity", item.raw.quantity)}
            </>
          ) : (
            <>
              {detailRow("Item", item.raw.item)}
              {detailRow("Quantity", `${item.raw.quantityKg} kg`)}
            </>
          )}
          {detailRow("Status", item.raw.status)}
          {detailRow("Notes", item.raw.notes)}
          {(item.raw.imageUrl || item.raw.photoUrl) && (
            <img src={item.raw.imageUrl || item.raw.photoUrl} alt="" className="mt-3 rounded-lg w-full max-h-56 object-cover" />
          )}
        </div>
      ),
    },
    {
      key: "ITEM_COUNTING", label: "Counting Items", icon: Hash,
      fetchMonth: async (year, month) => {
        const activities = await listActivitiesForMarket({ employeeId, category: "ITEM_COUNTING" });
        return activities.filter((a) => inMonth(a.date, year, month)).map((a) => ({ date: a.date, note: a.notes || undefined, raw: a }));
      },
      renderDetail: (item) => (
        <div>
          {detailRow("Time", item.raw.time)}
          {detailRow("Status", item.raw.status)}
          {detailRow("Notes", item.raw.notes)}
        </div>
      ),
    },
    {
      key: "SHELF_CLEANING", label: "Shelf Cleaning", icon: Sparkles,
      fetchMonth: async (year, month) => {
        const activities = await listActivitiesForMarket({ employeeId, category: "SHELF_CLEANING" });
        return activities.filter((a) => inMonth(a.date, year, month)).map((a) => ({ date: a.date, note: a.notes || undefined, raw: a }));
      },
      renderDetail: (item) => (
        <div>{detailRow("Time", item.raw.time)}{detailRow("Status", item.raw.status)}{detailRow("Notes", item.raw.notes)}</div>
      ),
    },
    {
      key: "DAILY_CLEANING", label: "Daily Cleaning", icon: Sparkles,
      fetchMonth: async (year, month) => {
        const activities = await listActivitiesForMarket({ employeeId, category: "DAILY_CLEANING" });
        return activities.filter((a) => inMonth(a.date, year, month)).map((a) => ({ date: a.date, note: a.notes || undefined, raw: a }));
      },
      renderDetail: (item) => (
        <div>{detailRow("Time", item.raw.time)}{detailRow("Status", item.raw.status)}{detailRow("Notes", item.raw.notes)}</div>
      ),
    },
    {
      key: "TASKS", label: "Tasks", icon: CheckCircle2,
      fetchMonth: async (year, month) => {
        const tasks = await listSuddenTasks({ employeeId, status: "COMPLETED" });
        return tasks.filter((t) => t.completedAt && inMonth(t.completedAt, year, month)).map((t) => ({ date: t.completedAt, raw: t }));
      },
      renderDetail: (item) => (
        <div>{detailRow("Task", item.raw.title)}{detailRow("Description", item.raw.description)}{detailRow("Priority", item.raw.priority)}</div>
      ),
    },
    {
      key: "LABEL_ISSUES", label: "Label Checking", icon: Tag,
      fetchMonth: async (year, month) => {
        const activities = await listActivitiesForMarket({ employeeId, category: "LABEL_CHECKING" });
        return activities.filter((a) => inMonth(a.date, year, month)).map((a) => ({ date: a.date, note: a.notes || undefined, raw: a }));
      },
      renderDetail: (item) => (
        <div>{detailRow("Issue", item.raw.labelIssueType)}{detailRow("Status", item.raw.status)}{detailRow("Notes", item.raw.notes)}</div>
      ),
    },
    {
      key: "OTHER", label: "Other Activities", icon: Layers,
      fetchMonth: async (year, month) => {
        const [facing, refilling, custom] = await Promise.all([
          listActivitiesForMarket({ employeeId, category: "FACING" }),
          listActivitiesForMarket({ employeeId, category: "REFILLING" }),
          listActivitiesForMarket({ employeeId, category: "PRODUCT_CUSTOMIZATION" }),
        ]);
        return [...facing, ...refilling, ...custom]
          .filter((a) => inMonth(a.date, year, month))
          .map((a) => ({ date: a.date, note: a.notes || undefined, raw: a }));
      },
      renderDetail: (item) => (
        <div>{detailRow("Category", CATEGORY_LABEL[item.raw.category] || item.raw.category)}{detailRow("Time", item.raw.time)}{detailRow("Status", item.raw.status)}{detailRow("Notes", item.raw.notes)}</div>
      ),
    },
  ];
}

function CategoryPicker({ employeeId, onBack, basePath }) {
  const categories = CATEGORIES(employeeId);
  const navigate = useNavigate();

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-lg font-semibold text-white mb-4">Activity History</h1>

      <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]">
        {categories.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(`${basePath}/${key}`)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <Icon size={17} className="text-[#8B93A8]" />
            <span className="flex-1 text-sm text-white">{label}</span>
            <ChevronRight size={16} className="text-[#4C5266]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryCalendarRoute({ employeeId, basePath }) {
  const { category } = useParams();
  const navigate = useNavigate();
  const cat = CATEGORIES(employeeId).find((c) => c.key === category);
  if (!cat) return null;

  return (
    <ActivityCalendarScreen
      title={cat.label}
      onBack={() => navigate(basePath)}
      fetchMonth={cat.fetchMonth}
      renderDetail={cat.renderDetail}
    />
  );
}

// EmployeeActivityHistoryScreen.jsx — category picker feeding the one
// reusable ActivityCalendarScreen (spec §11/§12). Labeled "Activity
// History" here (not "My Activities" — that label is reserved for the
// employee's own first-person view elsewhere in the app). Category
// selection is a real route (:category) under `basePath`, not local
// state, so Back from a category's calendar returns to the picker as a
// real history entry.
export default function EmployeeActivityHistoryScreen({ employeeId, onBack, basePath }) {
  return (
    <Routes>
      <Route index element={<CategoryPicker employeeId={employeeId} onBack={onBack} basePath={basePath} />} />
      <Route path=":category" element={<CategoryCalendarRoute employeeId={employeeId} basePath={basePath} />} />
    </Routes>
  );
}
