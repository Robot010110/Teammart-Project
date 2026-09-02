import { CheckCircle2, ClipboardX } from "lucide-react";

// TaskEmptyState.jsx — My Tasks redesign. Two real variants (no fake
// artwork import — this project has no illustration assets anywhere,
// same conclusion as the Activity/Home redesigns): "active" for zero
// pending/in-progress tasks, "completed" for never having finished one
// yet.
export default function TaskEmptyState({ variant = "active" }) {
  if (variant === "completed") {
    return (
      <div className="flex flex-col items-center text-center py-14 px-6">
        <span className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center text-[#4C5266] mb-4">
          <ClipboardX size={24} />
        </span>
        <p className="text-sm font-semibold text-white">No completed tasks yet</p>
        <p className="text-xs text-[#8B93A8] mt-1">Your completed work will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <span className="relative w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
        <span className="absolute inset-0 rounded-full bg-emerald-500/10 animate-glow-pulse" aria-hidden="true" />
        <CheckCircle2 size={28} className="relative" />
      </span>
      <p className="text-base font-semibold text-white">You're all caught up</p>
      <p className="text-xs text-[#8B93A8] mt-1 max-w-[220px]">You have no active tasks right now. Take a breath — you've earned it.</p>
    </div>
  );
}
