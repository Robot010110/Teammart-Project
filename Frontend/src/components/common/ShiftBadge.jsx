import { useTranslation } from "react-i18next";
import { SHIFT_META } from "../../utils/shiftMeta";

// ShiftBadge.jsx — the ONE shared presentation for an employee's shift:
// [icon] [short label], nothing else. Every screen that shows a Worker's
// or Cashier's shift (Admin People, Supervisor Employees, Regional
// Manager views, employee profiles/cards, the employee's own profile)
// renders it through this component so the icon, text, spacing and
// typography are always identical — see shiftMeta.js for the underlying
// icon/label mapping this reads.
//
// Renders nothing for a null/unknown shift (no shift assigned yet) —
// callers that want to show "not assigned" text do that themselves,
// since the right wording differs by context (a table cell dash vs. a
// profile field placeholder).
//
// `className` only adjusts layout (size/color via the className, e.g. to
// mute the color in a secondary context) — the icon and text content
// never vary between callers.
export default function ShiftBadge({ shift, size = 13, className = "" }) {
  const { t } = useTranslation();
  const meta = SHIFT_META[shift];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon size={size} />
      {t(meta.labelKey)}
    </span>
  );
}
