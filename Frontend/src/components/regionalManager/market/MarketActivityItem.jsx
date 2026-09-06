import AuthenticatedImage from "../../common/AuthenticatedImage";
import { activityMeta, initialsOfName, clockLabel } from "./activityMeta";

// MarketActivityItem.jsx — one row of the market's activity feed:
// who did it, what it was, which department, when, and its own photo
// when the activity actually carries one.
//
// Every field is read straight off the real Activity row
// (GET /api/activities/market) — employee, category, department, date,
// images. Nothing is derived or filled in; a missing department simply
// isn't rendered rather than being replaced with a placeholder.
export default function MarketActivityItem({ activity, index = 0, showDivider }) {
  const meta = activityMeta(activity);
  const Icon = meta.icon;
  const who = activity.employee?.name ?? activity.submittedByStaff?.name ?? "Someone";
  const department = activity.employee?.department ?? activity.department ?? null;
  const thumb = activity.images?.[0]?.url ?? null;

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={`animate-fade-up flex items-center gap-2.5 py-2.5 ${showDivider ? "border-t border-white/[0.05]" : ""}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${meta.tone}`}>
        <Icon size={15} />
      </span>

      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[10px] font-bold text-[#C4C9D6] ring-1 ring-white/10">
        {initialsOfName(who)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-[12.5px] font-semibold text-white">{who}</p>
          <span className="shrink-0 text-[10.5px] tabular-nums text-[#5C6479]">{clockLabel(activity.date)}</span>
        </div>
        <p className="truncate text-[11.5px] text-[#9AA1B4]">{meta.label}</p>
        {department && <p className="truncate text-[10.5px] text-[#5C6479]">{department}</p>}
      </div>

      {thumb && (
        <AuthenticatedImage
          src={thumb}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
        />
      )}
    </div>
  );
}
