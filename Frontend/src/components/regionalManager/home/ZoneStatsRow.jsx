import { Users, UserCog, Store } from "lucide-react";

const TONE = {
  employees: "text-[#7EA6FF] bg-[#7EA6FF]/10",
  supervisors: "text-[#C08BFF] bg-[#C08BFF]/10",
  markets: "text-[#F47A20] bg-[#F47A20]/10",
};

function StatCard({ tone, icon: Icon, label, value, onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 px-2.5 py-3 text-left backdrop-blur-xl transition-all duration-200 hover:border-white/[0.14] active:scale-[0.98]"
    >
      <span className={`grid h-7 w-7 place-items-center rounded-lg ${TONE[tone]}`}>
        <Icon size={14} />
      </span>
      <p className="mt-2 font-display text-[17px] font-bold leading-none tabular-nums text-white">
        {loading ? "—" : value.toLocaleString("en-US")}
      </p>
      <p className="mt-1 truncate text-[10.5px] text-[#8B93A8]">{label}</p>
    </button>
  );
}

// ZoneStatsRow.jsx — the three compact counts under the hero. All three
// are real and each one opens the real page that lists what it counts,
// so none of them is a dead tile:
//   Employees   summed employeesCount across the zone's markets
//   Supervisors distinct assigned supervisor/overlooking names
//   Markets     the zone's real market count
export default function ZoneStatsRow({ employees, supervisors, markets, basePath, navigate, loading }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <StatCard
        tone="employees"
        icon={Users}
        label="Employees"
        value={employees}
        loading={loading}
        onClick={() => navigate(`${basePath}/employees`)}
      />
      <StatCard
        tone="supervisors"
        icon={UserCog}
        label="Supervisors"
        value={supervisors}
        loading={loading}
        onClick={() => navigate(`${basePath}/markets`)}
      />
      <StatCard
        tone="markets"
        icon={Store}
        label="Markets"
        value={markets}
        loading={loading}
        onClick={() => navigate(`${basePath}/markets`)}
      />
    </div>
  );
}
