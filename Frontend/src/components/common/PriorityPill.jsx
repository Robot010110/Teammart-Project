// PriorityPill.jsx — Normal / High / Urgent indicator, same visual shape
// as StatusPill.jsx (rounded pill, ring, colored dot) but its own small
// component since priority and status are different concepts with
// different value sets.

const STYLES = {
  NORMAL: "bg-white/5 text-[#9AA1B4] ring-white/10",
  HIGH: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  URGENT: "bg-red-500/10 text-red-400 ring-red-500/20",
};

const LABELS = {
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export default function PriorityPill({ priority }) {
  const style = STYLES[priority] || STYLES.NORMAL;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[priority] || priority}
    </span>
  );
}
