import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, UsersRound, ArrowLeft, ShieldAlert, Loader2, UserPlus } from "lucide-react";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ConversationScreen from "../components/employee/ConversationScreen";
import GroupInfoModal from "../components/employee/GroupInfoModal";
import ConversationOptionsSheet from "../components/common/ConversationOptionsSheet";
import ChatConversationCard from "../components/common/ChatConversationCard";
import CommunicationHistoryScreen from "../components/common/communications/CommunicationHistoryScreen";
import RmCreateGroupModal from "./RmCreateGroupModal";
import RmReportsSection from "./RmReportsSection";
import {
  listMyRegionalManagerConversations,
  postZoneAnnouncement,
  setConversationPreference,
  listAuthorizedStaffContacts,
  getOrCreateStaffContact,
} from "../services/chatService";
import { useAsync } from "../hooks/useAsync";
import { usePolling } from "../hooks/usePolling";
import { initialsOf } from "../utils/initials";

const LIST_POLL_MS = 15000;

// Chat Hub §1/§12 — the Regional Manager's five categories. Deliberately
// its own tab set (not the shared 4-view ChatViewTabs Supervisor/Admin
// still use unchanged) — see this file's own comment below on why RM's
// categories genuinely diverge (Awareness/Reports aren't conversations
// at all). Row rendering now goes through the same shared
// ChatConversationCard every other role's Chat screen uses (Chat UI
// redesign §26), so only this tab bar/category split stays RM-specific.
const GROUP_TYPES = new Set(["ZONE_GROUP", "CUSTOM_GROUP"]);
const INDIVIDUAL_TYPES = new Set(["RM_DIRECT", "STAFF_DIRECT"]);

// StartConversationRow — Individuals §3: an authorized contact
// (Supervisor/Overlooking in-zone, or Admin — see chatController.
// authorizedStaffContactsFor) who doesn't have an existing thread yet.
// Tapping calls the real getOrCreateStaffContact (re-checked server-side
// regardless of this list already being backend-filtered) and opens it —
// this is the "Important People" discovery capability, folded into
// Individuals instead of its own tab, so nothing already working was
// removed.
function StartConversationRow({ contact, onOpen }) {
  const [opening, setOpening] = useState(false);
  async function handleOpen() {
    setOpening(true);
    try {
      const conversation = await getOrCreateStaffContact(contact.id);
      onOpen(conversation);
    } finally {
      setOpening(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={opening}
      className="w-full flex items-center gap-3 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors disabled:opacity-60"
    >
      <span className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
        {initialsOf(contact.name)}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-medium text-white truncate">{contact.name}</p>
        <p className="text-[11px] text-[#8B93A8]">{contact.role?.replace(/_/g, " ")}</p>
      </div>
      {opening ? <Loader2 size={14} className="animate-spin text-[#4C5266]" /> : <ChevronRight size={16} className="text-[#4C5266] shrink-0" />}
    </button>
  );
}

// RmChatPage.jsx — Chat Hub: the Regional Manager's Communication
// Center. Five categories (Groups / Individuals / Awareness / Unread /
// Reports), each a real, already-existing backend surface, not a new
// chat engine:
//   Groups/Individuals/Unread — /api/conversations/rm (unchanged),
//     just re-bucketed here so Awareness's two conversation types
//     (ZONE_ANNOUNCEMENTS — see the schema's own comment on why this is
//     a broadcast channel, not a normal group) never show up twice
//     across both a chat tab and the Awareness tab.
//   Awareness — the existing Warnings & Notifications /
//     Communication system (title/priority/target-audience/read-
//     acknowledge-complete tracking — richer than a chat message ever
//     was), embedded via CommunicationHistoryScreen's own real list +
//     "+ New Communication" entry point into the existing composer.
//   Reports — the existing MarketProblem system, now zone-wide (see
//     RmReportsSection.jsx / marketProblemsController's zoneId branch).
export default function RmChatPage({ session }) {
  const { data: conversations, setData: setConversations, error, loading, reload } = useAsync(listMyRegionalManagerConversations, { deps: [] });
  const { data: staffContacts } = useAsync(listAuthorizedStaffContacts, { deps: [] });
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState("groups");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [optionsFor, setOptionsFor] = useState(null);

  usePolling(() => reload(), LIST_POLL_MS, []);

  async function handleTogglePin(conversation) {
    setOptionsFor(null);
    const next = !conversation.pinned;
    setConversations((prev) => prev?.map((c) => (c.id === conversation.id ? { ...c, pinned: next } : c)));
    try {
      await setConversationPreference(conversation.id, { pinned: next });
    } catch {
      reload();
    }
  }

  async function handleToggleMute(conversation) {
    setOptionsFor(null);
    const next = !conversation.muted;
    setConversations((prev) => prev?.map((c) => (c.id === conversation.id ? { ...c, muted: next } : c)));
    try {
      await setConversationPreference(conversation.id, { muted: next });
    } catch {
      reload();
    }
  }

  const openConversation = conversationId ? conversations?.find((c) => c.id === conversationId) : null;

  function handleGroupCreated(conversation) {
    setCreatingGroup(false);
    reload();
    navigate(`/rm/chat/${conversation.id}`);
  }

  async function handleOpenNewConversation(conversation) {
    await reload();
    navigate(`/rm/chat/${conversation.id}`);
  }

  if (conversationId) {
    if (loading) return <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto"><SkeletonCard className="h-64" /></div>;
    if (!openConversation) {
      return (
        <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto">
          <ErrorBanner message="This conversation could not be found." onRetry={() => navigate("/rm/chat")} />
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <button type="button" onClick={() => navigate("/rm/chat")} className="mt-4 flex items-center gap-1.5 text-xs text-[#9AA1B4] hover:text-white md:hidden">
          <ArrowLeft size={13} /> Back to Chat
        </button>
        <div className="h-[calc(100vh-64px)]">
          <ConversationScreen
            conversation={openConversation}
            currentUserId={session.staffId}
            currentUserKind="staff"
            onBack={() => navigate("/rm/chat")}
            onOpenGroupInfo={openConversation.type === "CUSTOM_GROUP" ? () => setGroupInfoOpen(true) : undefined}
            onBroadcast={
              openConversation.type === "ZONE_ANNOUNCEMENTS"
                ? (body) => postZoneAnnouncement(openConversation.zoneId, body)
                : undefined
            }
          />
        </div>
        {groupInfoOpen && (
          <GroupInfoModal
            conversationId={openConversation.id}
            groupName={openConversation.title}
            groupPictureUrl={openConversation.pictureUrl}
            marketId={openConversation.marketId}
            currentUserId={session.staffId}
            currentUserKind="staff"
            onClose={() => setGroupInfoOpen(false)}
            onRenamed={() => reload()}
            onDeleted={() => { setGroupInfoOpen(false); reload(); navigate("/rm/chat"); }}
          />
        )}
      </div>
    );
  }

  const groups = (conversations ?? []).filter((c) => GROUP_TYPES.has(c.type));
  const individuals = (conversations ?? []).filter((c) => INDIVIDUAL_TYPES.has(c.type));
  const unread = (conversations ?? []).filter((c) => (GROUP_TYPES.has(c.type) || INDIVIDUAL_TYPES.has(c.type)) && c.unreadCount > 0);
  const existingStaffContactIds = new Set(individuals.filter((c) => c.staffUserId).map((c) => c.staffUserId));
  const newContacts = (staffContacts ?? []).filter((c) => !existingStaffContactIds.has(c.id));

  const TABS = [
    { key: "groups", label: "Groups" },
    { key: "individuals", label: "Individuals" },
    { key: "awareness", label: "Awareness" },
    { key: "unread", label: "Unread", count: unread.length },
    { key: "reports", label: "Reports" },
  ];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="font-display text-2xl font-bold text-white mb-1">Chat</h1>
      <p className="text-xs text-[#6B7284] mb-5">Your zone's communication hub</p>

      <div className="flex gap-2 mb-5 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
              view === t.key ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] hover:bg-white/[0.09]"
            }`}
          >
            {t.label}{t.count > 0 ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[72px]" />)}
        </div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          {view === "groups" && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setCreatingGroup(true)}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 mb-1 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-150"
              >
                <UsersRound size={15} /> Create Group
              </button>
              {groups.length === 0 ? (
                <p className="text-sm text-[#6B7284] text-center py-8">No groups yet.</p>
              ) : (
                groups.map((c) => <ChatConversationCard key={c.id} conversation={c} onOpen={() => navigate(`/rm/chat/${c.id}`)} onMore={setOptionsFor} />)
              )}
            </div>
          )}

          {view === "individuals" && (
            <div className="space-y-5">
              {individuals.length > 0 && (
                <div className="space-y-2">
                  {individuals.map((c) => <ChatConversationCard key={c.id} conversation={c} onOpen={() => navigate(`/rm/chat/${c.id}`)} onMore={setOptionsFor} />)}
                </div>
              )}
              {newContacts.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">
                    <UserPlus size={12} /> Start a Conversation
                  </h2>
                  <div className="space-y-2">
                    {newContacts.map((c) => <StartConversationRow key={c.id} contact={c} onOpen={handleOpenNewConversation} />)}
                  </div>
                </div>
              )}
              {individuals.length === 0 && newContacts.length === 0 && (
                <p className="text-sm text-[#6B7284] text-center py-8">No authorized contacts found.</p>
              )}
            </div>
          )}

          {view === "awareness" && (
            <div>
              <div className="mb-3 rounded-xl px-3.5 py-2.5 bg-amber-500/[0.06] border border-amber-500/20 flex items-center gap-2">
                <ShieldAlert size={14} className="text-amber-400 shrink-0" />
                <p className="text-xs text-amber-200/90">Important information, instructions, and notices you send to your zone.</p>
              </div>
              <CommunicationHistoryScreen session={session} basePath="/rm" bare />
            </div>
          )}

          {view === "unread" && (
            <div className="space-y-2">
              {unread.length === 0 ? (
                <p className="text-sm text-[#6B7284] text-center py-8">You're all caught up.</p>
              ) : (
                unread.map((c) => <ChatConversationCard key={c.id} conversation={c} onOpen={() => navigate(`/rm/chat/${c.id}`)} onMore={setOptionsFor} />)
              )}
            </div>
          )}

          {view === "reports" && <RmReportsSection zoneIds={session.zoneIds ?? []} />}
        </>
      )}

      {creatingGroup && <RmCreateGroupModal session={session} onClose={() => setCreatingGroup(false)} onCreated={handleGroupCreated} />}

      {optionsFor && (
        <ConversationOptionsSheet
          conversation={optionsFor}
          onClose={() => setOptionsFor(null)}
          onTogglePin={() => handleTogglePin(optionsFor)}
          onToggleMute={() => handleToggleMute(optionsFor)}
        />
      )}
    </div>
  );
}
