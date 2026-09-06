import { Barcode, ImageOff, MapPin, Package, User, CalendarClock, Hash } from "lucide-react";
import Modal from "../../common/Modal";
import AuthenticatedImage from "../../common/AuthenticatedImage";
import { conditionMeta, initialsOfName, reportTimeLabel, STATUS_META } from "./itemReportMeta";

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-[#8B93A8]">
        <Icon size={14} />
      </span>
      <span className="text-[12px] text-[#8B93A8]">{label}</span>
      <span className="ml-auto min-w-0 truncate text-right text-[12.5px] font-medium text-white">{value}</span>
    </div>
  );
}

// ItemReportDetailModal.jsx — the full report behind a row, in the same
// Modal component every other detail/confirm flow in this app opens
// through (no new UX pattern introduced).
//
// The photo is the employee's real uploaded file, fetched with the
// viewer's credentials by AuthenticatedImage — a Regional Manager is
// allowed to see it because item-report photos resolve to the report's
// own market and this RM's zone contains it (see
// backend/src/utils/fileAuthorization.js). A report filed without a
// photo gets an honest empty state rather than a stand-in image.
export default function ItemReportDetailModal({ report, onClose }) {
  if (!report) return null;
  const meta = conditionMeta(report.condition);
  const Icon = meta.icon;
  const status = STATUS_META[report.status] ?? STATUS_META.PENDING;

  return (
    <Modal open={!!report} onClose={onClose} title="Item Report" maxWidth="max-w-md">
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ring-inset ${meta.tone}`}>
            <Icon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[17px] font-bold text-white">{report.product?.name ?? "Unknown item"}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] font-medium ring-1 ring-inset ${meta.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-[2px] font-medium ring-1 ring-inset ${status.chip}`}>
                {status.label}
              </span>
            </p>
          </div>
        </div>

        {/* The real uploaded photo, or an honest empty state. */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0D1424]">
          {report.imageUrl ? (
            <AuthenticatedImage src={report.imageUrl} alt={`Photo for ${report.product?.name ?? "report"}`} className="max-h-64 w-full object-cover" />
          ) : (
            <div className="grid place-items-center px-4 py-10 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.05] text-[#4C5266]">
                <ImageOff size={18} />
              </span>
              <p className="mt-2.5 text-[12.5px] font-medium text-[#9AA1B4]">No photo attached</p>
              <p className="mt-0.5 text-[11px] text-[#5C6479]">This report was filed without an image.</p>
            </div>
          )}
        </div>

        <div className="mt-3 divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 px-3.5">
          <div className="flex items-center gap-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[10px] font-bold text-white ring-1 ring-white/10">
              {initialsOfName(report.employee?.name)}
            </span>
            <span className="text-[12px] text-[#8B93A8]">Reported by</span>
            <span className="ml-auto min-w-0 truncate text-right text-[12.5px] font-medium text-white">
              {report.employee?.name ?? "Unknown"}
              {report.employee?.employeeCode ? <span className="text-[#5C6479]"> · {report.employee.employeeCode}</span> : null}
            </span>
          </div>
          <DetailRow icon={MapPin} label="Market" value={report.market?.name ?? "—"} />
          <DetailRow icon={Package} label="Quantity" value={report.quantity} />
          <DetailRow icon={Barcode} label="Barcode" value={report.product?.barcode || "Not recorded"} />
          <DetailRow icon={CalendarClock} label="Reported" value={reportTimeLabel(report.reportedAt)} />
          <DetailRow icon={Hash} label="Report ID" value={report.id.slice(-8)} />
        </div>

        {report.notes && (
          <div className="mt-3 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8B93A8]">
              <User size={11} /> Employee notes
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#C4C9D6]">{report.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
