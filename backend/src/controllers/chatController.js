import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, staffCanAccessMarket, requireAccessibleEmployee } from "../middleware/auth.js";
import { createNotification, createNotificationForUser, createNotificationForMarket } from "../utils/notifications.js";

// chatController.js — market-scoped chat: one Market Group conversation,
// one Warnings (supervisor-announcement, employee-read-only) conversation,
// and any number of Direct 1:1 conversations between two employees in the
// same market. Polling-based (listMessages accepts ?after=) — no
// WebSocket dependency, consistent with the rest of this REST-only app.

// Group/Warnings conversations are found-or-created rather than relying
// on a DB constraint alone (see the schema.prisma comment on
// ConversationType) — this is the one place that logic lives.
async function findOrCreateChannel(marketId, type) {
  const existing = await prisma.conversation.findFirst({ where: { marketId, type } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { marketId, type } });
}

function directPair(employeeIdA, employeeIdB) {
  // Store the pair in a consistent order so the same two people always
  // resolve to the same conversation regardless of who initiates.
  return employeeIdA < employeeIdB
    ? { participantAId: employeeIdA, participantBId: employeeIdB }
    : { participantAId: employeeIdB, participantBId: employeeIdA };
}

// Returns the conversation if `user` (an Employee OR a staff User token)
// may access it, otherwise null. Shared by every route below that takes
// a :id — this is the ONE place message/read access is decided, for both
// account kinds, so an Employee and a Supervisor sharing a
// SUPERVISOR_DIRECT conversation are checked by the exact same function
// instead of two parallel (and possibly inconsistent) code paths.
async function conversationAccessFor(user, conversationId) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return null;

  if (user.kind === "employee") {
    if (conversation.type === "DIRECT") {
      const isParticipant = conversation.participantAId === user.employeeId || conversation.participantBId === user.employeeId;
      return isParticipant ? conversation : null;
    }
    if (conversation.type === "SUPERVISOR_DIRECT" || conversation.type === "RM_DIRECT") {
      return conversation.participantAId === user.employeeId ? conversation : null;
    }
    // MARKET_GROUP / WARNINGS — any employee of that market can read.
    return user.marketId === conversation.marketId ? conversation : null;
  }

  if (user.kind === "staff") {
    if (conversation.type === "SUPERVISOR_DIRECT" || conversation.type === "RM_DIRECT") {
      return conversation.staffParticipantId === user.userId ? conversation : null;
    }
    if (conversation.type === "MARKET_GROUP" || conversation.type === "WARNINGS") {
      const allowed = await staffCanAccessMarket(user, conversation.marketId);
      return allowed === true ? conversation : null;
    }
    // Staff never touches an Employee<->Employee DIRECT conversation.
    return null;
  }

  return null;
}

function lastReadOrEpoch(read) {
  return read?.lastReadAt ?? new Date(0);
}

// A soft-deleted message's real content is stripped here — the ONE place
// this happens — so every response shape (listMessages, sendMessage,
// editMessage) enforces it server-side rather than trusting the frontend
// to hide a deletedAt row correctly. The row itself, sender, and
// timestamp are kept (spec: preserve auditability); body/attachments and
// reactions/replies-to-it are not meaningful once deleted, so they're
// blanked instead of returned.
function shapeMessage(m) {
  if (!m.deletedAt) return m;
  return {
    ...m,
    body: "",
    imageUrl: null,
    attachmentType: null,
    attachmentUrl: null,
    attachmentName: null,
    attachmentSize: null,
    attachmentDurationSec: null,
    reactions: [],
  };
}

const MESSAGE_INCLUDE = {
  senderEmployee: { select: { id: true, name: true } },
  senderUser: { select: { id: true, name: true } },
  replyTo: {
    select: {
      id: true,
      body: true,
      deletedAt: true,
      senderEmployee: { select: { name: true } },
      senderUser: { select: { name: true } },
    },
  },
  reactions: {
    select: { id: true, emoji: true, employeeId: true, userId: true, employee: { select: { name: true } }, user: { select: { name: true } } },
  },
};

// Finds (or creates) the SUPERVISOR_DIRECT conversation between one
// employee and their market's Supervisor — shared by listMyConversations
// (employee side, below) and getOrCreateSupervisorConversation. Returns
// null if the market has no Supervisor assigned yet.
async function findOrCreateSupervisorConversation(marketId, employeeId) {
  const market = await prisma.market.findUnique({ where: { id: marketId }, select: { supervisorId: true } });
  if (!market?.supervisorId) return null;

  const existing = await prisma.conversation.findFirst({
    where: { type: "SUPERVISOR_DIRECT", marketId, participantAId: employeeId, staffParticipantId: market.supervisorId },
  });
  return existing ?? prisma.conversation.create({
    data: { type: "SUPERVISOR_DIRECT", marketId, participantAId: employeeId, staffParticipantId: market.supervisorId },
  });
}

// GET /api/conversations — employee-only: Market Group + Warnings + the
// Supervisor conversation (if the market has one assigned) + every Direct
// conversation they're in, each with a last-message preview and unread
// count.
export async function listMyConversations(req, res, next) {
  try {
    const employeeId = req.user.employeeId;
    const marketId = req.user.marketId;

    const [marketGroup, warnings, supervisorConvo, rmConvos, directs] = await Promise.all([
      findOrCreateChannel(marketId, "MARKET_GROUP"),
      findOrCreateChannel(marketId, "WARNINGS"),
      findOrCreateSupervisorConversation(marketId, employeeId),
      // RM_DIRECT is NEVER auto-created here — an employee can't initiate
      // contact with a Regional Manager (spec §14). Only shown once the
      // RM has already opened it (see
      // getOrCreateEmployeeConversationForRegionalManager).
      prisma.conversation.findMany({ where: { type: "RM_DIRECT", participantAId: employeeId } }),
      prisma.conversation.findMany({
        where: { type: "DIRECT", OR: [{ participantAId: employeeId }, { participantBId: employeeId }] },
      }),
    ]);

    const conversations = [marketGroup, warnings, ...(supervisorConvo ? [supervisorConvo] : []), ...rmConvos, ...directs];

    const [lastMessages, reads] = await Promise.all([
      Promise.all(
        conversations.map((c) =>
          prisma.message.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" } })
        )
      ),
      prisma.conversationRead.findMany({
        where: { employeeId, conversationId: { in: conversations.map((c) => c.id) } },
      }),
    ]);
    const readByConversation = new Map(reads.map((r) => [r.conversationId, r]));

    const unreadCounts = await Promise.all(
      conversations.map((c) =>
        prisma.message.count({
          where: { conversationId: c.id, createdAt: { gt: lastReadOrEpoch(readByConversation.get(c.id)) } },
        })
      )
    );

    // Direct conversations need the other participant's name for display.
    const otherIds = directs.map((c) => (c.participantAId === employeeId ? c.participantBId : c.participantAId));
    const otherEmployees = await prisma.employee.findMany({
      where: { id: { in: otherIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(otherEmployees.map((e) => [e.id, e.name]));

    const supervisorName = supervisorConvo
      ? (await prisma.user.findUnique({ where: { id: supervisorConvo.staffParticipantId }, select: { name: true } }))?.name
      : null;
    const rmNameById = new Map(
      rmConvos.length
        ? (
            await prisma.user.findMany({
              where: { id: { in: rmConvos.map((c) => c.staffParticipantId) } },
              select: { id: true, name: true },
            })
          ).map((u) => [u.id, u.name])
        : []
    );

    const shaped = conversations.map((c, i) => {
      const read = readByConversation.get(c.id);
      const last = lastMessages[i];
      return {
        id: c.id,
        type: c.type,
        title:
          c.type === "MARKET_GROUP" ? "Market Group" :
          c.type === "WARNINGS" ? "Warnings" :
          c.type === "SUPERVISOR_DIRECT" ? (supervisorName ?? "Supervisor") :
          c.type === "RM_DIRECT" ? (rmNameById.get(c.staffParticipantId) ?? "Regional Manager") :
          nameById.get(c.participantAId === employeeId ? c.participantBId : c.participantAId) ?? "Employee",
        otherEmployeeId: c.type === "DIRECT" ? (c.participantAId === employeeId ? c.participantBId : c.participantAId) : null,
        locked: c.type === "RM_DIRECT" ? c.locked : false,
        lastMessage: last ? { body: last.deletedAt ? "" : last.body, deleted: !!last.deletedAt, createdAt: last.createdAt } : null,
        unreadCount: unreadCounts[i],
        pinned: read?.pinned ?? false,
        muted: read?.muted ?? false,
      };
    });

    // Pinned conversations float to the top; within each group, most
    // recent activity first.
    shaped.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at;
    });

    res.json(shaped);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/conversations/:id/preference — employee-only. Body: any
// subset of { pinned, muted }. Uses the same ConversationRead row as
// mark-as-read (this employee's one "my relationship to this
// conversation" row) rather than a new table.
export async function setConversationPreference(req, res, next) {
  try {
    if (req.user.kind !== "employee") {
      return res.status(403).json({ error: "This action requires an employee login" });
    }
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const { pinned, muted } = req.body;
    const read = await prisma.conversationRead.upsert({
      where: { conversationId_employeeId: { conversationId: conversation.id, employeeId: req.user.employeeId } },
      update: { ...(pinned !== undefined ? { pinned } : {}), ...(muted !== undefined ? { muted } : {}) },
      create: { conversationId: conversation.id, employeeId: req.user.employeeId, pinned: pinned ?? false, muted: muted ?? false },
    });

    res.json(read);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/coworkers — other employees in the same market,
// for starting a Direct conversation.
export async function listCoworkers(req, res, next) {
  try {
    const coworkers = await prisma.employee.findMany({
      where: { marketId: req.user.marketId, id: { not: req.user.employeeId } },
      select: { id: true, name: true, role: true, position: true },
      orderBy: { name: "asc" },
    });
    res.json(coworkers);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/market-group
export async function getMarketGroup(req, res, next) {
  try {
    const conversation = await findOrCreateChannel(req.user.marketId, "MARKET_GROUP");
    res.json(conversation);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/warnings
export async function getWarnings(req, res, next) {
  try {
    const conversation = await findOrCreateChannel(req.user.marketId, "WARNINGS");
    res.json(conversation);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/direct/:employeeId — the other employee must be
// in the same market.
export async function getOrCreateDirect(req, res, next) {
  try {
    const otherId = req.params.employeeId;
    if (otherId === req.user.employeeId) {
      return res.status(400).json({ error: "Cannot start a conversation with yourself" });
    }
    const other = await prisma.employee.findUnique({ where: { id: otherId } });
    if (!other || other.marketId !== req.user.marketId) {
      return res.status(404).json({ error: "Employee not found in your market" });
    }

    const pair = directPair(req.user.employeeId, otherId);
    const existing = await prisma.conversation.findFirst({
      where: { type: "DIRECT", marketId: req.user.marketId, ...pair },
    });
    const conversation = existing ?? (await prisma.conversation.create({
      data: { type: "DIRECT", marketId: req.user.marketId, ...pair },
    }));

    res.json(conversation);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/supervisor — employee-only. Get-or-create the
// conversation with the employee's own market Supervisor. This is what
// listMyConversations already auto-includes; exposed as its own endpoint
// too so a caller can resolve it directly without a list round-trip.
export async function getOrCreateSupervisorConversation(req, res, next) {
  try {
    const conversation = await findOrCreateSupervisorConversation(req.user.marketId, req.user.employeeId);
    if (!conversation) {
      return res.status(404).json({ error: "This market has no Supervisor assigned yet" });
    }
    res.json(conversation);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/staff — staff-only (must be a market's actual
// Supervisor): Market Group + Warnings + every SUPERVISOR_DIRECT
// conversation where this staff account is the staffParticipant, each
// with a last-message preview. This is the Supervisor Chat tab's real
// conversation list, replacing what used to be local mock data for the
// individual-employee-chat portion.
export async function listMyStaffConversations(req, res, next) {
  try {
    if (req.user.role !== "SUPERVISOR") {
      return res.status(403).json({ error: "Only a Supervisor account has a market chat inbox" });
    }
    const marketId = req.user.marketId;

    const [marketGroup, warnings, directs] = await Promise.all([
      findOrCreateChannel(marketId, "MARKET_GROUP"),
      findOrCreateChannel(marketId, "WARNINGS"),
      prisma.conversation.findMany({
        where: { type: "SUPERVISOR_DIRECT", marketId, staffParticipantId: req.user.userId },
      }),
    ]);

    const conversations = [marketGroup, warnings, ...directs];
    const lastMessages = await Promise.all(
      conversations.map((c) => prisma.message.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" } }))
    );

    const employeeIds = directs.map((c) => c.participantAId);
    const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } });
    const nameById = new Map(employees.map((e) => [e.id, e.name]));

    const shaped = conversations.map((c, i) => ({
      id: c.id,
      type: c.type,
      title: c.type === "MARKET_GROUP" ? "Market Group" : c.type === "WARNINGS" ? "Warnings" : nameById.get(c.participantAId) ?? "Employee",
      employeeId: c.type === "SUPERVISOR_DIRECT" ? c.participantAId : null,
      lastMessage: lastMessages[i] ? { body: lastMessages[i].body, createdAt: lastMessages[i].createdAt } : null,
    }));

    res.json(shaped);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/staff/employee/:employeeId — staff-only. Get-or-
// create the SUPERVISOR_DIRECT conversation with a specific employee.
// Restricted to the market's actual Supervisor (staffParticipantId is
// fixed to Market.supervisorId at creation) — an Admin/Regional Manager
// can read the market's other real conversations via market access, but
// impersonating the Supervisor's 1:1 inbox is not the same permission,
// so this stays SUPERVISOR-only rather than reusing assertMarketAccess.
export async function getOrCreateEmployeeConversationForSupervisor(req, res, next) {
  try {
    if (req.user.role !== "SUPERVISOR") {
      return res.status(403).json({ error: "Only a Supervisor account can message an employee directly" });
    }
    const employee = await requireAccessibleEmployee(req.user, req.params.employeeId);

    const market = await prisma.market.findUnique({ where: { id: employee.marketId }, select: { supervisorId: true } });
    if (market?.supervisorId !== req.user.userId) {
      return res.status(403).json({ error: "You are not this employee's Supervisor" });
    }

    const existing = await prisma.conversation.findFirst({
      where: { type: "SUPERVISOR_DIRECT", marketId: employee.marketId, participantAId: employee.id, staffParticipantId: req.user.userId },
    });
    const conversation = existing ?? (await prisma.conversation.create({
      data: { type: "SUPERVISOR_DIRECT", marketId: employee.marketId, participantAId: employee.id, staffParticipantId: req.user.userId },
    }));

    res.json({ ...conversation, title: employee.name });
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/rm/employee/:employeeId — Regional-Manager-only.
// Get-or-create the RM_DIRECT conversation with a specific employee.
// Creating it does NOT unlock it — the spec is explicit that the
// employee can't reply until the RM's first actual message (see
// sendMessage's own comment on where `locked` flips to false); opening
// this just makes the (still-locked) conversation exist so the RM can
// start typing into it. requireAccessibleEmployee already re-checks zone
// access via req.user.zoneIds — a Regional Manager can't reach an
// employee outside their own assigned zones just by guessing an id.
export async function getOrCreateEmployeeConversationForRegionalManager(req, res, next) {
  try {
    if (req.user.role !== "REGIONAL_MANAGER") {
      return res.status(403).json({ error: "Only a Regional Manager account can message an employee directly" });
    }
    const employee = await requireAccessibleEmployee(req.user, req.params.employeeId);

    const existing = await prisma.conversation.findFirst({
      where: { type: "RM_DIRECT", marketId: employee.marketId, participantAId: employee.id, staffParticipantId: req.user.userId },
    });
    const conversation = existing ?? (await prisma.conversation.create({
      data: { type: "RM_DIRECT", marketId: employee.marketId, participantAId: employee.id, staffParticipantId: req.user.userId },
    }));

    res.json({ ...conversation, title: employee.name });
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/:id/messages?after=&before=&search= — ?after is
// an ISO timestamp; only messages strictly newer are returned, so a poll
// loop only ever pulls the delta instead of the whole history each time.
// ?before is the pagination counterpart — older messages than a given
// timestamp, for "load older messages" on scroll-up (take 50, oldest
// requested first). ?search does a case-insensitive substring match on
// body, scoped to this one conversation (not a global cross-conversation
// search — see searchConversations for that). Works for both an Employee
// and a staff (Supervisor) token — see conversationAccessFor.
export async function listMessages(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const { after, before, search } = req.query;
    const where = { conversationId: conversation.id };
    if (after) where.createdAt = { gt: new Date(after) };
    if (before) where.createdAt = { ...(where.createdAt ?? {}), lt: new Date(before) };
    if (search) where.body = { contains: search, mode: "insensitive" };

    const messages = await prisma.message.findMany({
      where,
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: before ? "desc" : "asc" },
      take: 200,
    });
    // ?before pages backward from the newest match, so the raw query is
    // sorted desc to LIMIT the right end of the range — flip it back to
    // chronological order before returning.
    if (before) messages.reverse();

    const shaped = messages.map(shapeMessage);

    // "Seen" indicator: only meaningful for a real 1:1 (one specific
    // other person), never for a group — real data from ConversationRead,
    // not a fabricated tick. Computed on every non-paginating call
    // (initial load AND each incremental `after` poll) so the frontend
    // can keep it current without a separate request; skipped only when
    // paging backward through history, where it isn't relevant.
    let theirLastReadAt = null;
    if (!before && (conversation.type === "DIRECT" || conversation.type === "SUPERVISOR_DIRECT")) {
      if (req.user.kind === "employee") {
        const otherEmployeeId =
          conversation.type === "SUPERVISOR_DIRECT"
            ? null // the other side is staff, which has no ConversationRead row yet
            : conversation.participantAId === req.user.employeeId ? conversation.participantBId : conversation.participantAId;
        if (otherEmployeeId) {
          const read = await prisma.conversationRead.findUnique({
            where: { conversationId_employeeId: { conversationId: conversation.id, employeeId: otherEmployeeId } },
          });
          theirLastReadAt = read?.lastReadAt ?? null;
        }
      } else if (conversation.type === "SUPERVISOR_DIRECT") {
        // Staff viewer: "seen" means the employee's own read row is at or
        // past this thread's latest message.
        const read = await prisma.conversationRead.findUnique({
          where: { conversationId_employeeId: { conversationId: conversation.id, employeeId: conversation.participantAId } },
        });
        theirLastReadAt = read?.lastReadAt ?? null;
      }
    }

    res.json({ messages: shaped, theirLastReadAt });
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/search?q= — employee-only. Searches this
// employee's own conversations by title/last-message and, for a short
// query, message bodies across conversations they can access — backend-
// side so a large history is never pulled into the browser just to
// filter it client-side.
export async function searchConversations(req, res, next) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json({ conversations: [], messages: [] });

    const employeeId = req.user.employeeId;
    const marketId = req.user.marketId;

    const [directs, supervisorConvo] = await Promise.all([
      prisma.conversation.findMany({ where: { type: "DIRECT", OR: [{ participantAId: employeeId }, { participantBId: employeeId }] } }),
      findOrCreateSupervisorConversation(marketId, employeeId),
    ]);
    const marketGroup = await findOrCreateChannel(marketId, "MARKET_GROUP");
    const warnings = await findOrCreateChannel(marketId, "WARNINGS");
    const conversationIds = [marketGroup.id, warnings.id, ...(supervisorConvo ? [supervisorConvo.id] : []), ...directs.map((c) => c.id)];

    const matchingMessages = await prisma.message.findMany({
      where: { conversationId: { in: conversationIds }, body: { contains: q, mode: "insensitive" }, deletedAt: null },
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    res.json({ messages: matchingMessages.map(shapeMessage) });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/messages — an Employee or staff (Supervisor)
// token, whichever conversationAccessFor grants. Blocked on Warnings for
// employees: they can read but never post there (see postWarningBroadcast
// for the staff-only equivalent) — staff posting to Warnings still goes
// through the dedicated broadcast endpoint, not this one, so WARNINGS
// stays blocked here for everyone.
export async function sendMessage(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.type === "WARNINGS") {
      return res.status(403).json({ error: "Post an announcement instead of a direct message on Warnings" });
    }

    const isStaff = req.user.kind === "staff";

    // RM_DIRECT lock (spec §14): the employee can't reply until the
    // Regional Manager has sent the first message. The RM side is never
    // blocked — sending is exactly what unlocks it, below.
    if (conversation.type === "RM_DIRECT" && !isStaff && conversation.locked) {
      return res.status(403).json({ error: "This conversation is locked until the Regional Manager sends the first message" });
    }

    const { body, imageUrl, attachmentType, attachmentUrl, attachmentName, attachmentSize, attachmentDurationSec, replyToId } = req.body;

    // A reply must point at a real, non-deleted message in THIS same
    // conversation — never trust a client-supplied id blindly (it could
    // otherwise be used to probe/reference a message from a conversation
    // this caller has no access to).
    if (replyToId) {
      const target = await prisma.message.findUnique({ where: { id: replyToId }, select: { conversationId: true, deletedAt: true } });
      if (!target || target.conversationId !== conversation.id || target.deletedAt) {
        return res.status(400).json({ error: "The message being replied to could not be found in this conversation" });
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        body,
        imageUrl,
        attachmentType,
        attachmentUrl,
        attachmentName,
        attachmentSize,
        attachmentDurationSec,
        replyToId: replyToId || null,
        senderEmployeeId: isStaff ? null : req.user.employeeId,
        senderUserId: isStaff ? req.user.userId : null,
      },
      include: MESSAGE_INCLUDE,
    });

    // Unlocking is a one-way transition, permanently — "once unlocked,
    // remains available" (spec §14). Only ever flips here, on the RM's
    // own send, never touched by anything else (not even a Supervisor/
    // Admin acting on the same market).
    if (conversation.type === "RM_DIRECT" && isStaff && conversation.locked) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { locked: false } });
      conversation.locked = false;
    }

    const ATTACHMENT_LABEL = { FILE: "Sent a file", AUDIO: "Sent an audio clip", VOICE: "Sent a voice message" };
    const notificationPreview = body.trim()
      ? (body.length > 120 ? `${body.slice(0, 117)}...` : body)
      : imageUrl
      ? "Sent a photo"
      : ATTACHMENT_LABEL[attachmentType] ?? "Sent a message";

    const senderName = isStaff ? message.senderUser?.name : message.senderEmployee?.name;

    // Muting a conversation (§25 — real, not cosmetic) means its
    // ConversationRead.muted is true; those recipients simply don't get a
    // notification row for this message. They still see it the moment
    // they open the conversation — muting only affects the notification
    // side, never the message itself.
    async function notifyEmployeesUnlessMuted(employeeIds, payload) {
      if (employeeIds.length === 0) return;
      const reads = await prisma.conversationRead.findMany({
        where: { conversationId: conversation.id, employeeId: { in: employeeIds } },
        select: { employeeId: true, muted: true },
      });
      const mutedIds = new Set(reads.filter((r) => r.muted).map((r) => r.employeeId));
      await Promise.all(
        employeeIds
          .filter((id) => !mutedIds.has(id))
          .map((id) => createNotification({ employeeId: id, ...payload }))
      );
    }

    // Notify every other participant — employee recipients via
    // createNotification (unless muted), staff recipients
    // (SUPERVISOR_DIRECT sent by an employee) via createNotificationForUser
    // (staff has no mute concept yet — ConversationRead is employee-only).
    if (conversation.type === "DIRECT") {
      const recipientIds = [conversation.participantAId, conversation.participantBId].filter((id) => id !== req.user.employeeId);
      await notifyEmployeesUnlessMuted(recipientIds, {
        type: "CHAT_MESSAGE",
        title: `New message from ${senderName}`,
        body: notificationPreview,
        linkType: "CONVERSATION",
        linkId: conversation.id,
      });
    } else if (conversation.type === "SUPERVISOR_DIRECT" || conversation.type === "RM_DIRECT") {
      if (isStaff) {
        await notifyEmployeesUnlessMuted([conversation.participantAId], {
          type: "CHAT_MESSAGE",
          title: `New message from ${senderName}`,
          body: notificationPreview,
          linkType: "CONVERSATION",
          linkId: conversation.id,
        });
      } else {
        await createNotificationForUser({
          userId: conversation.staffParticipantId,
          type: "CHAT_MESSAGE",
          title: `New message from ${senderName}`,
          body: notificationPreview,
          linkType: "CONVERSATION",
          linkId: conversation.id,
        });
      }
    } else {
      // MARKET_GROUP — notify every other employee in the market.
      const others = await prisma.employee.findMany({
        where: { marketId: conversation.marketId, id: isStaff ? undefined : { not: req.user.employeeId } },
        select: { id: true },
      });
      await notifyEmployeesUnlessMuted(others.map((e) => e.id), {
        type: "CHAT_MESSAGE",
        title: "New message in Market Group",
        body: notificationPreview,
        linkType: "CONVERSATION",
        linkId: conversation.id,
      });
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

// Shared by editMessage/deleteMessage/reactToMessage — loads the message,
// confirms it belongs to a conversation this caller can access, and
// returns both. Access to react is "can I see this conversation"; access
// to edit/delete is further narrowed to "am I the sender" by the caller.
async function loadOwnMessageContext(user, conversationId, messageId) {
  const conversation = await conversationAccessFor(user, conversationId);
  if (!conversation) return { conversation: null, message: null };
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversation.id) return { conversation, message: null };
  return { conversation, message };
}

function isSender(user, message) {
  return user.kind === "staff" ? message.senderUserId === user.userId : message.senderEmployeeId === user.employeeId;
}

// PATCH /api/conversations/:id/messages/:messageId — sender-only. Only a
// plain text message can be edited (an attachment's content isn't
// editable) — enforced here, not just hidden in the UI.
export async function editMessage(req, res, next) {
  try {
    const { conversation, message } = await loadOwnMessageContext(req.user, req.params.id, req.params.messageId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (!message) return res.status(404).json({ error: "Message not found" });
    if (message.deletedAt) return res.status(400).json({ error: "This message was deleted" });
    if (!isSender(req.user, message)) return res.status(403).json({ error: "You can only edit your own messages" });
    if (message.attachmentType || message.imageUrl) {
      return res.status(400).json({ error: "Attachments can't be edited" });
    }

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { body: req.body.body, editedAt: new Date() },
      include: MESSAGE_INCLUDE,
    });

    res.json(shapeMessage(updated));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/conversations/:id/messages/:messageId — sender-only, soft
// delete (see shapeMessage's own comment on why the row is kept).
export async function deleteMessage(req, res, next) {
  try {
    const { conversation, message } = await loadOwnMessageContext(req.user, req.params.id, req.params.messageId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (!message) return res.status(404).json({ error: "Message not found" });
    if (!isSender(req.user, message)) return res.status(403).json({ error: "You can only delete your own messages" });

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { deletedAt: new Date() },
      include: MESSAGE_INCLUDE,
    });

    res.json(shapeMessage(updated));
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/messages/:messageId/reactions — toggles:
// same emoji again removes it, a different emoji replaces it, matching
// "react / remove / change" from the spec with one endpoint instead of
// three. Anyone with access to the conversation may react (not sender-
// restricted) — reacting to someone else's message is the whole point.
export async function reactToMessage(req, res, next) {
  try {
    const { conversation, message } = await loadOwnMessageContext(req.user, req.params.id, req.params.messageId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (!message || message.deletedAt) return res.status(404).json({ error: "Message not found" });

    const { emoji } = req.body;
    const isStaff = req.user.kind === "staff";
    const mine = await prisma.messageReaction.findFirst({
      where: isStaff ? { messageId: message.id, userId: req.user.userId } : { messageId: message.id, employeeId: req.user.employeeId },
    });

    if (mine && mine.emoji === emoji) {
      await prisma.messageReaction.delete({ where: { id: mine.id } });
    } else if (mine) {
      await prisma.messageReaction.update({ where: { id: mine.id }, data: { emoji } });
    } else {
      await prisma.messageReaction.create({
        data: {
          messageId: message.id,
          emoji,
          employeeId: isStaff ? null : req.user.employeeId,
          userId: isStaff ? req.user.userId : null,
        },
      });
    }

    const reactions = await prisma.messageReaction.findMany({
      where: { messageId: message.id },
      select: { id: true, emoji: true, employeeId: true, userId: true, employee: { select: { name: true } }, user: { select: { name: true } } },
    });
    res.json({ reactions });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/read — read-state is only tracked for
// Employees today (ConversationRead.employeeId has no staff counterpart
// yet); a staff caller gets a no-op success rather than an error, so the
// Supervisor Chat UI's polling loop doesn't need a kind-based branch.
export async function markConversationRead(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (req.user.kind !== "employee") {
      return res.json({ ok: true });
    }

    const read = await prisma.conversationRead.upsert({
      where: { conversationId_employeeId: { conversationId: conversation.id, employeeId: req.user.employeeId } },
      update: { lastReadAt: new Date() },
      create: { conversationId: conversation.id, employeeId: req.user.employeeId },
    });

    res.json(read);
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/warnings/broadcast — staff-only. No frontend
// caller yet (no Supervisor screen exists) — same "backend-ready"
// pattern as every other staff-only endpoint in this app. This is the
// only way the Warnings channel ever gets real content, since employees
// can't post there.
export async function postWarningBroadcast(req, res, next) {
  try {
    const { marketId, body } = req.body;
    await assertMarketAccess(req.user, marketId);

    const conversation = await findOrCreateChannel(marketId, "WARNINGS");
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, body, senderUserId: req.user.userId },
    });

    await createNotificationForMarket({
      marketId,
      type: "ANNOUNCEMENT",
      title: "New Warning",
      body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
      linkType: "CONVERSATION",
      linkId: conversation.id,
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}
