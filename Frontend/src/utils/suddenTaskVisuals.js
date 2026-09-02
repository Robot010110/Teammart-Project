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
// `glow` maps each category to one of index.css's shared neon glow
// utilities (glow-orange/emerald/sky/violet/red) — same five-tone
// TeamMart visual system used everywhere else, not a one-off per file.
export const CATEGORY_VISUALS = {
  GENERAL: { icon: ListChecks, label: "General", tone: "text-[#F47A20]", bg: "bg-[#F47A20]/10", glow: "glow-orange" },
  RESTOCKING: { icon: Package, label: "Restocking", tone: "text-sky-400", bg: "bg-sky-500/10", glow: "glow-sky" },
  CLEANING: { icon: Sparkles, label: "Cleaning", tone: "text-emerald-400", bg: "bg-emerald-500/10", glow: "glow-emerald" },
  INVENTORY: { icon: ClipboardList, label: "Inventory", tone: "text-violet-400", bg: "bg-violet-500/10", glow: "glow-violet" },
  PRICE_LABEL: { icon: Tag, label: "Price Label", tone: "text-amber-400", bg: "bg-amber-500/10", glow: "glow-orange" },
  EXPIRED_WASTE: { icon: Trash2, label: "Expired Items", tone: "text-red-400", bg: "bg-red-500/10", glow: "glow-red" },
  DEPARTMENT_CLOSING: { icon: Store, label: "Department Closing", tone: "text-[#F47A20]", bg: "bg-[#F47A20]/10", glow: "glow-orange" },
};

export function categoryVisual(category) {
  return CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS.GENERAL;
}
