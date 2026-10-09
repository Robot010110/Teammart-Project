// Logo.jsx — TeamMart lockup (mark + wordmark) with the optional subtitle.
// The artwork itself lives in the shared brand kit; see BrandMark.jsx.
import { BrandMark, BrandWordmark } from "./BrandMark";

export default function Logo({ withSubtitle = true }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className="h-10 w-10" />
      <div className="leading-tight">
        <BrandWordmark className="h-[17px]" />
        {withSubtitle && (
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#8B93A8]">
            Market Management
          </p>
        )}
      </div>
    </div>
  );
}
