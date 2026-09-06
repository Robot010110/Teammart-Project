import { PackageX, Trash2 } from "lucide-react";

// itemReportMeta.js — how an ItemReport reads on screen.
//
// Only the two conditions the ItemCondition enum actually defines
// (EXPIRED, WASTED) are listed. The brief mentioned "Damaged"/"Broken"
// as well, but this application's data model has no such value, so
// inventing one would produce a filter that could never match anything.
// Icons come from lucide-react — the library the whole app already uses;
// PackageX is the same glyph the employee/supervisor activity feeds
// already use for expired/wasted items, so one report looks like itself
// everywhere.
export const CONDITION_META = {
  EXPIRED: {
    label: "Expired",
    icon: PackageX,
    tone: "text-amber-400 bg-amber-500/10 ring-amber-500/25",
    chip: "bg-amber-500/12 text-amber-400 ring-amber-500/25",
    dot: "bg-amber-400",
  },
  WASTED: {
    label: "Wasted",
    icon: Trash2,
    tone: "text-red-400 bg-red-500/10 ring-red-500/25",
    chip: "bg-red-500/12 text-red-400 ring-red-500/25",
    dot: "bg-red-400",
  },
};

export function conditionMeta(condition) {
  return CONDITION_META[condition] ?? CONDITION_META.EXPIRED;
}

// The review state the Supervisor sets on the report (ActivityStatus).
export const STATUS_META = {
  PENDING: { label: "Pending review", chip: "bg-white/[0.06] text-[#9AA1B4] ring-white/10" },
  APPROVED: { label: "Approved", chip: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/25" },
  REJECTED: { label: "Rejected", chip: "bg-red-500/12 text-red-400 ring-red-500/25" },
  DRAFT: { label: "Draft", chip: "bg-white/[0.06] text-[#8B93A8] ring-white/10" },
};

export function initialsOfName(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// "Today · 14:32" / "Yesterday · 09:05" / "Sep 3 · 14:32" — the same
// relative-then-absolute shape used elsewhere in this app, in the
// viewer's own local time (which matches the server-local day the
// backend filters on).
export function reportTimeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (isSameDay(d, now)) return `Today · ${time}`;
  if (isSameDay(d, yesterday)) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}
