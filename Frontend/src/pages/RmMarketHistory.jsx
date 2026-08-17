import { Star, NotebookPen, ShieldAlert, Sparkles, CalendarDays } from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { useAsync } from "../hooks/useAsync";
import { getMarketHistory } from "../services/marketManagementService";

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// RmMarketHistory.jsx — spec §25/§26: every visit, rating, note, and
// Warning/Recognition for this market, newest first, grouped by visit
// where one exists so a single inspection reads as one entry rather than
// scattered unrelated rows.
export default function RmMarketHistory({ marketId, onBack }) {
  const { data, error, loading, reload } = useAsync(() => getMarketHistory(marketId), { deps: [marketId] });

  if (loading) return <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto"><SkeletonCard className="h-64" /></div>;
  if (error) return <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto"><ErrorBanner message={error} onRetry={reload} /></div>;

  const { visits, ratings, notes, feedback } = data;

  // Group everything under its visitId; anything with no visitId (rated/
  // noted/sent outside a formal visit) falls into its own standalone entries.
  const groups = new Map();
  for (const v of visits) groups.set(v.id, { visit: v, ratings: [], notes: [], feedback: [] });
  const loose = [];
  for (const r of ratings) {
    if (r.visitId && groups.has(r.visitId)) groups.get(r.visitId).ratings.push(r);
    else loose.push({ kind: "rating", item: r, date: r.createdAt });
  }
  for (const n of notes) {
    if (n.visitId && groups.has(n.visitId)) groups.get(n.visitId).notes.push(n);
    else loose.push({ kind: "note", item: n, date: n.createdAt });
  }
  for (const f of feedback) {
    if (f.visitId && groups.has(f.visitId)) groups.get(f.visitId).feedback.push(f);
    else loose.push({ kind: "feedback", item: f, date: f.createdAt });
  }

  const visitEntries = [...groups.values()].sort((a, b) => new Date(b.visit.visitDate) - new Date(a.visit.visitDate));
  loose.sort((a, b) => new Date(b.date) - new Date(a.date));

  const isEmpty = visitEntries.length === 0 && loose.length === 0;

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto animate-fade-up">
      <Breadcrumb items={[{ label: "Market", onClick: onBack }, { label: "History" }]} />
      <h1 className="mt-4 font-display text-2xl font-bold text-white">Inspection History</h1>

      {isEmpty ? (
        <div className="mt-6 rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
          No visits, ratings, or feedback recorded for this market yet.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {visitEntries.map(({ visit, ratings: r, notes: n, feedback: f }) => (
            <div key={visit.id} className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06]">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#F47A20]">
                <CalendarDays size={12} /> Visit &middot; {dateLabel(visit.visitDate)}
              </p>
              <p className="text-xs text-[#8B93A8] mt-0.5">{visit.regionalManager?.name}</p>
              <div className="mt-3 space-y-2">
                {r.map((rating) => <RatingRow key={rating.id} rating={rating} />)}
                {f.map((fb) => <FeedbackRow key={fb.id} feedback={fb} />)}
                {n.map((note) => <NoteRow key={note.id} note={note} />)}
                {r.length === 0 && f.length === 0 && n.length === 0 && (
                  <p className="text-xs text-[#4C5266]">No rating, notes, or feedback recorded for this visit.</p>
                )}
              </div>
            </div>
          ))}

          {loose.map(({ kind, item }) => (
            <div key={`${kind}-${item.id}`} className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06]">
              <p className="text-xs text-[#4C5266] mb-2">{dateLabel(item.createdAt)}</p>
              {kind === "rating" && <RatingRow rating={item} />}
              {kind === "feedback" && <FeedbackRow feedback={item} />}
              {kind === "note" && <NoteRow note={item} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingRow({ rating }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Star size={14} className="text-amber-400 fill-current mt-0.5 shrink-0" />
      <div>
        <p className="text-white font-medium">{rating.rating}/10</p>
        {rating.notes && <p className="text-xs text-[#9AA1B4] mt-0.5">{rating.notes}</p>}
      </div>
    </div>
  );
}

function NoteRow({ note }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <NotebookPen size={14} className="text-[#9AA1B4] mt-0.5 shrink-0" />
      <div>
        <p className="text-white">{note.content}</p>
        {note.category && <p className="text-xs text-[#8B93A8] mt-0.5">{note.category}</p>}
      </div>
    </div>
  );
}

function FeedbackRow({ feedback }) {
  const isWarning = feedback.type === "WARNING";
  const Icon = isWarning ? ShieldAlert : Sparkles;
  return (
    <div className={`flex items-start gap-2.5 text-sm rounded-lg p-2.5 ${isWarning ? "bg-red-500/5" : "bg-emerald-500/5"}`}>
      <Icon size={14} className={`${isWarning ? "text-red-400" : "text-emerald-400"} mt-0.5 shrink-0`} />
      <div>
        <p className={`font-medium ${isWarning ? "text-red-300" : "text-emerald-300"}`}>{feedback.title}</p>
        <p className="text-xs text-[#9AA1B4] mt-0.5">{feedback.description}</p>
      </div>
    </div>
  );
}
