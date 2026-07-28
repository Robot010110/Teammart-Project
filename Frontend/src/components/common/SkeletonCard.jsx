// SkeletonCard.jsx — pulse-loading placeholder, ready for real async data fetching.

export function SkeletonCard({ className = "h-24" }) {
  return (
    <div
      className={`rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse ${className}`}
    />
  );
}

export function SkeletonGrid({ count = 6, className = "h-24" }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className={className} />
      ))}
    </div>
  );
}
