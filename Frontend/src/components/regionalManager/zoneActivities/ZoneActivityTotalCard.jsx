import { BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";

// ZoneActivityTotalCard.jsx — "Total Activities", kept exactly as its own
// stat per the redesign spec, never removed/renamed/replaced. The number
// is a plain client-side sum of the real per-category counts already
// returned by GET /api/zone-activities/counts (no new request, no
// fabricated figure). Department Closing is deliberately excluded from
// this sum: its own count is "unique markets with a valid closing" (see
// zoneActivitiesService.js), a different unit than "an activity
// happened" — summing it in here would silently misrepresent the total.
//
// There is no "+N% vs yesterday" badge: this backend stores no historical
// snapshot to diff against (see AdminKpiCard.jsx's own comment making the
// same call for its KPIs) — inventing one would violate "do not fake
// counts", so the subtext instead states what the number actually is.
export default function ZoneActivityTotalCard({ total, periodLabel, loading }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#111A2D]/90 to-[#0C1424]/90 px-4 py-3.5 backdrop-blur-xl sm:min-w-[230px]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#7EA6FF] to-[#5C86F0] text-[#0B1B3D] shadow-[0_0_24px_-6px_rgba(126,166,255,0.55)]">
        <BarChart3 size={19} strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-[#8B93A8]">{t("rm.zaTotalActivities")}</p>
        {loading ? (
          <div className="mt-1 h-7 w-14 animate-pulse rounded bg-white/[0.07]" />
        ) : (
          <p className="font-display text-[26px] font-bold leading-none tabular-nums text-white">{total}</p>
        )}
        <p className="mt-1 truncate text-[10.5px] text-[#5C6479]">{periodLabel}</p>
      </div>
    </div>
  );
}
