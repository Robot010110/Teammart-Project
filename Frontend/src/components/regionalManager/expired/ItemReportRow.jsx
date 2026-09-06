import { ChevronRight, ImageIcon, MapPin } from "lucide-react";
import AuthenticatedImage from "../../common/AuthenticatedImage";
import { conditionMeta, initialsOfName, reportTimeLabel } from "./itemReportMeta";

// ItemReportRow.jsx — one expired/wasted report, built to be scanned in
// a list of hundreds: condition icon, who filed it, which market, which
// item, and when.
//
// Every value is read straight off the real ItemReport row returned by
// GET /api/item-reports/zone. The thumbnail is the employee's own
// uploaded photo through AuthenticatedImage (upload files are private
// and need an auth header, so a plain <img> would not load); a report
// with no photo shows a muted placeholder glyph instead of a fake image.
export default function ItemReportRow({ report, onOpen, index = 0 }) {
  const meta = conditionMeta(report.condition);
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className="animate-fade-up group flex w-full items-center gap-3 rounded-[18px] border border-white/[0.07] bg-[#111A2D]/80 p-3 text-left backdrop-blur-xl
                 transition-all duration-200 hover:border-[#F47A20]/30 hover:bg-[#131E33]/90 active:scale-[0.985]"
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${meta.tone}`}>
        <Icon size={17} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[9px] font-bold text-[#C4C9D6] ring-1 ring-white/10">
            {initialsOfName(report.employee?.name)}
          </span>
          <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{report.employee?.name ?? "Unknown"}</p>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-medium ring-1 ring-inset ${meta.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>

        <p className="mt-1 truncate text-[12.5px] text-[#C4C9D6]">
          {report.product?.name ?? "Unknown item"}
          <span className="text-[#5C6479]"> × {report.quantity}</span>
        </p>

        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[#8B93A8]">
          <MapPin size={10} className="shrink-0" />
          {report.market?.name ?? "—"}
          <span className="text-[#3A4155]">·</span>
          <span className="text-[#5C6479]">{reportTimeLabel(report.reportedAt)}</span>
        </p>
      </div>

      {report.imageUrl ? (
        <AuthenticatedImage src={report.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-[#3A4155] ring-1 ring-white/[0.06]">
          <ImageIcon size={15} />
        </span>
      )}

      <ChevronRight size={15} className="shrink-0 text-[#4C5266] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#F47A20]" />
    </button>
  );
}
