import { STATUS_TONE } from "../../data/constants";

// EmployeeMiniCard.jsx — compact interactive employee card for the
// Market Dashboard's left-hand Employees panel.

const ROLE_ACCENT = {
  Supervisor: "from-[#F47A20] to-[#c95c10]",
  Storekeeper: "from-[#7C5CF4] to-[#5237b8]",
  Overlooking: "from-[#7C5CF4] to-[#5237b8]",
  Worker: "from-[#1D2D5C] to-[#324a8f]",
  Assistant: "from-[#2F8F6B] to-[#1e6b4f]",
  Cashier: "from-[#2E8FD1] to-[#1e6ba0]",
  Butcher: "from-[#C4453B] to-[#932e26]",
};

export default function EmployeeMiniCard({ employee, onOpen }) {
  return (
    <button
      onClick={() => onOpen(employee)}
      className="w-full flex items-center gap-3 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.05]
                 text-left transition-all duration-200 ease-out
                 hover:-translate-y-0.5 hover:border-[#F47A20]/35 hover:bg-[#1F2436]
                 hover:shadow-[0_10px_24px_rgba(244,122,32,0.10)] active:scale-[0.98] cursor-pointer"
    >
      <div
        className={`relative h-10 w-10 shrink-0 rounded-full bg-gradient-to-br ${
          ROLE_ACCENT[employee.role] || ROLE_ACCENT.Worker
        } grid place-items-center ring-1 ring-white/10`}
      >
        <span className="text-xs font-semibold text-white">{employee.initials}</span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1A1F33] ${
            employee.status === "Online" ? "bg-emerald-400" : "bg-[#4C5266]"
          }`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{employee.name}</p>
        <p className="text-xs text-[#9AA1B4] truncate">{employee.displayRole || employee.role} · {employee.shift}</p>
      </div>

      <span
        className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${STATUS_TONE[employee.status]}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {employee.status}
      </span>
    </button>
  );
}
