import { ClipboardList, Flame, Clock4 } from "lucide-react";
import AnimatedNumber from "../common/AnimatedNumber";

// TaskOverviewBar.jsx — My Tasks redesign: compact real stats over the
// active task list. `dueSoonCount` only ever counts tasks that actually
// have a real dueAt within the window — never implies every task has a
// due time (most won't, since it's optional). Counts animate up on
// mount via AnimatedNumber.
export default function TaskOverviewBar({ activeCount, highPriorityCount, dueSoonCount }) {
  return (
    <div className="card-premium flex items-center gap-4 rounded-2xl px-4 py-3 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl mb-4">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20] glow-orange">
          <ClipboardList size={14} />
        </span>
        <div>
          <p className="text-sm font-bold text-white leading-none"><AnimatedNumber value={activeCount} /></p>
          <p className="text-[10px] text-[#8B93A8] mt-0.5">Active</p>
        </div>
      </div>
      <div className="w-px h-8 bg-white/[0.06]" />
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 glow-red">
          <Flame size={14} />
        </span>
        <div>
          <p className="text-sm font-bold text-white leading-none"><AnimatedNumber value={highPriorityCount} /></p>
          <p className="text-[10px] text-[#8B93A8] mt-0.5">High Priority</p>
        </div>
      </div>
      <div className="w-px h-8 bg-white/[0.06]" />
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 glow-sky">
          <Clock4 size={14} />
        </span>
        <div>
          <p className="text-sm font-bold text-white leading-none"><AnimatedNumber value={dueSoonCount} /></p>
          <p className="text-[10px] text-[#8B93A8] mt-0.5">Due Soon</p>
        </div>
      </div>
    </div>
  );
}
