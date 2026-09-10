import { AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

function timeAgo(iso, t) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return t("sup.justNow");
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  return t("common.daysAgo", { count: Math.floor(hours / 24) });
}

// AttentionSection.jsx — only what actually needs the Regional Manager
// right now, capped at two rows. These are real open MarketProblem rows
// from the RM's own zones (GET /api/market-problems?zoneId=), the same
// records the full Reports view acts on — not a separate alert system,
// and not every warning in the app dumped onto Home.
export default function AttentionSection({ problems, onViewAll, onOpen, loading }) {
  const { t } = useTranslation();
  const items = (problems ?? []).slice(0, 2);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
          {t("rm.attention")}
        </h2>
        {(problems?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-0.5 text-[11.5px] font-medium text-[#F47A20] transition-colors hover:text-[#ff9a4d]"
          >
            {t("common.viewAll")} <ChevronRight size={13} className="rtl-flip" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-[62px] animate-pulse rounded-2xl border border-white/[0.06] bg-[#111A2D]/70" />
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] px-3.5 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">{t("rm.nothingNeedsAttention")}</p>
            <p className="text-[11.5px] text-[#8B93A8]">{t("rm.noOpenReportsAcrossYourMarkets")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={onOpen}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-red-500/15 bg-red-500/[0.05] px-3.5 py-3 text-start transition-colors hover:border-red-500/30"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400">
                <AlertTriangle size={15} />
              </span>
              <div className="min-w-0 flex-1">
                {/* problemType is already human-readable free text
                    ("Freezer not working"), written by the reporting
                    Supervisor — shown verbatim, exactly as the full
                    Reports views do. */}
                <p className="truncate text-[13px] font-semibold text-white">
                  {p.market?.name ? `${p.market.name} — ` : ""}
                  {p.problemType}
                </p>
                <p className="truncate text-[11.5px] text-[#9AA1B4]">{p.location || p.description || t("rm.openReport")}</p>
              </div>
              <span className="shrink-0 text-[10.5px] text-[#5C6479]">{timeAgo(p.createdAt, t)}</span>
              <ChevronRight size={14} className="shrink-0 text-[#4C5266] rtl-flip" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
