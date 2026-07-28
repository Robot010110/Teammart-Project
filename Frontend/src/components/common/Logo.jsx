// Logo.jsx
// No logo image was supplied, so this renders a wordmark badge built from
// the brand tokens. Swap the <span> mark below for an <img src="/logo.svg" />
// as soon as brand assets are available — the surrounding layout won't change.

export default function Logo({ withSubtitle = true }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] shadow-lg shadow-orange-900/30 grid place-items-center">
        <span className="font-display font-extrabold text-white text-base tracking-tight">TM</span>
        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-[#1D2D5C] border-2 border-[#1A1A1A]" />
      </div>
      <div className="leading-tight">
        <p className="font-display font-bold text-white text-[17px] tracking-wide">
          TEAM<span className="text-[#F47A20]">MART</span>
        </p>
        {withSubtitle && (
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8B93A8] -mt-0.5">
            Market Management
          </p>
        )}
      </div>
    </div>
  );
}
