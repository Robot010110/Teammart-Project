// PerformanceSkeleton.jsx — the Performance page's loading state.
//
// Deliberately mirrors the real layout's silhouette (hero card with a
// circular ring and a three-up status row, then chart / bars / carousel
// blocks at their true heights) rather than showing one generic spinner,
// so the page doesn't visibly reflow once data lands. `.shimmer` (see
// index.css) sweeps a faint highlight across each block and is disabled
// under prefers-reduced-motion.

function Block({ className = "" }) {
  return <div className={`shimmer rounded-2xl bg-[#171C2E]/70 border border-white/[0.05] ${className}`} />;
}

export default function PerformanceSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading performance">
      {/* Hero — ring on the left, three status rows stacked on the right,
          matching the real layout so nothing reflows once data lands. */}
      <div className="shimmer rounded-[22px] bg-[#0D1223]/80 border border-white/[0.06] p-3.5 flex items-center gap-3">
        <div className="shrink-0 w-[152px] min-[400px]:w-[188px] h-[152px] min-[400px]:h-[188px] rounded-full border-[10px] border-white/[0.05]" />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="h-[52px] rounded-2xl bg-white/[0.04]" />
          <div className="h-[52px] rounded-2xl bg-white/[0.04]" />
          <div className="h-[52px] rounded-2xl bg-white/[0.04]" />
        </div>
      </div>

      <Block className="h-[248px]" />
      <Block className="h-[196px]" />

      <div className="flex gap-3 overflow-hidden">
        <Block className="h-[150px] w-[150px] shrink-0" />
        <Block className="h-[150px] w-[150px] shrink-0" />
        <Block className="h-[150px] w-[150px] shrink-0" />
      </div>

      <div className="space-y-2.5">
        <Block className="h-[76px]" />
        <Block className="h-[76px]" />
      </div>
    </div>
  );
}
