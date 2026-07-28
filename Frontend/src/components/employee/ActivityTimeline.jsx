import { useState, useMemo } from "react";
import { ListTree } from "lucide-react";
import { ACTIVITY_TYPES, TASK_STATUS_TONE } from "../../data/constants";
import SearchFilterBar from "./SearchFilterBar";
import PhotoEvidence from "../common/PhotoEvidence";

// ActivityTimeline.jsx — newest-first list of an employee's activities,
// with search + range/type filters.

export default function ActivityTimeline({ entries }) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("This Month");
  const [typeFilter, setTypeFilter] = useState("All");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const matchesQuery =
        e.type.toLowerCase().includes(query.toLowerCase()) ||
        e.department.toLowerCase().includes(query.toLowerCase());
      const matchesType = typeFilter === "All" || e.type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [entries, query, typeFilter]);

  return (
    <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <h2 className="flex items-center gap-2 font-display font-semibold text-white mb-4">
        <ListTree size={17} className="text-[#F47A20]" />
        Activity Timeline
      </h2>

      <SearchFilterBar
        query={query} onQuery={setQuery}
        range={range} onRange={setRange}
        typeFilter={typeFilter} onTypeFilter={setTypeFilter}
        types={ACTIVITY_TYPES}
      />

      <ol className="mt-5 relative border-l border-white/[0.08] pl-5 space-y-5 max-h-[520px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-sm text-[#4C5266] py-6">No activities match your filters.</p>
        )}
        {filtered.map((entry, i) => (
          <li key={i} className="relative animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
            <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-[#F47A20] ring-4 ring-[#171C2E]" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">{entry.type}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TASK_STATUS_TONE[entry.status]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {entry.status}
              </span>
            </div>
            <p className="text-xs text-[#8B93A8] mt-0.5">{entry.dateLabel} · {entry.time} · {entry.department}</p>
            {entry.approvedBy && (
              <p className="mt-1 text-[11px] text-[#6B7284]">Approved by: <span className="text-[#9AA1B4]">{entry.approvedBy}</span></p>
            )}
            {entry.requiresPhoto && (
              <PhotoEvidence
                compact
                retentionLabel={
                  entry.photoExpired
                    ? "Photo expired and was removed"
                    : `Photo available for ${entry.photoExpiresInDays} more day${entry.photoExpiresInDays === 1 ? "" : "s"}`
                }
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
