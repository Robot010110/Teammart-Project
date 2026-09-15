import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { listAuditLog } from "../services/adminService";

const ACTIONS = [
  "ROLE_CHANGED", "MARKET_ASSIGNMENT_CHANGED", "ZONE_ASSIGNMENT_CHANGED", "DEPARTMENT_ASSIGNMENT_CHANGED",
  "SHIFT_CHANGED", "EMPLOYEE_ID_CHANGED", "PASSWORD_RESET", "ACCOUNT_SUSPENDED", "ACCOUNT_BANNED",
  "ACCOUNT_REACTIVATED", "EMPLOYEE_PROMOTED", "STAFF_DEMOTED", "MARKET_VISIT_STARTED", "MARKET_VISIT_COMPLETED",
  "MARKET_VISIT_CANCELLED", "INSPECTION_STARTED", "INSPECTION_COMPLETED", "INSPECTION_CANCELLED",
];

// The enum VALUE is what the filter sends to the backend; only the label
// shown beside it is translated.
export const ACTION_LABEL = {
  ROLE_CHANGED: "admin.actRoleChanged",
  MARKET_ASSIGNMENT_CHANGED: "admin.actMarketAssignmentChanged",
  ZONE_ASSIGNMENT_CHANGED: "admin.actZoneAssignmentChanged",
  DEPARTMENT_ASSIGNMENT_CHANGED: "admin.actDepartmentAssignmentChanged",
  SHIFT_CHANGED: "admin.actShiftChanged",
  EMPLOYEE_ID_CHANGED: "admin.actEmployeeIdChanged",
  PASSWORD_RESET: "admin.actPasswordReset",
  ACCOUNT_SUSPENDED: "admin.actAccountSuspended",
  ACCOUNT_BANNED: "admin.actAccountBanned",
  ACCOUNT_REACTIVATED: "admin.actAccountReactivated",
  EMPLOYEE_PROMOTED: "admin.actEmployeePromoted",
  STAFF_DEMOTED: "admin.actStaffDemoted",
  MARKET_VISIT_STARTED: "admin.actMarketVisitStarted",
  MARKET_VISIT_COMPLETED: "admin.actMarketVisitCompleted",
  MARKET_VISIT_CANCELLED: "admin.actMarketVisitCancelled",
  INSPECTION_STARTED: "admin.actInspectionStarted",
  INSPECTION_COMPLETED: "admin.actInspectionCompleted",
  INSPECTION_CANCELLED: "admin.actInspectionCancelled",
};
export function actionLabel(a, t) {
  return ACTION_LABEL[a] ? t(ACTION_LABEL[a]) : a.replace(/_/g, " ");
}

// Same "enum value drives logic, label is translated separately" rule as
// ACTION_LABEL above — recordAudit's own targetType is always exactly
// one of these three (see backend/src/utils/audit.js call sites), never
// free text, so this can stay a closed lookup rather than falling back
// to the raw value.
const TARGET_TYPE_LABEL = {
  Employee: "roles.employee",
  User: "admin.targetTypeStaffAccount",
  Market: "admin.csvMarket",
};
function targetTypeLabel(type, t) {
  return TARGET_TYPE_LABEL[type] ? t(TARGET_TYPE_LABEL[type]) : type;
}

function dateLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" });
}

// AdminAuditLogPage.jsx — Admin Phase 3 §13/§28: read-only, paginated,
// filterable view over AuditLog (backend: adminAuditController.js). No
// edit/delete UI exists here — none exists on the backend either.
export default function AdminAuditLogPage() {
  const { t } = useTranslation();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const pageSize = 25;

  const { data, error, loading, reload } = useAsync(
    () => listAuditLog({ action: action || undefined, page, pageSize }),
    { deps: [action, page] }
  );

  const selectClass = "rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-4xl mx-auto animate-fade-up">
      <h1 className="font-display text-xl md:text-2xl font-bold text-white mb-1">{t("admin.adminAuditLog")}</h1>
      <p className="text-sm text-[#9AA1B4] mb-4">{loading ? t("emp.loading") : t("admin.recordedActionsCount", { count: data?.total ?? 0 })}</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">{t("admin.allActions")}</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a, t)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-[64px]" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : data.entries.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
          {t("admin.noAuditEntriesMatchTheseFilters")}
        </div>
      ) : (
        <div className="space-y-2">
          {data.entries.map((e) => {
            const isOpen = expanded === e.id;
            return (
              <div key={e.id} className="rounded-xl bg-[#171C2E]/80 border border-white/[0.06] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#6B7284]">{dateLabel(e.createdAt)}</p>
                    <p className="text-sm text-white truncate">
                      <span className="font-semibold">{e.actor?.name}</span> — {actionLabel(e.action, t)}
                    </p>
                    <p className="text-xs text-[#8B93A8] truncate">
                      {targetTypeLabel(e.targetType, t)} {e.targetId} {e.market ? `· ${e.market.name}` : ""} {e.zone ? `· ${t("rm.zoneNumbered", { number: e.zone.number })}` : ""}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-[#4C5266] shrink-0" /> : <ChevronDown size={16} className="text-[#4C5266] shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 text-xs text-[#8B93A8] space-y-1 border-t border-white/[0.06] pt-2">
                    {e.reason && <p>{t("admin.reason")} <span className="text-white">{e.reason}</span></p>}
                    {e.previousValue && <p>{t("admin.before")} <span className="text-white">{JSON.stringify(e.previousValue)}</span></p>}
                    {e.newValue && <p>{t("admin.after")} <span className="text-white">{JSON.stringify(e.newValue)}</span></p>}
                    {e.metadata && <p>{t("admin.details")} <span className="text-white">{JSON.stringify(e.metadata)}</span></p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-[#8B93A8] disabled:opacity-40">{t("rm.previous")}</button>
          <span className="text-[#6B7284] text-xs">{t("rm.pageOfTotal", { page, total: totalPages })}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="text-[#8B93A8] disabled:opacity-40">{t("common.next")}</button>
        </div>
      )}
    </div>
  );
}
