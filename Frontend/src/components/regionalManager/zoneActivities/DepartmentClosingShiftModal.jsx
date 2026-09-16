import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, RotateCw } from "lucide-react";
import Modal from "../../common/Modal";
import AuthenticatedImage from "../../common/AuthenticatedImage";
import ShiftBadge from "../../common/ShiftBadge";
import ZoneActivityPhotoViewer from "./ZoneActivityPhotoViewer";
import { zoneActivityStatusMeta } from "./zoneActivityMeta";
import { useAsync } from "../../../hooks/useAsync";
import { getDepartmentClosingShift } from "../../../services/zoneActivitiesService";

// DepartmentClosingShiftModal.jsx — Page 4 / "Show All": every department's
// latest valid Department Closing record for one exact market + date +
// shift, in the app's own canonical department order (see
// backend/src/utils/departments.js — the same order the shift-detail
// endpoint already sorts by). Compact rows only (department name + a photo
// thumbnail + count), never full-size images inline — tapping a thumbnail
// opens the same swipeable ZoneActivityPhotoViewer used everywhere else in
// Zone Activities, never a second viewer.
export default function DepartmentClosingShiftModal({ marketId, date, shift, onClose }) {
  const { t } = useTranslation();
  const [viewer, setViewer] = useState(null); // { photos, startIndex } | null

  const { data, error, loading, reload } = useAsync(
    () => getDepartmentClosingShift(marketId, date, shift),
    { deps: [marketId, date, shift], fallbackError: t("rm.zaCouldNotLoadRecords") }
  );

  const departments = data?.departments ?? [];

  return (
    <>
      <Modal open onClose={onClose} title={t("rm.zaDepartmentClosing")} maxWidth="max-w-xl">
        <div className="-mt-1 mb-3 flex items-center justify-between">
          <ShiftBadge shift={shift} size={15} className="text-[14px] font-semibold text-white" />
          <span className="text-[12px] text-[#8B93A8]">{date}</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[56px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-5 text-center">
            <p className="text-[13px] font-semibold text-white">{t("rm.zaCouldNotLoadRecords")}</p>
            <p className="mt-1 text-[11.5px] text-[#9AA1B4]">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-white/[0.1]"
            >
              <RotateCw size={12} /> {t("rm.tryAgain")}
            </button>
          </div>
        ) : departments.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-8 text-center">
            <p className="text-[13.5px] font-semibold text-white">{t("rm.zaNoCompletedShifts")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {departments.map(({ department, record }) => {
              const validPhotos = (record?.photos ?? []).filter((p) => p.url);
              const firstPhoto = validPhotos[0]?.url;
              const extraCount = validPhotos.length - 1;
              const statusMeta = record ? zoneActivityStatusMeta(record.status) : null;

              return (
                <div
                  key={department}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-white">{department}</p>
                    {record ? (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {statusMeta && (
                          <span className={`inline-flex items-center rounded-full px-1.5 py-[1px] text-[9.5px] font-medium ring-1 ring-inset ${statusMeta.chip}`}>
                            {t(statusMeta.label)}
                          </span>
                        )}
                        {record.submittedBy && (
                          <span className="truncate text-[11px] text-[#8B93A8]">{record.submittedBy.name}</span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-[11.5px] text-[#5C6479]">{t("rm.zaDepartmentNotCompleted")}</p>
                    )}
                  </div>

                  {record ? (
                    firstPhoto ? (
                      <button
                        type="button"
                        onClick={() => setViewer({ photos: validPhotos, startIndex: 0 })}
                        className="relative h-10 w-10 shrink-0 rounded-lg ring-1 ring-white/10 active:scale-95 transition-transform"
                        aria-label={t("rm.zaViewPhotos")}
                      >
                        <AuthenticatedImage src={firstPhoto} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        {extraCount > 0 && (
                          <span className="absolute -end-1 -bottom-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#F47A20] px-1 text-[9px] font-bold text-white ring-2 ring-[#1F2436]">
                            +{extraCount}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span className="shrink-0 text-[10.5px] text-[#5C6479]">{t("rm.zaNoPhotoAvailable")}</span>
                    )
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.03] text-[#3A4155] ring-1 ring-white/[0.05]">
                      <ImageIcon size={14} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {viewer && (
        <ZoneActivityPhotoViewer photos={viewer.photos} startIndex={viewer.startIndex} onClose={() => setViewer(null)} />
      )}
    </>
  );
}
