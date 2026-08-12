import { Sun, Moon } from "lucide-react";

// SupervisorShiftStep.jsx — Supervisor (Morning Shift) vs Overlooking
// (Evening Shift), shown after picking "Supervisor" at the role-picker
// step. Same account type/permission model either way (see Supervisor
// Mode's permission model) — this only decides the shift label shown
// throughout the mobile Supervisor Mode UI and which management person
// a given task/notification is attributed to.

export default function SupervisorShiftStep({ onSelect }) {
  return (
    <div className="max-w-sm mx-auto animate-fade-up grid grid-cols-2 gap-3">
      <button
        onClick={() => onSelect("MORNING")}
        className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] active:scale-[0.98] transition-all duration-200"
      >
        <Sun size={22} className="text-[#F47A20]" />
        <span className="text-sm font-medium text-white">Supervisor</span>
        <span className="text-[11px] text-[#8B93A8]">Morning Shift</span>
      </button>
      <button
        onClick={() => onSelect("EVENING")}
        className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] active:scale-[0.98] transition-all duration-200"
      >
        <Moon size={22} className="text-[#F47A20]" />
        <span className="text-sm font-medium text-white">Overlooking</span>
        <span className="text-[11px] text-[#8B93A8]">Evening Shift</span>
      </button>
    </div>
  );
}
