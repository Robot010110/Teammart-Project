import { useState } from "react";
import {
  Trash2, PackagePlus, LayoutGrid as FacingIcon, Sparkles, History, ChevronRight, ImageIcon,
} from "lucide-react";
import { TASK_STATUS_TONE } from "../../data/constants";
import Modal from "../common/Modal";
import PhotoEvidence from "../common/PhotoEvidence";

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TASK_STATUS_TONE[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function TaskCard({ icon: Icon, title, status, children, onClick, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 border transition-all duration-200 ease-out
        hover:-translate-y-0.5 hover:border-[#F47A20]/35 active:scale-[0.99] cursor-pointer
        ${highlight ? "bg-[#F47A20]/[0.06] border-[#F47A20]/25" : "bg-[#1A1F33]/70 border-white/[0.05]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-white/5 grid place-items-center shrink-0">
            <Icon size={15} className="text-[#F47A20]" />
          </div>
          <span className="text-sm font-medium text-white">{title}</span>
        </div>
        {status && <StatusBadge status={status} />}
      </div>
      {children && <div className="mt-3 pl-[42px]">{children}</div>}
    </button>
  );
}

export default function ActivityPanel({ data }) {
  const [openPanel, setOpenPanel] = useState(null); // "wasted" | "overview" | null

  return (
    <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl h-full flex flex-col">
      <h2 className="flex items-center gap-2 font-display font-semibold text-white mb-4">
        <Sparkles size={17} className="text-[#F47A20]" />
        Today's Activities
      </h2>

      <div className="space-y-3">
        {/* Wasted Items — new, always on top */}
        <TaskCard
          icon={Trash2}
          title="Wasted Items"
          status={data.wastedItems.status}
          highlight
          onClick={() => setOpenPanel("wasted")}
        >
          <p className="text-xs text-[#9AA1B4]">
            {data.wastedItems.itemsReported} item{data.wastedItems.itemsReported === 1 ? "" : "s"} reported today
          </p>
        </TaskCard>

        {/* Refilling */}
        <TaskCard icon={PackagePlus} title="Refilling" status={data.refilling.status}>
          <div className="space-y-1.5 text-xs text-[#9AA1B4]">
            <div className="flex items-center justify-between">
              <span>Progress</span>
              <span className="text-white">{data.refilling.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#F47A20] transition-all duration-500"
                style={{ width: `${data.refilling.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="flex items-center gap-1"><ImageIcon size={12} /> {data.refilling.picturesUploaded} photos</span>
              <span>{data.refilling.completionTime}</span>
            </div>
          </div>
        </TaskCard>

        {/* Facing — multiple daily sessions */}
        <TaskCard icon={FacingIcon} title="Facing">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Morning", data.facing.morning],
              ["Afternoon", data.facing.afternoon],
              ["Evening", data.facing.evening],
            ].map(([label, status]) => (
              <div key={label} className="rounded-lg bg-white/[0.03] p-2 text-center">
                <p className="text-[10px] text-[#8B93A8]">{label}</p>
                <p
                  className={`mt-1 text-[10px] font-medium ${
                    status === "Completed" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {status}
                </p>
              </div>
            ))}
          </div>
        </TaskCard>

        {/* Cleaning */}
        <TaskCard icon={Sparkles} title="Cleaning" status={data.cleaning.status}>
          <div className="flex items-center justify-between text-xs text-[#9AA1B4]">
            <span>{data.cleaning.time}</span>
            <span className="flex items-center gap-1"><ImageIcon size={12} /> {data.cleaning.picturesUploaded} photos</span>
          </div>
        </TaskCard>

        {/* Day Overview — summary, opens timeline */}
        <button
          onClick={() => setOpenPanel("overview")}
          className="w-full flex items-center justify-between rounded-xl p-4 bg-[#1D2D5C]/40 border border-white/[0.06] hover:border-[#F47A20]/35 transition-all duration-200 active:scale-[0.99]"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium text-white">
            <History size={15} className="text-[#F47A20]" />
            Day Overview
          </span>
          <ChevronRight size={16} className="text-[#8B93A8]" />
        </button>
      </div>

      {/* Wasted items modal */}
      <Modal open={openPanel === "wasted"} onClose={() => setOpenPanel(null)} title="Today's Wasted Item Report">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <StatusBadge status={data.wastedItems.status} />
            <span className="text-xs text-[#8B93A8]">{data.wastedItems.itemsReported} items reported</span>
          </div>
          <PhotoEvidence retentionLabel="Daily monitoring photo — auto-deletes after 8 hours" />
          <p className="text-xs text-[#8B93A8]">
            Full itemized waste log connects here once the reporting API is available.
          </p>
        </div>
      </Modal>

      {/* Day overview / timeline modal */}
      <Modal open={openPanel === "overview"} onClose={() => setOpenPanel(null)} title="Today's Timeline">
        <ol className="space-y-3">
          {data.dayOverview.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="text-[#F47A20] font-mono text-xs w-12 shrink-0 pt-0.5">{item.time}</span>
              <span className="text-[#D6D9E3]">{item.text}</span>
            </li>
          ))}
        </ol>
      </Modal>
    </section>
  );
}
