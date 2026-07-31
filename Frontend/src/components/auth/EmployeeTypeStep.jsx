import { HardHat, Wallet } from "lucide-react";

// EmployeeTypeStep.jsx — Worker vs Cashier, shown after picking "Employee"
// at the role-picker step. Both are Employee-level accounts (same backend
// model, same JWT `kind: "employee"`), just with different login
// identifiers and workspaces — see EmployeeCodeStep.jsx (Worker,
// employee code) vs CashierUsernameStep.jsx (Cashier, username).
//
// Same two-tile visual pattern as ItemReportFlow's method-choice step,
// reused here rather than inventing a new button style for what's
// functionally the same kind of choice (pick one of two paths forward).

export default function EmployeeTypeStep({ onSelect }) {
  return (
    <div className="max-w-sm mx-auto animate-fade-up grid grid-cols-2 gap-3">
      <button
        onClick={() => onSelect("worker")}
        className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] active:scale-[0.98] transition-all duration-200"
      >
        <HardHat size={22} className="text-[#F47A20]" />
        <span className="text-sm font-medium text-white">Worker</span>
      </button>
      <button
        onClick={() => onSelect("cashier")}
        className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] active:scale-[0.98] transition-all duration-200"
      >
        <Wallet size={22} className="text-[#F47A20]" />
        <span className="text-sm font-medium text-white">Cashier</span>
      </button>
    </div>
  );
}
