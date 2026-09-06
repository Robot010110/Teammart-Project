import {
  ShoppingCart, Tag, PackageX, Sparkles, Wrench, ClipboardList, LayoutGrid,
  Activity as ActivityIcon, Barcode, Camera,
} from "lucide-react";

// activityMeta.js — the single icon/label vocabulary for an Activity.
//
// Every key below is a real value of the ActivityCategory enum this
// backend writes (grep-verified against schema.prisma), and the icons
// come from lucide-react, the icon library already used everywhere in
// this app — this introduces no second icon system. Defined once here so
// the market overview teaser, the full Market Activity page and the
// employee profile can never label the same activity differently.
export const ACTIVITY_META = {
  REFILLING: { icon: ShoppingCart, label: "Refilled a section", tone: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" },
  LABEL_CHECKING: { icon: Tag, label: "Checked a label", tone: "text-sky-400 bg-sky-500/10 ring-sky-500/20" },
  EXPIRED_ITEMS: { icon: PackageX, label: "Removed expired products", tone: "text-amber-400 bg-amber-500/10 ring-amber-500/20" },
  DAILY_CLEANING: { icon: Sparkles, label: "Completed cleaning", tone: "text-violet-400 bg-violet-500/10 ring-violet-500/20" },
  SHELF_CLEANING: { icon: Sparkles, label: "Completed shelf cleaning", tone: "text-violet-400 bg-violet-500/10 ring-violet-500/20" },
  PRODUCT_CUSTOMIZATION: { icon: Wrench, label: "Customized a product", tone: "text-[#F47A20] bg-[#F47A20]/10 ring-[#F47A20]/20" },
  ITEM_COUNTING: { icon: Barcode, label: "Counted inventory items", tone: "text-sky-400 bg-sky-500/10 ring-sky-500/20" },
  FACING: { icon: LayoutGrid, label: "Adjusted facing", tone: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" },
};

const FALLBACK = { icon: ActivityIcon, label: "Logged an activity", tone: "text-[#9AA1B4] bg-white/[0.06] ring-white/10" };

export function activityMeta(activity) {
  const base = ACTIVITY_META[activity?.category] ?? FALLBACK;
  // An activity that carries photos reads as "uploaded photos" only when
  // its own category doesn't already say something more specific.
  if (!ACTIVITY_META[activity?.category] && activity?.images?.length) {
    return { icon: Camera, label: "Uploaded photos", tone: "text-violet-400 bg-violet-500/10 ring-violet-500/20" };
  }
  return base;
}

export function initialsOfName(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export function clockLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// Today, in the viewer's own timezone — the same "is this today" test
// used by the market activity screens so the teaser and the full page
// can never disagree about which rows belong to today.
export function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
