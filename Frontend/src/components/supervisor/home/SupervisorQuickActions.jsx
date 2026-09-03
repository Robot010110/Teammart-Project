import { useNavigate } from "react-router-dom";
import { Users, ClipboardPlus, MessageSquareWarning, FileBarChart } from "lucide-react";

// SupervisorQuickActions.jsx — compact shortcuts into real, already-
// working flows. Every card lands on a genuinely functional real screen
// — there is no standalone "create task"/"broadcast" modal invented
// here; these are entry points into the exact existing architecture:
//   Team Attendance   the same market/today endpoint Team Status uses.
//   Create Task       assignSuddenTask's real UI lives inside an
//                     employee's own profile (EmployeeTasksSection.jsx,
//                     via SupervisorEmployeeProfileRoute) — there is no
//                     employee-less "create task" flow to link to, so
//                     this opens Employees (pick who, then assign),
//                     matching how the feature actually works today.
//   Broadcast         SupervisorChatTab's real warning-broadcast
//                     capability (postWarningBroadcast).
//   Reports           MarketTab's real "Reports & Problems" section.
//
// "Create Task" is hidden for OVERLOOKING_SUPERVISOR, same as the
// Employees tab itself (spec: Employees isn't part of that role's
// permission set) — no button that would just 403.
export default function SupervisorQuickActions({ session, basePath }) {
  const navigate = useNavigate();
  const isOverlooking = session.staffRole === "OVERLOOKING_SUPERVISOR";

  const actions = [
    { key: "team-attendance", label: "Team Attendance", icon: Users, tone: "blue", onClick: () => navigate(`${basePath}/team-attendance`) },
    ...(!isOverlooking
      ? [{ key: "create-task", label: "Create Task", icon: ClipboardPlus, tone: "orange", onClick: () => navigate(`${basePath}/employees`) }]
      : []),
    { key: "broadcast", label: "Broadcast", icon: MessageSquareWarning, tone: "red", onClick: () => navigate(`${basePath}/chat`) },
    { key: "reports", label: "Reports", icon: FileBarChart, tone: "violet", onClick: () => navigate(`${basePath}/market`) },
  ];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-white">Quick Actions</h2>
      <div className="flex gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
        {actions.map((a) => (
          <QuickActionButton key={a.key} {...a} />
        ))}
      </div>
    </section>
  );
}

const TONES = {
  blue: { text: "text-sky-400", bg: "bg-sky-500/10", glow: "glow-sky-soft" },
  orange: { text: "text-[#F47A20]", bg: "bg-[#F47A20]/10", glow: "glow-orange-soft" },
  red: { text: "text-[#FF5C5C]", bg: "bg-red-500/10", glow: "glow-red" },
  violet: { text: "text-violet-400", bg: "bg-violet-500/10", glow: "glow-violet-soft" },
};

function QuickActionButton({ label, icon: Icon, tone, onClick }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 w-[92px] flex flex-col items-center gap-2 rounded-2xl px-3 py-3.5 bg-[#171C2E]/80 border border-white/[0.06] hover:border-white/[0.14] active:scale-95 transition-all duration-150"
    >
      <span className={`w-10 h-10 rounded-xl grid place-items-center ${t.bg} ${t.glow} ${t.text}`}>
        <Icon size={18} />
      </span>
      <span className="text-[11px] font-medium text-white text-center leading-tight">{label}</span>
    </button>
  );
}
