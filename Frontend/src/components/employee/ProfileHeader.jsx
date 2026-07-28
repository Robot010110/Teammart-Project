import { Store, Clock, MapPin, BadgeCheck } from "lucide-react";

// ProfileHeader.jsx — large header for the Employee Profile page.

export default function ProfileHeader({ employee, market }) {
  return (
    <section className="rounded-2xl p-6 md:p-8 bg-gradient-to-br from-[#1D2D5C]/50 to-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="relative h-24 w-24 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-white/[0.06] mx-auto sm:mx-0">
          <span className="text-2xl font-display font-bold text-white">{employee.initials}</span>
          <span
            className={`absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-full border-[3px] border-[#171C2E] ${
              employee.status === "Online" ? "bg-emerald-400" : "bg-[#4C5266]"
            }`}
          />
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">{employee.name}</h1>
          <p className="mt-1 text-[#F47A20] font-medium text-sm">{employee.displayRole || employee.role}</p>

          <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-2 text-xs text-[#9AA1B4]">
            <span className="flex items-center gap-1.5"><BadgeCheck size={14} /> ID {employee.employeeCode}</span>
            <span className="flex items-center gap-1.5"><Clock size={14} /> {employee.shift}</span>
            <span className="flex items-center gap-1.5"><Store size={14} /> {market.name}</span>
            <span className="flex items-center gap-1.5"><MapPin size={14} /> {employee.status}</span>
          </div>
        </div>

        <div className="text-center shrink-0">
          <div className="relative h-24 w-24 mx-auto">
            <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#F47A20" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(employee.performanceScore ?? 92) * 2.638} 1000`}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-xl font-display font-bold text-white">{employee.performanceScore ?? 92}%</span>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]">Performance</p>
        </div>
      </div>
    </section>
  );
}
