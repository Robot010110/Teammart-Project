import { useState } from "react";
import { LayoutDashboard } from "lucide-react";
import DepartmentTile from "./DepartmentTile";
import DepartmentDetailPanel from "./DepartmentDetailPanel";

// MarketMap.jsx — digital floor-plan recreation (rectangles + labels, not an
// uploaded image) built on a CSS grid so it stays responsive. Clicking a
// department opens the full detail panel (assigned employee, latest photo,
// latest activity, and who actually completed the last task).

export default function MarketMap({ departments }) {
  const [openDept, setOpenDept] = useState(null);

  return (
    <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 font-display font-semibold text-white">
          <LayoutDashboard size={17} className="text-[#F47A20]" />
          Store Map
        </h2>
      </div>

      <div
        className="grid gap-1.5 flex-1 min-h-[420px]"
        style={{ gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(9, 1fr)" }}
      >
        {departments.map((dept) => (
          <DepartmentTile key={dept.id} dept={dept} isSelected={openDept?.id === dept.id} onSelect={setOpenDept} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-[#4C5266]">
        Click a department to see who's assigned, the latest photo, and recent activity.
      </p>

      <DepartmentDetailPanel department={openDept} onClose={() => setOpenDept(null)} />
    </section>
  );
}
