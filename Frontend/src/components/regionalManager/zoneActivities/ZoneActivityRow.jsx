import { ImageIcon, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import AuthenticatedImage from "../../common/AuthenticatedImage";
import { initialsOfName, zoneActivityStatusMeta, zoneActivityTimeLabel } from "./zoneActivityMeta";

// Literal class strings, never interpolated — Tailwind's JIT scanner only
// finds classes that appear verbatim in source (same convention as
// AdminKpiCard.jsx's own TONES map).
const ICON_TONE_CLASSES = {
  amber: "text-amber-400 bg-amber-500/10 ring-amber-500/25",
  red: "text-red-400 bg-red-500/10 ring-red-500/25",
  purple: "text-[#C08BFF] bg-[#C08BFF]/10 ring-[#C08BFF]/25",
  blue: "text-[#7EA6FF] bg-[#7EA6FF]/10 ring-[#7EA6FF]/25",
  green: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/25",
};

// ZoneActivityRow.jsx — one Zone Activities record, built to be scanned
// in a list of hundreds: who, where, what, when, and a photo indicator —
// modeled directly on ItemReportRow.jsx (Regional Manager's existing
// Expired Items row), generalized to the common shape every category's
// backend registry entry returns (see zoneActivitiesService.js's own
// mapXRow functions). Every field is read straight off that real record;
// nothing here is fabricated — `employee`/`department`/`subject` are all
// already null when the underlying data genuinely has nothing there
// (e.g. Maintenance Reports has no employee at all), and this component
// only ever renders what's actually present.
export default function ZoneActivityRow({ record, icon: CategoryIcon, tone, index = 0, onOpenPhotos }) {
  const { t } = useTranslation();
  const statusMeta = zoneActivityStatusMeta(record.status);
  const photos = record.photos ?? [];
  const firstPhoto = photos[0]?.url;
  const extraPhotoCount = photos.length - 1;

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className="animate-fade-up flex w-full items-center gap-3 rounded-[18px] border border-white/[0.07] bg-[#111A2D]/80 p-3 backdrop-blur-xl"
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${ICON_TONE_CLASSES[tone] ?? ICON_TONE_CLASSES.blue}`}>
        <CategoryIcon size={17} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {record.employee ? (
            <>
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[9px] font-bold text-[#C4C9D6] ring-1 ring-white/10">
                {initialsOfName(record.employee.name)}
              </span>
              <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{record.employee.name}</p>
            </>
          ) : (
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#C4C9D6]">{t("rm.zaNoEmployeeOnRecord")}</p>
          )}
          {statusMeta && (
            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-[2px] text-[10px] font-medium ring-1 ring-inset ${statusMeta.chip}`}>
              {t(statusMeta.label)}
            </span>
          )}
        </div>

        {record.subject && <p className="mt-1 truncate text-[12.5px] text-[#C4C9D6]">{record.subject}</p>}
        {record.department && (
          <p className="mt-0.5 truncate text-[11px] text-[#8B93A8]">{record.department}</p>
        )}

        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[#8B93A8]">
          <MapPin size={10} className="shrink-0" />
          {record.market?.name ?? "—"}
          <span className="text-[#3A4155]">·</span>
          <span className="text-[#5C6479]">{zoneActivityTimeLabel(record.date)}</span>
        </p>
      </div>

      {photos.length > 0 ? (
        <button
          type="button"
          onClick={() => onOpenPhotos(record)}
          className="relative h-11 w-11 shrink-0 rounded-lg ring-1 ring-white/10 active:scale-95 transition-transform"
          aria-label={t("rm.zaViewPhotos")}
        >
          <AuthenticatedImage src={firstPhoto} alt="" className="h-11 w-11 rounded-lg object-cover" />
          {extraPhotoCount > 0 && (
            <span className="absolute -end-1 -bottom-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-[#F47A20] px-1 text-[9.5px] font-bold text-white ring-2 ring-[#111A2D]">
              +{extraPhotoCount}
            </span>
          )}
        </button>
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-[#3A4155] ring-1 ring-white/[0.06]">
          <ImageIcon size={15} />
        </span>
      )}
    </div>
  );
}
