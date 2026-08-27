import { useState } from "react";
import { Star, ChevronRight, Loader2 } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "./SkeletonCard";
import { initialsOf } from "../../utils/initials";
import {
  listAuthorizedStaffContacts,
  listImportantContacts,
  addImportantContact,
  removeImportantContact,
  getOrCreateStaffContact,
} from "../../services/chatService";

// ImportantPeopleSection.jsx — Phase 3 §3-4: a staff account's (RM/
// Supervisor/Overlooking/Admin) own, personal, reorderable shortlist of
// high-priority contacts (e.g. an RM pinning the CEO/Operations Manager).
// Purely organizational — starring never grants a permission on its own;
// every listed contact already comes from listAuthorizedStaffContacts()
// (backend-filtered, role-scoped — never every staff account in the
// company), and opening one re-verifies access server-side via
// getOrCreateStaffContact regardless of whether it's starred.
export default function ImportantPeopleSection({ onOpenConversation }) {
  const { data: contacts, loading: loadingContacts, error } = useAsync(listAuthorizedStaffContacts, { deps: [] });
  const { data: important, reload: reloadImportant } = useAsync(listImportantContacts, { deps: [] });
  const [pendingId, setPendingId] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  if (loadingContacts) return <SkeletonCard className="h-24" />;
  if (error || !contacts?.length) return null;

  const importantByUserId = new Map((important ?? []).map((c) => [c.contactUserId, c]));
  const sorted = [...contacts].sort((a, b) => {
    const ai = importantByUserId.has(a.id) ? 1 : 0;
    const bi = importantByUserId.has(b.id) ? 1 : 0;
    if (ai !== bi) return bi - ai;
    return a.name.localeCompare(b.name);
  });

  async function toggleStar(contact) {
    const existing = importantByUserId.get(contact.id);
    setPendingId(contact.id);
    try {
      if (existing) await removeImportantContact(existing.id);
      else await addImportantContact({ contactUserId: contact.id });
      await reloadImportant();
    } finally {
      setPendingId(null);
    }
  }

  async function open(contact) {
    setOpeningId(contact.id);
    try {
      const conversation = await getOrCreateStaffContact(contact.id);
      onOpenConversation(conversation);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Important People</h2>
      <div className="space-y-2">
        {sorted.map((contact) => {
          const isImportant = importantByUserId.has(contact.id);
          return (
            <div
              key={contact.id}
              className="w-full flex items-center gap-3 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
            >
              <button type="button" onClick={() => open(contact)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <span className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                  {initialsOf(contact.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{contact.name}</p>
                  <p className="text-[11px] text-[#8B93A8]">{contact.role?.replace(/_/g, " ")}</p>
                </div>
                {openingId === contact.id ? <Loader2 size={14} className="animate-spin text-[#4C5266]" /> : <ChevronRight size={16} className="text-[#4C5266] shrink-0" />}
              </button>
              <button
                type="button"
                onClick={() => toggleStar(contact)}
                disabled={pendingId === contact.id}
                aria-label={isImportant ? "Remove from Important People" : "Add to Important People"}
                className="shrink-0 p-1 disabled:opacity-50"
              >
                <Star size={16} className={isImportant ? "fill-[#F47A20] text-[#F47A20]" : "text-[#4C5266]"} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
