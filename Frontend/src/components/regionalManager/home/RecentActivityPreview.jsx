import {
  ChevronRight, ShoppingCart, Tag, PackageX, Sparkles, Wrench, ClipboardList, LayoutGrid,
  Activity as ActivityIcon,
} from "lucide-react";

// Same category vocabulary RmMarketActivitiesPage.jsx already uses for
// this exact feed — kept identical on purpose so one activity never
// reads as two different things depending on which screen shows it.
const CATEGORY_STYLE = {
  REFILLING: { icon: ShoppingCart, tone: "text-emerald-400 bg-emerald-500/10" },
  LABEL_CHECKING: { icon: Tag, tone: "text-sky-400 bg-sky-500/10" },
  EXPIRED_ITEMS: { icon: PackageX, tone: "text-amber-400 bg-amber-500/10" },
  DAILY_CLEANING: { icon: Sparkles, tone: "text-violet-400 bg-violet-500/10" },
  SHELF_CLEANING: { icon: Sparkles, tone: "text-violet-400 bg-violet-500/10" },
  PRODUCT_CUSTOMIZATION: { icon: Wrench, tone: "text-[#F47A20] bg-[#F47A20]/10" },
  ITEM_COUNTING: { icon: ClipboardList, tone: "text-sky-400 bg-sky-500/10" },
  FACING: { icon: LayoutGrid, tone: "text-emerald-400 bg-emerald-500/10" },
};

const CATEGORY_LABEL = {
  REFILLING: "Refilled a section",
  LABEL_CHECKING: "Checked a label",
  EXPIRED_ITEMS: "Removed expired products",
  DAILY_CLEANING: "Completed cleaning",
  SHELF_CLEANING: "Completed shelf cleaning",
  PRODUCT_CUSTOMIZATION: "Customized a product",
  ITEM_COUNTING: "Counted items",
  FACING: "Adjusted facing",
};

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// RecentActivityPreview.jsx — a two-row teaser of the real zone activity
// feed (GET /api/activities/company, self-scoped to this RM's zones).
// Deliberately capped at two: the full chronological history lives on
// the Activities page this links to, so Home can never grow into an
// activity feed.
export default function RecentActivityPreview({ activities, onViewAll, loading }) {
  const items = (activities ?? []).slice(0, 2);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
          Recent Activity
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-0.5 text-[11.5px] font-medium text-[#F47A20] transition-colors hover:text-[#ff9a4d]"
        >
          View All <ChevronRight size={13} />
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 px-3.5 backdrop-blur-xl">
        {loading ? (
          <div className="space-y-2 py-3">
            <div className="h-8 animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-8 animate-pulse rounded-lg bg-white/[0.05]" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-[#8B93A8]">No activity logged yet</p>
        ) : (
          items.map((a, i) => {
            const style = CATEGORY_STYLE[a.category] ?? { icon: ActivityIcon, tone: "text-[#9AA1B4] bg-white/[0.06]" };
            const Icon = style.icon;
            const who = a.employee?.name ?? a.submittedByStaff?.name ?? "Someone";
            const market = a.employee?.market?.name ?? a.market?.name;
            return (
              <div key={a.id} className={`flex items-center gap-2.5 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${style.tone}`}>
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-white">{who}</p>
                  <p className="truncate text-[11px] text-[#8B93A8]">
                    {CATEGORY_LABEL[a.category] ?? "Logged an activity"}
                    {market ? ` — ${market}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[10.5px] text-[#5C6479]">{timeAgo(a.date)}</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
