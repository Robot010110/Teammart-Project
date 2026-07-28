import { User, UserCheck, Camera, Clock3 } from "lucide-react";
import Modal from "../common/Modal";

// DepartmentDetailPanel.jsx — opened when a department tile on the Market
// Map is clicked. Left: latest condition photo. Right: latest activity in
// that area. Top: who's assigned. Bottom: who actually did the last task —
// deliberately kept separate, since another employee may have helped out.

export default function DepartmentDetailPanel({ department, onClose }) {
  if (!department) return null;

  const expiresIn = department.photoExpiresInHours;

  return (
    <Modal open={!!department} onClose={onClose} title={department.name} wide>
      {/* Assigned employee — top */}
      <div className="flex items-center gap-2 text-sm mb-5">
        <User size={15} className="text-[#F47A20]" />
        <span className="text-[#9AA1B4]">Assigned Employee:</span>
        <span className="text-white font-medium">{department.assignedTo}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Left: latest photo */}
        <div>
          <p className="text-xs font-medium text-[#C9CEDB] mb-2">Current Condition</p>
          <div className="aspect-video rounded-xl bg-gradient-to-br from-[#2A3050] to-[#181C2C] border border-white/[0.06] grid place-items-center">
            <div className="text-center">
              <Camera size={26} className="mx-auto text-[#4C5266]" />
              <p className="mt-2 text-[11px] text-[#8B93A8] px-4">
                Most recent photo of this area — placeholder until uploads are connected.
              </p>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#4C5266]">
            <Clock3 size={11} />
            Uploaded {department.photoUploadedHoursAgo}h ago ·{" "}
            {expiresIn > 0 ? `auto-deletes in ${expiresIn}h` : "expired, pending cleanup"}
          </p>
        </div>

        {/* Right: latest activity */}
        <div>
          <p className="text-xs font-medium text-[#C9CEDB] mb-2">Latest Activity</p>
          <div className="rounded-xl bg-[#1A1F33]/70 border border-white/[0.06] p-3 space-y-2">
            {department.recentActivity.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-[#9AA1B4]">{item.label}</span>
                <span className="text-white font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity performer — bottom */}
      <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-sm">
        <UserCheck size={15} className="text-[#F47A20]" />
        <span className="text-[#9AA1B4]">Last task completed by:</span>
        <span className="text-white font-medium">{department.lastCompletedBy}</span>
      </div>
    </Modal>
  );
}
