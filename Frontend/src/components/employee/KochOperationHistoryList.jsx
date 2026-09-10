import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import AuthenticatedImage from "../common/AuthenticatedImage";

const OPERATION_TYPE_LABEL = { CUSTOMIZATION: "emp.customization", DISCOUNT_CUSTOMIZATION: "emp.discountCustomization" };

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function productSummary(op) {
  return op.products
    .map((p) => {
      const parts = [p.kochProduct.name, p.kochProduct.variant, p.kochProduct.size].filter(Boolean).join(" ");
      return p.quantity > 1 ? `${parts} × ${p.quantity}` : parts;
    })
    .join(", ");
}

// KochOperationHistoryList.jsx — the "simple history view" spec §11 asks
// for, shared by the Worker section (operationType rows) and Cashier
// section (products rows) since a KochOperation record already carries
// whichever shape applies (see schema.prisma's own comment) — one
// renderer, no drift between the two. Koch Operation's status is always
// SUBMITTED (no review lifecycle — see KochOperationStatus's own schema
// comment), so this renders a plain static badge rather than reusing
// ActivityStatusPill, which is built around the DRAFT/PENDING/APPROVED/
// REJECTED lifecycle Koch Operation doesn't have.
export default function KochOperationHistoryList({ operations }) {
  const { t } = useTranslation();

  if (!operations || operations.length === 0) {
    return <p className="text-sm text-[#4C5266] text-center py-6">{t("emp.noKochOperationsYet")}</p>;
  }

  return (
    <div className="space-y-2">
      {operations.map((op) => (
        <div key={op.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
          <div className="flex items-start gap-3">
            <AuthenticatedImage src={op.evidenceUrl} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-white font-medium truncate">
                  {op.operationType ? t(OPERATION_TYPE_LABEL[op.operationType]) : productSummary(op)}
                </span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
                  {t("emp.submitted")}
                </span>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8B93A8]">
                <Clock size={11} /> {dateLabel(op.date)} · {op.time}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
