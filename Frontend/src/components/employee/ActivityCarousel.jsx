import { useRef, useState } from "react";

// ActivityCarousel.jsx — horizontal snap-scroll wrapper with pagination
// dots, used by the Activity tab's "Daily Activities" section. Purely a
// layout/scroll-tracking shell; `children` are whatever cards the caller
// passes (DailyActivityCard.jsx today). Active dot is derived from real
// scroll position (scrollLeft / card width), not a separate piece of
// state that could drift from what's actually on screen.
export default function ActivityCarousel({ children }) {
  const scrollRef = useRef(null);
  const [active, setActive] = useState(0);
  const count = Array.isArray(children) ? children.length : 1;

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || !el.firstElementChild) return;
    const cardWidth = el.firstElementChild.offsetWidth + 12; // + gap-3
    setActive(Math.round(el.scrollLeft / cardWidth));
  }

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: "none" }}
      >
        {children}
      </div>
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: count }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${i === active ? "w-4 bg-[#F47A20]" : "w-1.5 bg-white/15"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
