import { X, Clock3, MapPin } from "lucide-react";
import { TASK_STATUS_TONE } from "../../data/constants";
import PhotoEvidence from "../common/PhotoEvidence";

// DayDetailPanel.jsx — slide-in panel showing everything completed on the
// day selected in ActivityCalendar.

export default function DayDetailPanel({ day, monthLabel, onClose }) {
  if (!day) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="relative w-full max-w-sm h-full bg-[#171C2E] border-l border-white/10 shadow-2xl animate-slide-in overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#171C2E]/95 backdrop-blur-xl">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#8B93A8]">{monthLabel}</p>
            <h3 className="font-display font-semibold text-white text-lg">Day {day.day}</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full grid place-items-center bg-white/5 hover:bg-white/10 transition-colors duration-200">
            <X size={16} className="text-[#E8E8E8]" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {day.activities.length === 0 ? (
            <p className="text-sm text-[#4C5266] text-center py-10">No activity recorded on this day.</p>
          ) : (
            day.activities.map((activity, i) => (
              <div key={i} className="rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{activity.type}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TASK_STATUS_TONE[activity.status]}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {activity.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-[#9AA1B4]">
                  <span className="flex items-center gap-1"><Clock3 size={12} /> {activity.time}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} /> {activity.department}</span>
                </div>
                {activity.notes && <p className="mt-2 text-xs text-[#8B93A8]">{activity.notes}</p>}
                {activity.approvedBy && (
                  <p className="mt-1.5 text-[11px] text-[#6B7284]">Approved by: <span className="text-[#9AA1B4]">{activity.approvedBy}</span></p>
                )}
                {activity.requiresPhoto && (
                  <PhotoEvidence
                    compact
                    retentionLabel={
                      activity.photoExpired
                        ? "Photo expired and was removed"
                        : `Photo available for ${activity.photoExpiresInDays} more day${activity.photoExpiresInDays === 1 ? "" : "s"}`
                    }
                  />
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
