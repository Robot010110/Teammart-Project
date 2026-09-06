import { useNavigate } from "react-router-dom";
import { UserRound } from "lucide-react";
import NotificationBell from "../../employee/NotificationBell";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function dayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// RmHomeHeader.jsx — the compact top block: TeamMart wordmark, the real
// notification bell, then the greeting/identity line. Everything shown
// is the authenticated account's own (session.displayName / role /
// zone), never a hardcoded name.
//
// The bell is the exact NotificationBell every other role already uses —
// same GET /api/notifications feed the old Regional Manager home
// rendered inline. Moving it behind the bell is what frees the page for
// the overview this redesign is about, without losing the feed itself.
export default function RmHomeHeader({ session, zoneLabel, basePath }) {
  const navigate = useNavigate();

  return (
    <header>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center shadow-[0_0_16px_-2px_rgba(244,122,32,0.55)]">
            <span className="font-display font-extrabold text-white text-[13px] tracking-tight">TM</span>
          </div>
          <p className="font-display font-bold text-white text-[15px] tracking-wide">
            TEAM<span className="text-[#F47A20]">MART</span>
          </p>
        </div>
        <NotificationBell basePath={basePath} />
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-[#8B93A8]">{greeting()}</p>
          <h1 className="font-display text-[26px] leading-tight font-bold text-white truncate">{session.displayName}</h1>
          <button
            type="button"
            onClick={() => navigate(`${basePath}/account`)}
            className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#9AA1B4] hover:text-white transition-colors"
          >
            <UserRound size={13} className="text-[#F47A20] shrink-0" />
            <span className="truncate">Regional Manager{zoneLabel ? ` · ${zoneLabel}` : ""}</span>
          </button>
        </div>
        <p className="shrink-0 pt-1 text-right text-[11.5px] leading-tight text-[#5C6479]">
          {dayLabel()}
          <br />
          <span className="text-[#8B93A8]">Discipline today,</span>
          <br />
          <span className="text-[#8B93A8]">stronger tomorrow.</span>
        </p>
      </div>
    </header>
  );
}
