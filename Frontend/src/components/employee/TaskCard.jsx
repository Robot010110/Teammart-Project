import { useEffect, useState } from "react";
import { Timer, MapPin } from "lucide-react";
import { categoryVisual } from "../../utils/suddenTaskVisuals";

const PRIORITY_LABEL = { NORMAL: "Normal Priority", HIGH: "High Priority", URGENT: "Urgent" };
const PRIORITY_TONE = { NORMAL: "text-sky-400", HIGH: "text-amber-400", URGENT: "text-red-400" };

function dueLabel(dueAt) {
  const due = new Date(dueAt);
  const now = new Date();
  const sameDay = due.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = due.toDateString() === tomorrow.toDateString();
  const time = due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Due Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${time}`;
}

function elapsedLabel(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// TaskCard.jsx — My Tasks redesign: the compact, scalable list card
// (1 task or 50 tasks look the same size — the reference's large hero
// treatment is reserved for TaskDetail, per the brief's own explicit
// "do NOT use a giant hero card for every active task" rule). Icon comes
// from the task's real `category` field via suddenTaskVisuals.js, never
// per-task artwork.
//
// Global Visual System Evolution — a thin status-colored left edge
// (emerald=completed, amber=in progress, neutral=still pending) so a
// task's state reads at a glance across a long list without needing to
// read the pill text — real status only, never a fabricated indicator.
// A plain absolutely-positioned span, not a `::before` pseudo-element —
// card-premium already owns `::before` for its own gradient highlight,
// so this stays a real DOM node to avoid colliding with that.
const STATUS_EDGE = {
  COMPLETED: "bg-emerald-400",
  IN_PROGRESS: "bg-[#F47A20]",
  ASSIGNED: "bg-white/10",
};

export default function TaskCard({ task, onClick }) {
  const visual = categoryVisual(task.category);
  const Icon = visual.icon;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (task.status !== "IN_PROGRESS") return;
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [task.status]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-premium relative w-full text-left rounded-2xl p-4 pl-[18px] bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl hover:border-[#F47A20]/25 active:scale-[0.99] transition-all"
    >
      <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${STATUS_EDGE[task.status] ?? STATUS_EDGE.ASSIGNED}`} aria-hidden="true" />
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${PRIORITY_TONE[task.priority] ?? "text-sky-400"}`}>
          {PRIORITY_LABEL[task.priority] ?? task.priority}
        </span>
        {task.status === "IN_PROGRESS" ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#F47A20]">
            <Timer size={11} /> {elapsedLabel(now - new Date(task.startedAt).getTime())}
          </span>
        ) : (
          task.dueAt && <span className="text-[11px] text-[#8B93A8]">{dueLabel(task.dueAt)}</span>
        )}
      </div>

      <div className="flex items-start gap-3">
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${visual.bg} ${visual.tone} ${visual.glow}`}>
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{task.title}</p>
          <p className="text-xs text-[#8B93A8] truncate mt-0.5 flex items-center gap-1">
            {visual.label}
            {task.location && (
              <>
                <span aria-hidden="true">·</span>
                <MapPin size={10} className="shrink-0" /> {task.location}
              </>
            )}
          </p>
        </div>
      </div>
    </button>
  );
}
