import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, Info, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Crown,
  CreditCard, FileText, ClipboardList, Sparkles, PackageX, Tag, ShoppingCart, LayoutGrid, Wrench,
  Activity as ActivityIcon,
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import TotalSalesChart from "../components/regionalManager/TotalSalesChart";
import { getZoneSalesSummary } from "../services/totalSalesService";
import { getZoneCardSalesSummary } from "../services/cardSalesService";
import { listZoneActivities } from "../services/activityService";
import { CURRENCIES, formatCurrency } from "../utils/currency";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

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

function ActivityRow({ activity }) {
  const style = CATEGORY_STYLE[activity.category] ?? { icon: ActivityIcon, tone: "text-[#9AA1B4] bg-white/[0.06]" };
  const Icon = style.icon;
  const name = activity.employee?.name ?? activity.submittedByStaff?.name ?? "Someone";
  const marketName = activity.employee?.market?.name ?? activity.market?.name;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`grid place-items-center h-9 w-9 rounded-xl shrink-0 ${style.tone}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <p className="text-xs text-[#8B93A8] truncate">
          {CATEGORY_LABEL[activity.category] ?? "Logged an activity"}
          {marketName ? ` — ${marketName}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-[#4C5266]">{activity.time}</span>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </div>
    </div>
  );
}

// RmMarketActivitiesPage.jsx — Market Activities: the Regional Manager's
// "how are my markets doing right now" landing screen. Deliberately
// summary-only (Total Sales card, Card Sales completion card, a short
// Today's Zone Activity feed) — the market-by-market breakdown and the
// per-market Card Sales/reminder actions live one tap away on
// RmAllMarketsSalesPage.jsx / RmCardSalesZoneStatusPage.jsx, exactly the
// "summary first, details second" split the feature was designed around.
// Every number here is real: totalSalesService.getZoneSalesSummary and
// cardSalesService.getZoneCardSalesSummary both scope to this Regional
// Manager's own zone(s) server-side (see those controllers' own
// comments) — this page never guesses or receives a zone id from the
// frontend.
export default function RmMarketActivitiesPage() {
  const navigate = useNavigate();
  const [date] = useState(todayIso());
  const [currency, setCurrency] = useState("USD");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const { data: sales, error: salesError, loading: salesLoading, reload: reloadSales } = useAsync(
    () => getZoneSalesSummary({ date, days: 7 }),
    { deps: [date] }
  );
  const { data: cardSales, error: cardSalesError, loading: cardSalesLoading, reload: reloadCardSales } = useAsync(
    () => getZoneCardSalesSummary({ date }),
    { deps: [date] }
  );
  const { data: activities, error: activitiesError, loading: activitiesLoading, reload: reloadActivities } = useAsync(
    () => listZoneActivities({ take: 20 }),
    { deps: [] }
  );

  const activeCurrency = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
  const marketCount = cardSales ? cardSales.markets.length : 0;
  const completionPct = marketCount > 0 ? Math.round((cardSales.summary.completed / marketCount) * 100) : 0;
  const visibleActivities = showAllActivity ? (activities ?? []) : (activities ?? []).slice(0, 4);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto animate-fade-up pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Market Activities</h1>
          <p className="text-sm text-[#8B93A8] mt-0.5">Track performance across your zone</p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 bg-[#171C2E]/80 border border-white/[0.06] text-xs font-medium text-white">
          Today, {dateLabel(date)}
        </div>
      </div>

      {/* ---------------- Total Sales ---------------- */}
      <section className="mt-5 rounded-3xl p-5 bg-gradient-to-b from-[#241B4B] to-[#171C2E] border border-white/[0.08] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A9A6D9]">
            Total Sales of the Day <Info size={12} className="opacity-60" />
          </p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCurrencyOpen((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white bg-white/[0.08] hover:bg-white/[0.14] transition-colors"
            >
              {activeCurrency.code} <ChevronDown size={13} />
            </button>
            {currencyOpen && (
              <>
                <button type="button" aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setCurrencyOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden bg-[#1F2436] border border-white/[0.08] shadow-xl min-w-[130px]">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-colors ${
                        c.code === currency ? "text-[#F47A20] bg-white/[0.05]" : "text-[#D5D8E4] hover:bg-white/[0.05]"
                      }`}
                    >
                      {c.code} — {c.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {salesLoading ? (
          <div className="mt-4 h-32 rounded-xl bg-white/[0.03] animate-pulse" />
        ) : salesError ? (
          <div className="mt-4"><ErrorBanner message={salesError} onRetry={reloadSales} /></div>
        ) : (
          <>
            <p className="mt-3 flex items-baseline gap-1.5 text-white">
              <DollarSign size={22} className="text-white/70 shrink-0" />
              <span className="text-[2rem] leading-none font-display font-extrabold tracking-tight">
                {formatCurrency(sales.todayTotal, currency)}
              </span>
            </p>
            <p className={`mt-1.5 flex items-center gap-1 text-sm font-medium ${sales.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {sales.changePct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {sales.changePct >= 0 ? "+" : ""}{sales.changePct.toFixed(1)}% vs yesterday
            </p>

            <div className="mt-4">
              <TotalSalesChart trend={sales.trend} />
            </div>

            {sales.topMarkets.length > 0 && (
              <div className="mt-2 rounded-2xl p-3.5 bg-black/20 border border-white/[0.06]">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A9A6D9] mb-2.5">
                  <Crown size={12} /> Top 3 Markets
                </p>
                <div className="flex items-stretch gap-2">
                  {sales.topMarkets.map((m, i) => (
                    <div key={m.marketId} className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${
                            i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-slate-300 text-black" : "bg-orange-700 text-white"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="text-xs font-semibold text-white truncate" title={m.name}>{m.name}</span>
                      </div>
                      <p className="text-xs text-[#A9A6D9] truncate">{formatCurrency(m.amount, currency)}</p>
                      <div className="mt-1.5 h-1 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 transition-all duration-700"
                          style={{ width: `${Math.max(8, (m.amount / sales.topMarkets[0].amount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate("markets")}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-white/[0.08] hover:bg-white/[0.14] transition-colors"
            >
              View All Markets <ChevronRight size={15} />
            </button>
          </>
        )}
      </section>

      {/* ---------------- Card Sales ---------------- */}
      <section className="mt-4 rounded-3xl p-5 bg-gradient-to-b from-[#0F2E24] to-[#171C2E] border border-white/[0.08]">
        <div className="flex items-start gap-4">
          <span className="grid place-items-center h-16 w-16 rounded-2xl bg-emerald-500/15 text-emerald-400 shrink-0">
            <CreditCard size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
              Card Sales of the Day <Info size={12} className="opacity-60" />
            </p>
            {cardSalesLoading ? (
              <div className="mt-2 h-14 rounded-lg bg-white/[0.03] animate-pulse" />
            ) : cardSalesError ? (
              <div className="mt-2"><ErrorBanner message={cardSalesError} onRetry={reloadCardSales} /></div>
            ) : (
              <div className="mt-1.5 flex items-center gap-5">
                <div>
                  <p className="text-2xl font-display font-extrabold text-emerald-400 leading-none">{cardSales.summary.completed}</p>
                  <p className="text-[11px] text-[#8B93A8] mt-1">Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-display font-extrabold text-amber-400 leading-none">{cardSales.summary.pending}</p>
                  <p className="text-[11px] text-[#8B93A8] mt-1">Pending</p>
                </div>
                <div>
                  <p className="text-2xl font-display font-extrabold text-red-400 leading-none">{cardSales.summary.notCompleted}</p>
                  <p className="text-[11px] text-[#8B93A8] mt-1">Not Completed</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {!cardSalesLoading && !cardSalesError && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700" style={{ width: `${completionPct}%` }} />
              </div>
              <span className="text-xs font-semibold text-emerald-400 shrink-0">{completionPct}%</span>
            </div>

            <button
              type="button"
              onClick={() => navigate("card-sales")}
              className="mt-3.5 w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-emerald-600/90 hover:bg-emerald-500 transition-colors"
            >
              <FileText size={15} /> View All Card Sales Records <ChevronRight size={15} />
            </button>
          </>
        )}
      </section>

      {/* Reminder cadence — informational only; sending is always a manual "Send Reminder" tap on the Card Sales detail screen, not an auto-fired job (see cardSalesController.sendCardSalesReminder's own comment). */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 bg-[#171C2E]/60 border border-white/[0.05]">
        <span className="grid place-items-center h-9 w-9 rounded-xl bg-violet-500/10 text-violet-400 shrink-0">
          <ClipboardList size={16} />
        </span>
        <div className="min-w-0 text-xs text-[#8B93A8]">
          <span className="text-white font-medium">Check-in times:</span> 8:00 AM · 3:30 PM · 11:30 PM
        </div>
      </div>

      {/* ---------------- Today's Zone Activity ---------------- */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">
            <ActivityIcon size={13} /> Today's Zone Activity
          </h2>
          {activities && activities.length > 4 && !showAllActivity && (
            <button type="button" onClick={() => setShowAllActivity(true)} className="text-xs font-medium text-[#F47A20] hover:text-[#ff8b36]">
              View All
            </button>
          )}
        </div>

        {activitiesLoading ? (
          <SkeletonCard className="h-40" />
        ) : activitiesError ? (
          <ErrorBanner message={activitiesError} onRetry={reloadActivities} />
        ) : (activities ?? []).length === 0 ? (
          <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
            <p className="text-sm text-[#8B93A8]">No activity logged in your zone yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl px-4 bg-[#171C2E]/80 border border-white/[0.06] divide-y divide-white/[0.05]">
            {visibleActivities.map((a) => <ActivityRow key={a.id} activity={a} />)}
          </div>
        )}
      </section>
    </div>
  );
}
