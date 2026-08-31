import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import EvidenceCapture from "../employee/EvidenceCapture";
import MarketStructureGrid from "./MarketStructureGrid";
import {
  MARKET_SECTIONS,
  listTodaySectionChecks,
  submitSectionCheck,
} from "../../data/supervisorMockData";

// DailySectionChecks.jsx — Market Structure at the top, then a per-
// section checklist for today's facing/condition verification (spec
// §19). Local/mock state (data/supervisorMockData.js) since no backend
// model exists for this yet — reuses the real EvidenceCapture component
// (same Take Photo/Upload Photo/Retake flow used everywhere else in this
// app) so the photo-capture UX is identical, not reinvented.
export default function DailySectionChecks() {
  const {
    data: checks,
    setData: setChecks,
    loading,
  } = useAsync(listTodaySectionChecks, { deps: [] });
  const [activeSection, setActiveSection] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <SkeletonCard className="h-64" />;

  const statusBySection = {};
  checks.forEach((c) => {
    statusBySection[c.sectionKey] = c.checked ? "checked" : "unchecked";
  });

  function openSection(section) {
    setActiveSection(section);
    const existing = checks.find((c) => c.sectionKey === section.key);
    setPhoto(existing?.photoUrl ?? null);
    setNotes(existing?.notes ?? "");
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const record = await submitSectionCheck({
        sectionKey: activeSection.key,
        photoUrl: photo,
        notes: notes.trim() || undefined,
      });
      setChecks((prev) =>
        prev.map((c) => (c.sectionKey === record.sectionKey ? record : c)),
      );
      setActiveSection(null);
    } finally {
      setSubmitting(false);
    }
  }

  const checkedCount = checks.filter((c) => c.checked).length;

  return (
    <div>
      <MarketStructureGrid
        sectionStatus={statusBySection}
        onSelect={openSection}
      />

      <p className="mt-3 text-xs text-[#8B93A8]">
        {checkedCount} of {MARKET_SECTIONS.length} sections checked today
      </p>

      <Modal
        open={!!activeSection}
        onClose={() => setActiveSection(null)}
        title={activeSection?.label}
      >
        {activeSection && (
          <div className="space-y-4">
            <EvidenceCapture photo={photo} onPhotoChange={setPhoto} />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes (optional)"
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 resize-none"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Mark Checked"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
