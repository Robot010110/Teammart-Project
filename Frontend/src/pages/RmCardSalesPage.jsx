import { useState } from "react";
import { CreditCard, CheckCircle2, Clock, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import ErrorBanner from "../components/common/ErrorBanner";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { getCardSalesDay, deleteCardSalesReport } from "../services/cardSalesService";
import { useAsync } from "../hooks/useAsync";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const SHIFT_LABEL = { MORNING: "Morning", AFTERNOON: "Afternoon", NIGHT: "Night" };

// RmCardSalesPage.jsx — spec §8: Markets -> Select Market -> Card Sales.
// The three reporting periods for the selected day (default today),
// each Submitted/Pending with who/when/photos, real data from
// GET /api/card-sales/day. The date picker doubles as the "look back at
// historical reports by date" requirement — no separate history list
// needed since a day IS the natural unit here.
export default function RmCardSalesPage({ marketId, marketName, onBack }) {
  const [date, setDate] = useState(todayIso());
  const { data, error, loading, reload } = useAsync(() => getCardSalesDay(marketId, date), { deps: [marketId, date] });
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(reportId) {
    setDeletingId(reportId);
    try {
      await deleteCardSalesReport(reportId);
      reload();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto animate-fade-up">
      <Breadcrumb items={[{ label: "Markets", onClick: onBack }, { label: marketName ?? "Market", onClick: onBack }, { label: "Card Sales" }]} />

      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-white">Card Sales — {dateLabel(date)}</h1>
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50"
        />
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-[120px]" />)}
          </div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {["MORNING", "AFTERNOON", "NIGHT"].map((shift) => {
              const slot = data.slots[shift];
              const submitted = slot.status === "SUBMITTED";
              const report = slot.report;
              return (
                <div key={shift} className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <CreditCard size={14} className="text-[#F47A20]" /> {SHIFT_LABEL[shift]}
                    </span>
                    {submitted ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-400"><CheckCircle2 size={12} /> Submitted</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(report.id)}
                          disabled={deletingId === report.id}
                          aria-label="Delete report"
                          className="p-1 rounded-lg text-[#4C5266] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                        >
                          {deletingId === report.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-[#4C5266]">Pending</span>
                    )}
                  </div>

                  {submitted && (
                    <>
                      <p className="mt-2 text-xs text-[#8B93A8]">{report.submittedBy?.name} ({report.submittedBy?.role === "OVERLOOKING_SUPERVISOR" ? "Overlooking" : "Supervisor"})</p>
                      <p className="flex items-center gap-1 text-xs text-[#4C5266] mt-0.5"><Clock size={11} /> {timeLabel(report.submittedAt)}</p>
                      <div className="mt-3 flex gap-2">
                        <a href={report.photoUrl} target="_blank" rel="noreferrer">
                          <AuthenticatedImage src={report.photoUrl} alt="Card count" className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10" />
                        </a>
                        {report.photoUrl2 && (
                          <a href={report.photoUrl2} target="_blank" rel="noreferrer">
                            <AuthenticatedImage src={report.photoUrl2} alt="Card count 2" className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10" />
                          </a>
                        )}
                      </div>
                    </>
                  )}
                  {!submitted && (
                    <div className="mt-4 flex flex-col items-center justify-center gap-1.5 py-4 text-[#4C5266]">
                      <ImageIcon size={20} />
                      <p className="text-[11px]">Not submitted yet</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
