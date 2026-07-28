import Breadcrumb from "../components/layout/Breadcrumb";
import StatusPill from "../components/common/StatusPill";
import EmployeePanel from "../components/market/EmployeePanel";
import MarketMap from "../components/market/MarketMap";
import ActivityPanel from "../components/market/ActivityPanel";
import CartonCapacityCard from "../components/market/CartonCapacityCard";
import { getMarketDashboardData } from "../data/marketData";
import { Users2 } from "lucide-react";

// MarketDashboard.jsx — opened when a market card is clicked from ZonePage.
// Four sections: Employees (left), Store Map (center), Today's Activities
// (right), Carton Capacity (bottom right).

export default function MarketDashboard({ marketId, role, onGoHome, onGoZone, onOpenEmployee }) {
  const data = getMarketDashboardData(marketId);

  if (!data) {
    return (
      <div className="px-6 py-16 text-center text-[#9AA1B4]">
        Market not found.{" "}
        <button onClick={onGoHome} className="text-[#F47A20] underline">Go back</button>
      </div>
    );
  }

  const { market, zone, employees, departments, todayActivities, cartonCapacity } = data;

  // A Supervisor is scoped to exactly one market and never sees zones, so
  // their breadcrumb skips straight to the market name. A Regional Manager
  // still sees Home -> Zone -> Market since they oversee multiple markets.
  const breadcrumbItems =
    role === "supervisor"
      ? [{ label: market.name }]
      : [
          { label: "Home", onClick: onGoHome },
          { label: `Zone ${zone.number}`, onClick: () => onGoZone(zone.id) },
          { label: market.name },
        ];

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1600px] mx-auto animate-fade-up">
      <Breadcrumb items={breadcrumbItems} />

      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white uppercase tracking-tight">
            {market.name}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-[#9AA1B4] text-sm">
            <Users2 size={15} /> {employees.length} Employees
          </p>
        </div>
        <StatusPill status={market.status} />
      </div>

      {/* Four-section dashboard grid */}
      <div className="mt-8 grid grid-cols-1 xl:grid-cols-[300px_1fr_320px] gap-5 items-start">
        {/* 1. Employee panel */}
        <EmployeePanel employees={employees} onOpenEmployee={(e) => onOpenEmployee(e.id)} />

        {/* 2. Market map */}
        <MarketMap departments={departments} />

        {/* 3 + 4. Activities + carton capacity stacked */}
        <div className="space-y-5">
          <ActivityPanel data={todayActivities} />
          <CartonCapacityCard capacity={cartonCapacity} />
        </div>
      </div>
    </div>
  );
}
