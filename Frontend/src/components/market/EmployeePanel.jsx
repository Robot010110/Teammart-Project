import { useState } from "react";
import { Users2, Search } from "lucide-react";
import EmployeeMiniCard from "./EmployeeMiniCard";

// EmployeePanel.jsx — "Employees" card, left column of the Market Dashboard.

export default function EmployeePanel({ employees, onOpenEmployee }) {
  const [query, setQuery] = useState("");

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(query.toLowerCase()) ||
    e.role.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 font-display font-semibold text-white">
          <Users2 size={17} className="text-[#F47A20]" />
          Employees
        </h2>
        <span className="text-xs text-[#8B93A8]">{employees.length} total</span>
      </div>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employee or role..."
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-8 pr-3 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 transition-colors duration-200"
        />
      </div>

      <div className="space-y-2 overflow-y-auto pr-1 max-h-[520px]">
        {filtered.map((employee) => (
          <EmployeeMiniCard key={employee.id} employee={employee} onOpen={onOpenEmployee} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-[#4C5266] text-center py-6">No employees match "{query}".</p>
        )}
      </div>
    </section>
  );
}
