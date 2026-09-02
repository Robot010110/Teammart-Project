import { Package, Sparkles, ClipboardList, Tag, Trash2, Store, ListChecks } from "lucide-react";

// suddenTaskVisuals.js — My Tasks redesign: the ONE place a SuddenTask's
// real `category` field (supervisor-selected at creation, never guessed
// from the title/description) maps to an icon + tone. Every task-facing
// component (TaskCard, TaskDetail, the assignment form's category
// picker) imports from here so the picker and the resulting task's icon
// can never drift apart. No illustration assets exist anywhere in this
// project (confirmed during the Activity tab redesign) — icons are the
// honest way to reproduce the reference's "semantic visual per task
// type" without inventing per-task artwork.
export const CATEGORY_VISUALS = {
  GENERAL: { icon: ListChecks, label: "General", tone: "text-[#F47A20]", bg: "bg-[#F47A20]/10" },
  RESTOCKING: { icon: Package, label: "Restocking", tone: "text-sky-400", bg: "bg-sky-500/10" },
  CLEANING: { icon: Sparkles, label: "Cleaning", tone: "text-emerald-400", bg: "bg-emerald-500/10" },
  INVENTORY: { icon: ClipboardList, label: "Inventory", tone: "text-violet-400", bg: "bg-violet-500/10" },
  PRICE_LABEL: { icon: Tag, label: "Price Label", tone: "text-amber-400", bg: "bg-amber-500/10" },
  EXPIRED_WASTE: { icon: Trash2, label: "Expired Items", tone: "text-red-400", bg: "bg-red-500/10" },
  DEPARTMENT_CLOSING: { icon: Store, label: "Department Closing", tone: "text-[#F47A20]", bg: "bg-[#F47A20]/10" },
};

export function categoryVisual(category) {
  return CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS.GENERAL;
}
