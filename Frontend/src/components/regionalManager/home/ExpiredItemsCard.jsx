import { PackageX, ChevronRight } from "lucide-react";
import { useAsync } from "../../../hooks/useAsync";
import { listZoneItemReports } from "../../../services/itemReportService";

// ExpiredItemsCard.jsx — the Regional Manager home's entry point into
// the zone-wide Expired / Wasted Items view.
//
// Both numbers are real and come from the same zone-scoped endpoint the
// full page uses (GET /api/item-reports/zone): `total` for "all time"
// and `todayCount` for the "+N today" badge. pageSize is 1 because this
// card needs the counts, not the rows — it never downloads the feed just
// to count it.
export default function ExpiredItemsCard({ onOpen }) {
  const { data, error, loading } = useAsync(
    () => listZoneItemReports({ period: "all", page: 1, pageSize: 1 }),
    { deps: [], fallbackError: "Could not load expired items." }
  );

  const total = data?.total ?? 0;
  const today = data?.todayCount ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-[18px] border border-white/[0.07] bg-[#111A2D]/80 p-3.5 text-left backdrop-blur-xl
                 transition-all duration-200 hover:border-[#F47A20]/30 hover:bg-[#131E33]/90 active:scale-[0.985]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/25">
        <PackageX size={18} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-white">Expired Items</p>
        <p className="mt-0.5 truncate text-[11.5px] text-[#8B93A8]">
          {loading ? "Loading…" : error ? "Tap to open" : `${total} report${total === 1 ? "" : "s"} across your markets`}
        </p>
      </div>

      {!loading && !error && today > 0 && (
        <span className="shrink-0 rounded-full bg-[#F47A20]/[0.14] px-2 py-[3px] text-[10.5px] font-semibold text-[#F9A03C] ring-1 ring-inset ring-[#F47A20]/25">
          +{today} today
        </span>
      )}

      <ChevronRight size={16} className="shrink-0 text-[#4C5266] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#F47A20]" />
    </button>
  );
}
