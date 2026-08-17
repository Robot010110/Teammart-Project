import { useState } from "react";
import { Sparkles, PackageX, ClipboardList, ChevronRight, Image as ImageIcon } from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import Modal from "../components/common/Modal";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ActivityStatusPill from "../components/common/ActivityStatusPill";
import { useAsync } from "../hooks/useAsync";
import { getMarketSectionDetail } from "../services/marketManagementService";

function timeLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function EventRow({ icon: Icon, title, subtitle, time, status, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-start gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors text-left"
    >
      <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{title}</p>
        {subtitle && <p className="text-xs text-[#8B93A8] mt-0.5">{subtitle}</p>}
        <p className="text-[11px] text-[#4C5266] mt-1">{time}</p>
      </div>
      {status && <ActivityStatusPill status={status} />}
      {onOpen && <ChevronRight size={15} className="text-[#4C5266] shrink-0 mt-1" />}
    </button>
  );
}

// RmSectionDetail.jsx — spec §8: observation mode only. Real activity
// from this department's employees over the last 14 days (Activities,
// Expired/Wasted Item reports, Wasted Overall reports — all real models,
// see marketManagementController.getMarketSectionDetail), with photo
// evidence viewable. No write actions anywhere on this screen — the
// Regional Manager inspects, doesn't operate the department.
export default function RmSectionDetail({ marketId, department, onOpenEmployee, onBack }) {
  const { data, error, loading, reload } = useAsync(() => getMarketSectionDetail(marketId, department), { deps: [marketId, department] });
  const [evidence, setEvidence] = useState(null);

  if (loading) return <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto"><SkeletonCard className="h-64" /></div>;
  if (error) return <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto"><ErrorBanner message={error} onRetry={reload} /></div>;

  const events = [
    ...data.recentActivities.map((a) => ({
      id: `activity-${a.id}`,
      icon: Sparkles,
      title: `${a.employee?.name ?? "Employee"} logged an activity`,
      subtitle: a.notes || (a.images?.length ? `${a.images.length} photo(s) attached` : a.category.replace(/_/g, " ").toLowerCase()),
      rawTime: a.updatedAt ?? a.createdAt,
      status: a.status,
      images: a.images?.map((img) => img.url) ?? [],
    })),
    ...data.recentItemReports.map((r) => ({
      id: `item-${r.id}`,
      icon: PackageX,
      title: `${r.employee?.name ?? "Employee"} reported ${r.condition === "EXPIRED" ? "expired" : "wasted"} items`,
      subtitle: `${r.product?.name ?? "Item"} × ${r.quantity}`,
      rawTime: r.reportedAt,
      status: r.status,
      images: r.imageUrl ? [r.imageUrl] : [],
    })),
    ...data.recentWastedReports.map((r) => ({
      id: `wasted-${r.id}`,
      icon: PackageX,
      title: `${r.employee?.name ?? "Employee"} submitted a waste report`,
      subtitle: r.item,
      rawTime: r.reportedAt,
      status: r.status,
      images: r.photoUrl ? [r.photoUrl] : [],
    })),
  ].sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime));

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto animate-fade-up">
      <Breadcrumb items={[{ label: "Market", onClick: onBack }, { label: department }]} />

      <h1 className="mt-4 font-display text-2xl font-bold text-white">{department}</h1>
      <p className="mt-1 text-sm text-[#9AA1B4]">Recent condition and activity — last 14 days, observation only.</p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Assigned Employees</h2>
          {data.employees.length === 0 ? (
            <p className="text-sm text-[#4C5266]">No employees in this department.</p>
          ) : (
            <div className="space-y-2">
              {data.employees.map((e) => {
                const active = e.status === "ACTIVE";
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onOpenEmployee(e.id)}
                    className="w-full flex items-center gap-2.5 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors text-left"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-emerald-400" : "bg-[#4C5266]"}`} />
                    <span className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{e.name}</p>
                      <p className="text-[11px] text-[#8B93A8]">{active ? "Active" : "Off Shift"}</p>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Recent Activity</h2>
          {events.length === 0 ? (
            <div className="rounded-xl p-8 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
              No recorded activity in this department recently.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <EventRow
                  key={ev.id}
                  icon={ev.icon}
                  title={ev.title}
                  subtitle={ev.subtitle}
                  time={timeLabel(ev.rawTime)}
                  status={ev.status}
                  onOpen={ev.images.length ? () => setEvidence(ev.images) : undefined}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal open={!!evidence} onClose={() => setEvidence(null)} title="Evidence">
        <div className="grid grid-cols-2 gap-2">
          {evidence?.map((url, i) => (
            <img key={i} src={url} alt="" className="rounded-lg w-full aspect-square object-cover" />
          ))}
        </div>
        {evidence?.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-[#8B93A8]"><ImageIcon size={14} /> No photos attached.</p>
        )}
      </Modal>
    </div>
  );
}
