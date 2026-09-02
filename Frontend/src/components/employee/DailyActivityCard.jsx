import { ArrowRight } from "lucide-react";

// DailyActivityCard.jsx — one card in the Activity tab's "Daily
// Activities" horizontal carousel. The reference design's large faint
// background artwork is reproduced here as an oversized, very-low-
// opacity outline of the card's own feature icon (lucide-react,
// stroke-only) rather than an imported illustration — this project has
// no image/illustration assets anywhere (see this component's own git
// history note) and the brief explicitly rules out pulling one from an
// external URL, so an icon watermark is the honest way to get the same
// "depth behind the content" effect using only what already exists here.
export default function DailyActivityCard({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative shrink-0 w-[210px] h-[172px] rounded-2xl p-4 bg-gradient-to-br from-[#1A1F33] to-[#171C2E] border border-white/[0.06] overflow-hidden text-left snap-start transition-colors hover:border-[#F47A20]/25"
    >
      <Icon size={148} strokeWidth={1} className="absolute -right-8 -bottom-8 text-white/[0.05] pointer-events-none" aria-hidden="true" />

      <span className="relative w-10 h-10 rounded-lg bg-[#F47A20]/15 flex items-center justify-center text-[#F47A20]">
        <Icon size={18} />
      </span>
      <p className="relative mt-5 text-sm font-semibold text-white">{title}</p>
      <p className="relative mt-1 text-xs text-[#8B93A8] leading-snug">{description}</p>
      <span className="relative mt-3 inline-flex w-8 h-8 rounded-full bg-white/[0.06] items-center justify-center text-white">
        <ArrowRight size={14} />
      </span>
    </button>
  );
}
