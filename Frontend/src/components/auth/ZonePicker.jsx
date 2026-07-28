import { MapPinned, ArrowRight } from "lucide-react";
import { zones } from "../../data/mockData";

// ZonePicker.jsx — Regional Manager selects which zone they manage.

export default function ZonePicker({ onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {zones.map((zone, i) => (
        <button
          key={zone.id}
          style={{ animationDelay: `${i * 80}ms` }}
          onClick={() => onSelect(zone)}
          className="animate-fade-up group text-left rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.06]
                     transition-all duration-200 hover:-translate-y-1 hover:border-[#F47A20]/40 active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <MapPinned size={16} className="text-[#F47A20]" />
            <ArrowRight size={14} className="text-[#4C5266] group-hover:text-[#F47A20] transition-colors duration-200" />
          </div>
          <p className="mt-3 text-sm font-semibold text-white">Zone {zone.number}</p>
          <p className="text-xs text-[#8B93A8]">{zone.manager}</p>
        </button>
      ))}
    </div>
  );
}
