// StatusPill.jsx — small status indicator used across market/employee cards.
//
// `status` is the market's real stored value ("Active"/"Maintenance"/
// "Closed"), so it is used as the lookup key and never translated in place;
// only the label shown beside the dot goes through t().
import { useTranslation } from "react-i18next";

const STYLES = {
  Active: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  Maintenance: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  Closed: "bg-red-500/10 text-red-400 ring-red-500/20",
};
const LABEL_KEY = { Active: "status.active", Maintenance: "rm.maintenance", Closed: "status.inactive" };

export default function StatusPill({ status }) {
  const { t } = useTranslation();
  const style = STYLES[status] || STYLES.Active;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABEL_KEY[status] ? t(LABEL_KEY[status]) : status}
    </span>
  );
}
