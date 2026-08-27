// SenderIdentityBadge.jsx — Warnings & Notifications §29-30: the one
// place that renders "who sent this" consistently across the
// notification card, detail screen, and management history. Admin gets
// a restrained gold accent (a small star + thin gold line), never an
// oversized/gamified treatment; a Zone Manager gets normal TeamMart
// management styling with their zone number so an employee immediately
// understands "this came from my zone's management," not "an anonymous
// admin thing."
export default function SenderIdentityBadge({ senderRole, senderZone, size = "md" }) {
  const isAdmin = senderRole === "ADMIN";
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";

  if (isAdmin) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${textSize} font-semibold tracking-wide text-[#E8B85C]`}>
        <span aria-hidden="true">✦</span>
        ADMIN <span className="text-[#8B7A4F]">•</span> OFFICIAL
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${textSize} font-semibold tracking-wide text-[#9AA1B4]`}>
      ZONE MANAGER{senderZone != null && <><span className="text-[#4C5266]">•</span> ZONE {senderZone}</>}
    </span>
  );
}

// A thin, restrained top accent line for card/detail containers — gold
// for Admin, neutral for everyone else. Deliberately NOT a full gold
// background/border (spec §29: "do not use... glowing cards").
export function SenderAccentLine({ senderRole }) {
  const isAdmin = senderRole === "ADMIN";
  return (
    <div className={`h-[3px] w-full rounded-t-2xl ${isAdmin ? "bg-gradient-to-r from-[#E8B85C] via-[#F0CE87] to-[#E8B85C]" : "bg-white/[0.08]"}`} />
  );
}
