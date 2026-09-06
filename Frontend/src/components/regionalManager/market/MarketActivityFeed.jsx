import { CalendarClock } from "lucide-react";
import MarketActivityItem from "./MarketActivityItem";

// MarketActivityFeed.jsx — the shared list body for "Market Activity
// Today", used by both the market overview teaser (limit 5) and the
// dedicated full-day page (no limit). One component so the two can never
// drift apart visually or in how they read an activity row.
//
// The caller passes already-filtered activities; filtering lives in the
// pages so the market/today scoping is explicit and testable there.
export default function MarketActivityFeed({ activities, loading, limit, emptyHint }) {
  const rows = limit ? (activities ?? []).slice(0, limit) : activities ?? [];

  if (loading) {
    return (
      <div className="space-y-2 py-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.05]" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-3 py-7 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.05] text-[#5C6479]">
          <CalendarClock size={17} />
        </span>
        <p className="mt-2.5 text-[13px] font-semibold text-white">No activity yet today</p>
        <p className="mt-0.5 text-[11.5px] text-[#8B93A8]">{emptyHint ?? "Work logged in this market today will appear here."}</p>
      </div>
    );
  }

  return (
    <>
      {rows.map((a, i) => (
        <MarketActivityItem key={a.id} activity={a} index={i} showDivider={i > 0} />
      ))}
    </>
  );
}
