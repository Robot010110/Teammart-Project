import { BarChart3 } from "lucide-react";

// StatsSection.jsx — chart placeholders (no charting library dependency,
// no backend). Swap the <MiniBarChart> internals for Recharts/Chart.js
// once real time-series data is available.

function MiniBarChart({ title, series, suffix = "%" }) {
  const max = Math.max(...series.map((s) => s.value), 1);
  return (
    <div className="rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.06]">
      <p className="text-xs font-medium text-[#C9CEDB] mb-3">{title}</p>
      <div className="flex items-end justify-between gap-2 h-24">
        {series.map((s) => (
          <div key={s.label} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-[#F47A20] to-[#ffab5e] transition-all duration-500"
                style={{ height: `${(s.value / max) * 100}%` }}
                title={`${s.value}${suffix}`}
              />
            </div>
            <span className="text-[9px] text-[#4C5266]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionChart({ series }) {
  const total = series.reduce((sum, s) => sum + s.value, 0);
  const colors = ["#F47A20", "#1D2D5C", "#2E8FD1", "#2F8F6B", "#7C5CF4"];
  return (
    <div className="rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.06]">
      <p className="text-xs font-medium text-[#C9CEDB] mb-3">Department Distribution</p>
      <div className="h-3 rounded-full overflow-hidden flex mb-3">
        {series.map((s, i) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: colors[i % colors.length] }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[10px] text-[#9AA1B4]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
            {s.label} · {Math.round((s.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default function StatsSection({ charts }) {
  return (
    <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <h2 className="flex items-center gap-2 font-display font-semibold text-white mb-4">
        <BarChart3 size={17} className="text-[#F47A20]" />
        Statistics
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MiniBarChart title="Monthly Activity" series={charts.monthlyActivity} suffix=" tasks" />
        <MiniBarChart title="Task Completion" series={charts.taskCompletion} />
        <MiniBarChart title="Attendance" series={charts.attendance} />
        <MiniBarChart title="Performance Trend" series={charts.performanceTrend} />
        <div className="sm:col-span-2">
          <DistributionChart series={charts.departmentDistribution} />
        </div>
      </div>
    </section>
  );
}
