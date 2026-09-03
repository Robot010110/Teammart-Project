import { Flame, Trophy, LineChart, ArrowUpRight, ArrowDownRight } from "lucide-react";

// HighlightsCard.jsx — the closing "what stands out" card, laid out as
// three columns separated by hairline dividers (matching the reference)
// rather than stacked rows.
//
// Every figure is derived from real data, never stored or invented:
//   Consistency Streak  consecutive most-recent DAYS with a submitted
//                       activity, counted back from today over the
//                       employee's own activity list.
//   Best Week Score     the highest real weekly rate in the window.
//   Improvement Trend   this week's rate minus last week's, both real.
//
// A highlight whose inputs don't exist yet is omitted rather than shown
// as zero, and if none can be derived the whole card returns null — a
// new employee sees fewer columns, never fabricated ones.

function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}

function computeDayStreak(activities) {
  const seen = new Set((activities ?? []).map((a) => dayKey(a.date)));
  if (seen.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  // Today not yet having a submission shouldn't break a run that is
  // otherwise live, so start counting from yesterday in that case.
  if (!seen.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (seen.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Three columns across a 360-390px phone leaves roughly 100px each, so
// the label is allowed to WRAP to two lines rather than ellipsize —
// "Consist…" / "Improve…" tells the reader nothing, and these three
// labels are the only thing naming what each number means.
function Column({ icon: Icon, value, unit, label, tone, trendDir }) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-2 px-1.5 first:pl-0 last:pr-0">
      <span
        className={`shrink-0 w-8 h-8 rounded-full grid place-items-center ${tone.bg} ${tone.text}`}
        style={{ boxShadow: tone.shadow }}
      >
        <Icon size={15} strokeWidth={2.1} />
      </span>
      <div className="min-w-0">
        <p className="flex items-baseline gap-0.5 leading-none">
          {trendDir === "up" && <ArrowUpRight size={12} className="text-emerald-400 shrink-0" />}
          {trendDir === "down" && <ArrowDownRight size={12} className="text-[#FF5C5C] shrink-0" />}
          <span className="font-display text-[18px] font-bold text-white tabular-nums">{value}</span>
          {unit && <span className="text-[10px] text-[#8B93A8]">{unit}</span>}
        </p>
        <p className="mt-1 text-[9.5px] leading-[1.25] text-[#8B93A8]">{label}</p>
      </div>
    </div>
  );
}

const TONES = {
  emerald: { bg: "bg-emerald-500/[0.12]", text: "text-emerald-400", shadow: "0 0 16px 1px rgba(52,211,153,0.35)" },
  violet: { bg: "bg-violet-500/[0.12]", text: "text-violet-400", shadow: "0 0 16px 1px rgba(167,139,250,0.35)" },
  sky: { bg: "bg-sky-500/[0.12]", text: "text-sky-400", shadow: "0 0 16px 1px rgba(56,189,248,0.35)" },
};

export default function HighlightsCard({ weekly, activities }) {
  const buckets = weekly ?? [];
  const columns = [];

  const streak = computeDayStreak(activities);
  if (streak > 0) {
    columns.push({
      key: "streak",
      icon: Flame,
      value: streak,
      unit: streak === 1 ? "Day" : "Days",
      label: "Consistency Streak",
      tone: TONES.emerald,
    });
  }

  const rated = buckets.filter((w) => w.rate != null);
  if (rated.length > 0) {
    const best = rated.reduce((a, b) => (b.rate > a.rate ? b : a));
    columns.push({
      key: "best",
      icon: Trophy,
      value: `${Math.round(best.rate)}%`,
      label: "Best Week Score",
      tone: TONES.violet,
    });
  }

  if (buckets[0]?.rate != null && buckets[1]?.rate != null) {
    const delta = Math.round(buckets[0].rate - buckets[1].rate);
    columns.push({
      key: "trend",
      icon: LineChart,
      value: `${Math.abs(delta)}%`,
      label: "Improvement Trend",
      tone: TONES.sky,
      trendDir: delta > 0 ? "up" : delta < 0 ? "down" : null,
    });
  }

  if (columns.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-[22px] p-4 bg-[#0D1223]/80 border border-white/[0.07] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.8)]">
      {/* Decorative wash + wave — purely visual, never over the text. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-20 -right-10 w-52 h-52 rounded-full bg-[#F47A20]/[0.09] blur-3xl animate-ambient-drift" />
        <div
          className="absolute -bottom-24 -left-12 w-52 h-52 rounded-full bg-violet-500/[0.09] blur-3xl animate-ambient-drift"
          style={{ animationDelay: "-3s" }}
        />
        <svg className="absolute inset-x-0 bottom-0 w-full h-14 opacity-[0.12]" viewBox="0 0 400 60" preserveAspectRatio="none">
          <path d="M0 40 C 60 10, 120 55, 200 32 S 340 8, 400 30 L400 60 L0 60 Z" fill="#F47A20" />
        </svg>
      </div>

      <h2 className="relative text-[15px] font-bold text-white">Your Highlights</h2>

      <div className="relative mt-3.5 flex items-stretch divide-x divide-white/[0.07]">
        {columns.map((c) => (
          <Column
            key={c.key}
            icon={c.icon}
            value={c.value}
            unit={c.unit}
            label={c.label}
            tone={c.tone}
            trendDir={c.trendDir}
          />
        ))}
      </div>
    </section>
  );
}
