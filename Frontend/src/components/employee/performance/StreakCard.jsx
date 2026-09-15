import { useTranslation } from "react-i18next";
import { Flame, TriangleAlert, Trophy } from "lucide-react";

// StreakCard.jsx — the employee's approval and rejection streaks.
//
// Streaks are deliberately employee-visible: they contain no internal
// scoring at all. Severity never affects streak structure (a Minor and a
// Major correction break the clean streak identically), which is exactly
// what makes them safe to show while the correction level itself stays
// management-only.
//
// The "approval streak" shown is the CLEAN track — an approval that
// needed a correction is an acceptance, but not an unblemished approval,
// so it restarts this counter. That is the same rule the score uses, so
// the number here always agrees with the Consistency category.
function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <span className={`shrink-0 w-8 h-8 rounded-xl grid place-items-center ${tone.bg} ${tone.text}`}>
        <Icon size={14} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className={`font-display text-[17px] font-bold leading-none tabular-nums ${tone.text}`}>{value ?? 0}</p>
        <p className="mt-0.5 text-[10.5px] leading-tight text-[#8B93A8] truncate">{label}</p>
      </div>
    </div>
  );
}

export default function StreakCard({ streaks }) {
  const { t } = useTranslation();
  if (!streaks) return null;

  const hasAny =
    streaks.currentApprovalStreak > 0 ||
    streaks.bestApprovalStreak > 0 ||
    streaks.currentRejectionStreak > 0;

  return (
    <section className="rounded-[18px] p-3 bg-[#0D1223]/80 border border-white/[0.07]">
      <h3 className="mb-2.5 text-[13px] font-semibold text-white">{t("emp.perfStreaks")}</h3>

      {hasAny ? (
        <div className="flex items-center gap-2">
          <Stat
            icon={Flame}
            label={t("emp.perfCurrentStreak")}
            value={streaks.currentApprovalStreak}
            tone={{ text: "text-[#F9A03C]", bg: "bg-[#F47A20]/[0.12]" }}
          />
          <Stat
            icon={Trophy}
            label={t("emp.perfBestStreak")}
            value={streaks.bestApprovalStreak}
            tone={{ text: "text-emerald-400", bg: "bg-emerald-500/[0.12]" }}
          />
          {streaks.currentRejectionStreak > 0 && (
            <Stat
              icon={TriangleAlert}
              label={t("emp.perfRejectionStreak")}
              value={streaks.currentRejectionStreak}
              tone={{ text: "text-[#FF5C5C]", bg: "bg-red-500/[0.12]" }}
            />
          )}
        </div>
      ) : (
        <p className="text-[11px] text-[#5C6479]">{t("emp.perfNoStreakYet")}</p>
      )}
    </section>
  );
}
