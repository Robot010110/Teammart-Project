// AttendanceSkeleton.jsx — the Attendance page's loading state.
//
// Mirrors the real layout's silhouette at both breakpoints (status hero,
// six-tile overview, ring + calendar pair, timeline + work-time pair) so
// the page doesn't visibly reflow once data lands, instead of showing a
// generic spinner. `.shimmer` (index.css) is disabled under
// prefers-reduced-motion.

function Block({ className = "" }) {
  return <div className={`shimmer rounded-2xl bg-[#0D1223]/70 border border-white/[0.05] ${className}`} />;
}

export default function AttendanceSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading attendance">
      <Block className="h-[132px] rounded-[20px]" />

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} className="h-[104px] sm:h-[118px]" />
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4">
        <Block className="h-[260px]" />
        <Block className="h-[300px]" />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-4">
        <Block className="h-[240px]" />
        <Block className="h-[240px]" />
      </div>
    </div>
  );
}
