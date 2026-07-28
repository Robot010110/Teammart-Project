import { useState } from "react";
import Breadcrumb from "../components/layout/Breadcrumb";
import ProfileHeader from "../components/employee/ProfileHeader";
import PerformanceCards from "../components/employee/PerformanceCards";
import ActivityCalendar from "../components/employee/ActivityCalendar";
import DayDetailPanel from "../components/employee/DayDetailPanel";
import ActivityTimeline from "../components/employee/ActivityTimeline";
import CompletedTasksModal from "../components/employee/CompletedTasksModal";
import StatsSection from "../components/employee/StatsSection";
import { getEmployeeById } from "../data/marketData";
import {
  generateMonthlyCalendar, generatePerformanceStats, generateTimeline, generateChartSeries,
} from "../data/employeeData";

// EmployeeProfile.jsx — full work-history profile, opened from an employee
// card in the Market Dashboard's Employee panel.

export default function EmployeeProfile({ employeeId, role, onGoHome, onGoZone, onGoMarket }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const found = getEmployeeById(employeeId);
  if (!found) {
    return (
      <div className="px-6 py-16 text-center text-[#9AA1B4]">
        Employee not found.{" "}
        <button onClick={onGoHome} className="text-[#F47A20] underline">Go back</button>
      </div>
    );
  }

  const { employee, market, zone } = found;
  const stats = generatePerformanceStats(employeeId);
  const calendar = generateMonthlyCalendar(employeeId);
  const timeline = generateTimeline(employeeId, calendar);
  const completedTasks = timeline.filter((t) => t.status === "Completed");
  const charts = generateChartSeries(employeeId);
  const monthLabel = new Date(calendar.year, calendar.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const dayData = selectedDay ? calendar.days.find((d) => d.day === selectedDay) : null;

  const breadcrumbItems =
    role === "supervisor"
      ? [{ label: market.name, onClick: () => onGoMarket(market.id) }, { label: employee.name }]
      : [
          { label: "Home", onClick: onGoHome },
          { label: `Zone ${zone.number}`, onClick: () => onGoZone(zone.id) },
          { label: market.name, onClick: () => onGoMarket(market.id) },
          { label: employee.name },
        ];

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto animate-fade-up">
      <Breadcrumb items={breadcrumbItems} />

      <div className="mt-4 space-y-6">
        <ProfileHeader employee={{ ...employee, performanceScore: stats.performanceScore }} market={market} />

        <PerformanceCards stats={stats} onOpenCompletedTasks={() => setShowCompletedTasks(true)} />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
          <ActivityCalendar calendar={calendar} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          <ActivityTimeline entries={timeline} />
        </div>

        <StatsSection charts={charts} />
      </div>

      <DayDetailPanel day={dayData} monthLabel={monthLabel} onClose={() => setSelectedDay(null)} />
      <CompletedTasksModal open={showCompletedTasks} onClose={() => setShowCompletedTasks(false)} tasks={completedTasks} />
    </div>
  );
}
