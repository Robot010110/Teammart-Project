import { User, Store, Users2 } from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import MarketGrid from "../components/markets/MarketGrid";
import { getZoneById } from "../data/mockData";

// ZonePage.jsx — drill-down page listing all markets inside a zone.

export default function ZonePage({ zoneId, onGoHome, onOpenMarket }) {
  const zone = getZoneById(zoneId);

  if (!zone) {
    return (
      <div className="px-6 py-16 text-center text-[#9AA1B4]">
        Zone not found.{" "}
        <button onClick={onGoHome} className="text-[#F47A20] underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto animate-fade-up">
      <Breadcrumb
        items={[
          { label: "Home", onClick: onGoHome },
          { label: `Zone ${zone.number}` },
        ]}
      />

      <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">
            Zone {zone.number}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-[#9AA1B4] text-sm">
            <User size={15} /> Managed by <span className="text-white font-medium">{zone.manager}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <StatCard icon={Store} label="Markets" value={zone.marketsCount} />
          <StatCard icon={Users2} label="Employees" value={zone.employeesCount} />
        </div>
      </div>

      <h2 className="mt-10 mb-4 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">
        Markets in this zone
      </h2>

      <MarketGrid markets={zone.markets} onOpenMarket={onOpenMarket} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 bg-[#1F2436]/70 border border-white/[0.06]">
      <Icon size={17} className="text-[#F47A20]" />
      <div className="leading-tight">
        <p className="text-white font-semibold text-sm">{value}</p>
        <p className="text-[10px] uppercase tracking-wide text-[#8B93A8]">{label}</p>
      </div>
    </div>
  );
}
