// DepartmentTile.jsx — one tile in the digital floor plan. Interactive
// tiles (real departments) are clickable and open the detail panel;
// decorative tiles (WC, Manager Office, Entrance) render as plain labels
// with no hover/click behavior, matching the reference floor plan.

export default function DepartmentTile({ dept, onSelect, isSelected }) {
  const isGradient = dept.color.startsWith("from-");
  const bgClass = isGradient ? `bg-gradient-to-br ${dept.color}` : dept.color;

  if (!dept.interactive) {
    return (
      <div
        style={{ gridColumn: dept.col, gridRow: dept.row }}
        className={`rounded-xl border border-white/[0.06] ${bgClass} flex items-center justify-center px-2`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8B93A8] text-center leading-tight">
          {dept.name}
        </span>
      </div>
    );
  }

  return (
    <button
      style={{ gridColumn: dept.col, gridRow: dept.row }}
      onClick={() => onSelect(dept)}
      className={`group relative rounded-xl border p-3 flex flex-col justify-between text-left
        ${bgClass}
        transition-all duration-200 ease-out
        hover:border-[#F47A20]/60 hover:shadow-[0_0_0_2px_rgba(244,122,32,0.25)]
        active:scale-[0.97]
        ${isSelected ? "border-[#F47A20] shadow-[0_0_0_2px_rgba(244,122,32,0.35)]" : "border-white/[0.1]"}
      `}
    >
      <span className="text-xs font-semibold text-white leading-tight">{dept.name}</span>
      <div className="mt-1">
        <p className="text-[9px] uppercase tracking-wide text-[#F0F1F5]/70">Assigned to</p>
        <p className="text-[11px] font-medium text-[#F0F1F5] truncate">{dept.assignedTo}</p>
      </div>
    </button>
  );
}
