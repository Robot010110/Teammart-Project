import { ChevronRight } from "lucide-react";

// Breadcrumb.jsx — trail expects an array of { label, onClick? }.
// The last item renders as the current (non-interactive) page.

export default function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.onClick && !isLast ? (
              <button
                onClick={item.onClick}
                className="text-[#8B93A8] hover:text-[#F47A20] transition-colors duration-150"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? "text-white font-medium" : "text-[#8B93A8]"}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight size={14} className="text-[#4C5266]" />}
          </span>
        );
      })}
    </nav>
  );
}
