import { useState } from "react";
import ImportantPeopleSection from "./ImportantPeopleSection";

// ChatViewTabs.jsx — Phase 3.5: the mobile-first switcher between the
// four Chat organizational views (Important People / Groups /
// Individuals / Unread). These are VIEWS over one already-fetched
// `conversations` array (each shaped conversation object already carries
// `type`/`unreadCount` from the backend — see chatController.js's
// buildStaffConversationList/buildRmConversationList/
// buildAdminConversationList) — not a second data source, and not a
// separate fetch per tab. A conversation naturally appears in more than
// one tab (e.g. an unread group shows up under both Groups and Unread)
// since each tab is just a filter over the same array.
//
// Row rendering stays with the caller (`renderRow`) so each role keeps
// its own existing row component/styling (ChannelRow in
// SupervisorChatTab.jsx, ConversationRow in RmChatPage.jsx/AdminChatPage.jsx)
// instead of a new one being invented here.
const GROUP_TYPES = new Set(["MARKET_GROUP", "WARNINGS", "ZONE_GROUP", "ZONE_ANNOUNCEMENTS", "CUSTOM_GROUP"]);
const INDIVIDUAL_TYPES = new Set(["DIRECT", "SUPERVISOR_DIRECT", "RM_DIRECT", "STAFF_DIRECT"]);

const VIEWS = [
  { key: "important", label: "Important" },
  { key: "groups", label: "Groups" },
  { key: "individuals", label: "Individuals" },
  { key: "unread", label: "Unread" },
];

function EmptyText({ children }) {
  return <p className="text-sm text-[#6B7284] text-center py-8">{children}</p>;
}

export default function ChatViewTabs({
  conversations,
  renderRow,
  onOpenImportantContact,
  groupsHeaderAction,
  individualsExtra,
  defaultView = "groups",
  // Employee/Cashier tokens have no Important People backend support
  // (ImportantContact.ownerUserId — and the staff-contacts endpoints
  // it's built on — are staff-only; see chatController.js). Rather than
  // let ImportantPeopleSection make a call that just 403s for them, the
  // caller passes this false and gets a real, honest empty state instead
  // — never a blank screen, never an unauthorized request (spec: "do not
  // invent unauthorized contacts").
  showImportantPeople = true,
  // Optional fifth "Reports" tab — a real, already-backed section (e.g.
  // ReportsProblemsSection.jsx, backed by the real MarketProblem model)
  // passed in by whichever role's Chat screen has one, so this stays one
  // shared tab bar rather than each role inventing its own. Omitted
  // entirely (no tab shown) when the caller has nothing real to put there.
  reportsContent = null,
}) {
  const [view, setView] = useState(defaultView);

  const groups = conversations.filter((c) => GROUP_TYPES.has(c.type));
  const individuals = conversations.filter((c) => INDIVIDUAL_TYPES.has(c.type));
  const unread = conversations.filter((c) => c.unreadCount > 0);
  const views = reportsContent ? [...VIEWS, { key: "reports", label: "Reports" }] : VIEWS;

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1 pb-1">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
              view === v.key ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] hover:bg-white/[0.09]"
            }`}
          >
            {v.label}
            {v.key === "unread" && unread.length > 0 ? ` (${unread.length})` : ""}
          </button>
        ))}
      </div>

      {view === "important" && (
        showImportantPeople
          ? <ImportantPeopleSection onOpenConversation={onOpenImportantContact} />
          : <EmptyText>No important contacts yet.</EmptyText>
      )}

      {view === "groups" && (
        <div className="space-y-2">
          {groupsHeaderAction}
          {groups.length === 0 ? <EmptyText>No groups available.</EmptyText> : groups.map((c) => renderRow(c))}
        </div>
      )}

      {view === "individuals" && (
        <div className="space-y-3">
          {individuals.length > 0 && <div className="space-y-2">{individuals.map((c) => renderRow(c))}</div>}
          {individualsExtra}
          {individuals.length === 0 && !individualsExtra && <EmptyText>No authorized contacts found.</EmptyText>}
        </div>
      )}

      {view === "unread" && (
        <div className="space-y-2">
          {unread.length === 0 ? <EmptyText>You're all caught up.</EmptyText> : unread.map((c) => renderRow(c))}
        </div>
      )}

      {view === "reports" && reportsContent}
    </div>
  );
}
