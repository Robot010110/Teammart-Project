import { Package, AlertTriangle } from "lucide-react";

// CartonCapacityCard.jsx — modern replacement for a plain progress bar.

const STATUS_STYLE = {
  Normal: { text: "text-emerald-400", bar: "bg-emerald-400" },
  Warning: { text: "text-amber-400", bar: "bg-amber-400" },
  Full: { text: "text-red-400", bar: "bg-red-400" },
};

export default function CartonCapacityCard({ capacity }) {
  const style = STATUS_STYLE[capacity.status];

  return (
    <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 font-display font-semibold text-white text-sm">
          <Package size={16} className="text-[#F47A20]" />
          Carton Storage
        </h2>
        <span className={`text-xs font-medium ${style.text}`}>{capacity.status}</span>
      </div>

      <div className="flex items-end justify-between mb-2">
        <span className="text-3xl font-display font-bold text-white">{capacity.percent}%</span>
        <span className="text-xs text-[#9AA1B4]">{capacity.used} / {capacity.capacity} Cartons</span>
      </div>

      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full ${style.bar} transition-all duration-700`}
          style={{ width: `${Math.min(capacity.percent, 100)}%` }}
        />
      </div>

      {capacity.status === "Full" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-red-400">Storage Full</p>
            <p className="text-[11px] text-red-300/70">Company notification required.</p>
          </div>
        </div>
      )}
    </section>
  );
}
