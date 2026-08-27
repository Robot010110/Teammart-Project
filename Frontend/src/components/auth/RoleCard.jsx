import { ArrowRight, ShieldCheck, ClipboardList, UserCircle2, Crown } from "lucide-react";

// RoleCard.jsx — one of the role choices on the login screen.

const ICONS = {
  admin: Crown,
  regionalManager: ShieldCheck,
  supervisor: ClipboardList,
  employee: UserCircle2,
};

export default function RoleCard({ role, onSelect, index = 0 }) {
  const Icon = ICONS[role.key];
  return (
    <button
      style={{ animationDelay: `${index * 90}ms` }}
      onClick={() => onSelect(role.key)}
      className="animate-fade-up group relative text-left rounded-2xl p-6 bg-gradient-to-b from-[#1D2D5C]/60 to-[#171C2E]/80
                 border border-white/[0.06] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]
                 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-[#F47A20]/40
                 hover:shadow-[0_20px_45px_rgba(244,122,32,0.15)] active:translate-y-0 active:scale-[0.99] cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-xl bg-[#F47A20]/10 grid place-items-center">
          <Icon size={20} className="text-[#F47A20]" />
        </div>
        <ArrowRight size={18} className="text-[#4C5266] group-hover:text-[#F47A20] group-hover:translate-x-1 transition-all duration-200" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-white">{role.label}</h3>
      <p className="mt-1 text-sm text-[#9AA1B4]">{role.tagline}</p>
      <p className="mt-3 text-xs text-[#6B7284]">{role.hint}</p>
    </button>
  );
}
