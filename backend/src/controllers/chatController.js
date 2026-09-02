import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, assertZoneAccess, staffCanAccessMarket, requireAccessibleEmployee, HttpError } from "../middleware/auth.js";
import { createNotification, createNotificationForUser, createNotificationForMarket, createNotificationForZone } from "../utils/notifications.js";

// Chat UI redesign — presence. "Online" is always derived from
// lastActiveAt (see middleware/auth.js's throttled write path), never
// stored — one threshold, used everywhere online status is computed.
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
function isOnline(lastActiveAt) {
  return !!lastActiveAt && Date.now() - new Date(lastActiveAt).getTime() < ONLINE_THRESHOLD_MS;
}

// Chat UI redesign — Groups tab categorization (Zone / Announcements /
// General / Task & Operations). Computed, never stored beyond
// Conversation.category (CUSTOM_GROUP only) — every fixed channel type's
// category is implied entirely by its ConversationType/groupType, so
// there's nothing to store for those. Shared by every conversation-list
// builder below so the four roles' Chat screens can never disagree on
// which section a given conversation belongs in.
function categoryOf(conversation) {
  if (conversation.type === "ZONE_GROUP") return "zone";
  if (conversation.type === "WARNINGS" || conversation.type === "ZONE_ANNOUNCEMENTS" || conversation.groupType === "WARNING") return "announcements";
  if (conversation.type === "CUSTOM_GROUP" && conversation.category === "TASK_OPERATIONS") return "tasks";
  return "general";
}

// chatController.js — market-scoped chat: one Market Group conversation,
// one Warnings (supervisor-announcement, employee-read-only) conversation,
// and any number of Direct 1:1 conversations between two employees in the
// same market. Polling-based (listMessages accepts ?after=) — no
// WebSocket dependency, consistent with the rest of this REST-only app.

// Group/Warnings conversations are found-or-created rather than relying
// on a DB constraint alone (see the schema.prisma comment on
// ConversationType) — this is the one place that logic lives. Exported
// for marketManagementController.js's Department Report posting (Phase
// 2 §21) — the report is posted into the market's own existing
// MARKET_GROUP conversation, not a new/invented "Zone group".
export async function findOrCreateChannel(marketId, type) {
  const existing = await prisma.conversation.findFirst({ where: { marketId, type } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { marketId, type } });
}

// Production Chat §6-8 — the zone-level counterpart to findOrCreateChannel
// (ZONE_GROUP/ZONE_ANNOUNCEMENTS, marketId stays null, zoneId is set).
// Same "found-or-created, not a DB constraint" convention as the market
// channels above.
export async function findOrCreateZoneChannel(zoneId, type) {
  const existing = await prisma.conversation.findFirst({ where: { zoneId, type } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { zoneId, type } });
}

// Zone membership for General Zone / Zone Announcements — every employee
// whose market is in the zone, every Supervisor/Overlooking of a market in
// the zone, and the zone's own Regional Manager(s). Shared by
// conversationAccessFor and the zone-channel list-building below so
// "who's in this zone chat" is decided in exactly one place.
async function isZoneMember(user, zoneId) {
  if (user.kind === "employee") {
    const market = await prisma.market.findUnique({ where: { id: user.marketId }, select: { zoneId: true } });
    return market?.zoneId === Number(zoneId);
  }
  if (user.role === "ADMIN") return true;
  if (user.role === "REGIONAL_MANAGER") {
    return (user.zoneIds ?? []).some((id) => String(id) === String(zoneId));
  }
  if (user.role === "SUPERVISOR" || user.role === "OVERLOOKING_SUPERVISOR") {
    const market = await prisma.market.findUnique({ where: { id: user.marketId }, select: { zoneId: true } });
    return market?.zoneId === Number(zoneId);
  }
  return false;
}

function directPair(employeeIdA, employeeIdB) {
  // Store the pair in a consistent order so the same two people always
  // resolve to the same conversation regardless of who initiates.
  return employeeIdA < employeeIdB
    ? { participantAId: employeeIdA, participantBId: employeeIdB }
    : { participantAId: employeeIdB, participantBId: employeeIdA };
}

// Phase 3 — the STAFF_DIRECT equivalent of directPair, for a real 1:1
// between two staff accounts (e.g. a Regional Manager and an Admin).
// Same consistent-ordering trick so the same pair always resolves to one
// conversation regardless of who initiates.
function staffDirectPair(userIdA, userIdB) {
  return userIdA < userIdB
    ? { staffParticipantId: userIdA, staffParticipantBId: userIdB }
    : { staffParticipantId: userIdB, staffParticipantBId: userIdA };
}

// Returns the conversation if `user` (an Employee OR a staff User token)
// may access it, otherwise null. Shared by every route below that takes
// a :id — this is the ONE place message/read access is decided, for both
// account kinds, so an Employee and a Supervisor sharing a
// SUPERVISOR_DIRECT conversation are checked by the exact same function
// instead of two parallel (and possibly inconsistent) code paths.
// Exported for utils/fileAuthorization.js — a chat attachment's read
// access is "are you a member of this conversation", which is exactly
// what this function already answers; reusing it there means chat file
// authorization never drifts from chat message authorization.
export async function conversationAccessFor(user, conversationId) {
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
    if (conversation.type === "CUSTOM_GROUP") {
      const membership = await prisma.conversationMember.findUnique({
        where: { conversationId_employeeId: { conversationId: conversation.id, employeeId: user.employeeId } },
      });
      return membership ? conversation : null;
    }
    if (conversation.type === "ZONE_GROUP" || conversation.type === "ZONE_ANNOUNCEMENTS") {
      return (await isZoneMember(user, conversation.zoneId)) ? conversation : null;
    }
    // MARKET_GROUP / WARNINGS — any employee of that market can read.
    return user.marketId === conversation.marketId ? conversation : null;
  }

  if (user.kind === "staff") {
    if (conversation.type === "STAFF_DIRECT") {
      const isParticipant = conversation.staffParticipantId === user.userId || conversation.staffParticipantBId === user.userId;
      return isParticipant ? conversation : null;
    }
    if (conversation.type === "SUPERVISOR_DIRECT" || conversation.type === "RM_DIRECT") {
      return conversation.staffParticipantId === user.userId ? conversation : null;
    }
    if (conversation.type === "CUSTOM_GROUP") {
      // Explicit membership only — unlike MARKET_GROUP/WARNINGS, being
      // staff with market/zone access does NOT imply access to a
      // CUSTOM_GROUP (spec's own rule: "do not make every Supervisor
      // automatically the administrator of every group" — the same
      // principle applies to plain membership, not just admin rights).
      const membership = await prisma.conversationMember.findFirst({
        where: { conversationId: conversation.id, userId: user.userId },
      });
      return membership ? conversation : null;
    }
    if (conversation.type === "MARKET_GROUP" || conversation.type === "WARNINGS") {
      const allowed = await staffCanAccessMarket(user, conversation.marketId);
      return allowed === true ? conversation : null;
    }
    if (conversation.type === "ZONE_GROUP" || conversation.type === "ZONE_ANNOUNCEMENTS") {
      return (await isZoneMember(user, conversation.zoneId)) ? conversation : null;
    }
    // Staff never touches an Employee<->Employee DIRECT conversation.
    return null;
  }

  return null;
}

// Production Chat §14-15 — the single source of truth for "can THIS
// message legitimately mention THAT account", reused by both sendMessage/
// editMessage (to decide what actually gets persisted as a
// MessageMention) and listMentionCandidates (the composer's @ autocomplete
// list) so the two can never drift. A display name is never the
// identifier — only a real employeeId/userId, re-checked against the
// conversation's actual membership, never trusted from the request.
async function isValidMentionTarget(conversation, { employeeId, userId }) {
  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, marketId: true } });
    if (!employee) return false;
    if (conversation.type === "MARKET_GROUP" || conversation.type === "WARNINGS") {
      return employee.marketId === conversation.marketId;
    }
    if (conversation.type === "ZONE_GROUP" || conversation.type === "ZONE_ANNOUNCEMENTS") {
      const market = await prisma.market.findUnique({ where: { id: employee.marketId }, select: { zoneId: true } });
      return market?.zoneId === conversation.zoneId;
    }
    if (conversation.type === "DIRECT") {
      return conversation.participantAId === employee.id || conversation.participantBId === employee.id;
    }
    if (conversation.type === "SUPERVISOR_DIRECT" || conversation.type === "RM_DIRECT") {
      return conversation.participantAId === employee.id;
    }
    if (conversation.type === "CUSTOM_GROUP") {
      const membership = await prisma.conversationMember.findUnique({
        where: { conversationId_employeeId: { conversationId: conversation.id, employeeId: employee.id } },
      });
      return !!membership;
    }
    return false;
  }

  if (userId) {
    if (conversation.type === "STAFF_DIRECT") {
      return conversation.staffParticipantId === userId || conversation.staffParticipantBId === userId;
    }
    if (conversation.type === "SUPERVISOR_DIRECT" || conversation.type === "RM_DIRECT") {
      return conversation.staffParticipantId === userId;
    }
    if (conversation.type === "CUSTOM_GROUP") {
      const membership = await prisma.conversationMember.findFirst({ where: { conversationId: conversation.id, userId } });
      return !!membership;
    }
    if (conversation.type === "MARKET_GROUP" || conversation.type === "WARNINGS") {
      return staffMentionEligible(userId, { marketId: conversation.marketId });
    }
    if (conversation.type === "ZONE_GROUP" || conversation.type === "ZONE_ANNOUNCEMENTS") {
      return staffMentionEligible(userId, { zoneId: conversation.zoneId });
    }
    return false;
  }

  return false;
}

// Mirrors staffCanAccessMarket/isZoneMember's own read-access rules, just
// evaluated for the TARGET user id rather than the acting req.user — a
// mention must only ever be valid for someone who could actually open
// this conversation. Fixes the earlier version of this file, which only
// allowed mentioning a market's own Supervisor/Overlooking (never the
// Admin or zone's Regional Manager who can also legitimately read a
// Market Group/Zone chat) — an under-privilege bug, not a leak, but a
// real inconsistency with conversationAccessFor.
async function staffMentionEligible(targetUserId, { marketId, zoneId }) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      role: true,
      managedMarket: { select: { id: true, zoneId: true } },
      managedOverlookingMarket: { select: { id: true, zoneId: true } },
      managedZones: { select: { id: true } },
    },
  });
  if (!target) return false;
  if (target.role === "ADMIN") return true;

  const targetMarket = target.managedMarket ?? target.managedOverlookingMarket ?? null;

  if (marketId) {
    if (target.role === "SUPERVISOR" || target.role === "OVERLOOKING_SUPERVISOR") return targetMarket?.id === marketId;
    if (target.role === "REGIONAL_MANAGER") {
      const market = await prisma.market.findUnique({ where: { id: marketId }, select: { zoneId: true } });
      return target.managedZones.some((z) => z.id === market?.zoneId);
    }
    return false;
  }
  if (zoneId) {
    if (target.role === "SUPERVISOR" || target.role === "OVERLOOKING_SUPERVISOR") return targetMarket?.zoneId === zoneId;
    if (target.role === "REGIONAL_MANAGER") return target.managedZones.some((z) => z.id === zoneId);
    return false;
  }
  return false;
}

// Persists only the mentions that pass isValidMentionTarget, then fires a
// real, structured notification per mention (never triggered by the raw
// string containing "@" — see MessageMention's own comment). Silently
// drops an invalid/unauthorized target rather than failing the whole send
// — the message itself is still real and valid even if one mention wasn't.
// `previousKeys` (only ever passed from editMessage) — the set of
// mention keys ("e:<employeeId>" / "u:<userId>") this message already
// had before the edit, so re-saving an unchanged mention doesn't fire a
// second MENTION notification for the same person every time the sender
// touches Save. The MessageMention rows themselves are still recreated
// for the full current set either way (editMessage already wiped the old
// ones) — only the notification fan-out is deduplicated.
async function createMentionsAndNotify(message, conversation, mentions, actorName, previousKeys = new Set()) {
  if (!mentions?.length) return;
  const valid = [];
  for (const m of mentions) {
    if (await isValidMentionTarget(conversation, m)) valid.push(m);
  }
  if (!valid.length) return;

  await prisma.messageMention.createMany({
    data: valid.map((m) => ({ messageId: message.id, employeeId: m.employeeId ?? null, userId: m.userId ?? null })),
    skipDuplicates: true,
  });

  const newMentions = valid.filter((m) => !previousKeys.has(m.employeeId ? `e:${m.employeeId}` : `u:${m.userId}`));
  if (!newMentions.length) return;

  const preview = message.body?.trim()
    ? (message.body.length > 120 ? `${message.body.slice(0, 117)}...` : message.body)
    : "Mentioned you in a message";

  await Promise.all(
    newMentions.map((m) =>
      m.employeeId
        ? createNotification({
            employeeId: m.employeeId,
            type: "MENTION",
            title: `${actorName} mentioned you`,
            body: preview,
            linkType: "CONVERSATION",
            linkId: conversation.id,
          })
        : createNotificationForUser({
            userId: m.userId,
            type: "MENTION",
            title: `${actorName} mentioned you`,
            body: preview,
            linkType: "CONVERSATION",
            linkId: conversation.id,
          })
    )
  );
}

// GET /api/conversations/:id/mention-candidates?q= — the composer's @
// autocomplete. Bounded (take 20) and scoped exactly like
// isValidMentionTarget's own per-type rules, so nothing ever suggested
// here could fail validation on send.
export async function listMentionCandidates(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const q = (req.query.q || "").trim();
    const nameFilter = q ? { contains: q, mode: "insensitive" } : undefined;
    const employees = [];
    const staff = [];

    if (conversation.type === "MARKET_GROUP" || conversation.type === "WARNINGS") {
      employees.push(
        ...(await prisma.employee.findMany({
          where: { marketId: conversation.marketId, ...(nameFilter ? { name: nameFilter } : {}) },
          select: { id: true, name: true },
          take: 20,
        }))
      );
      const market = await prisma.market.findUnique({
        where: { id: conversation.marketId },
        select: { supervisorId: true, overlookingSupervisorId: true },
      });
      const staffIds = [market?.supervisorId, market?.overlookingSupervisorId].filter(Boolean);
      staff.push(
        ...(await prisma.user.findMany({
          where: { id: { in: staffIds }, ...(nameFilter ? { name: nameFilter } : {}) },
          select: { id: true, name: true, role: true },
        }))
      );
    } else if (conversation.type === "ZONE_GROUP" || conversation.type === "ZONE_ANNOUNCEMENTS") {
      employees.push(
        ...(await prisma.employee.findMany({
          where: { market: { zoneId: conversation.zoneId }, ...(nameFilter ? { name: nameFilter } : {}) },
          select: { id: true, name: true },
          take: 20,
        }))
      );
      const zone = await prisma.zone.findUnique({ where: { id: conversation.zoneId }, select: { managerId: true } });
      const marketsInZone = await prisma.market.findMany({
        where: { zoneId: conversation.zoneId },
        select: { supervisorId: true, overlookingSupervisorId: true },
      });
      const staffIds = [zone?.managerId, ...marketsInZone.flatMap((m) => [m.supervisorId, m.overlookingSupervisorId])].filter(Boolean);
      staff.push(
        ...(await prisma.user.findMany({
          where: { id: { in: staffIds }, ...(nameFilter ? { name: nameFilter } : {}) },
          select: { id: true, name: true, role: true },
          take: 20,
        }))
      );
    } else if (conversation.type === "CUSTOM_GROUP") {
      const members = await prisma.conversationMember.findMany({
        where: { conversationId: conversation.id },
        include: { employee: { select: { id: true, name: true } }, user: { select: { id: true, name: true, role: true } } },
      });
      for (const m of members) {
        if (m.employee) employees.push(m.employee);
        if (m.user) staff.push(m.user);
      }
    } else if (conversation.type === "DIRECT") {
      const otherId = conversation.participantAId === req.user.employeeId ? conversation.participantBId : conversation.participantAId;
      const other = otherId ? await prisma.employee.findUnique({ where: { id: otherId }, select: { id: true, name: true } }) : null;
      if (other) employees.push(other);
    } else if (conversation.type === "SUPERVISOR_DIRECT" || conversation.type === "RM_DIRECT") {
      if (req.user.kind === "staff") {
        const emp = await prisma.employee.findUnique({ where: { id: conversation.participantAId }, select: { id: true, name: true } });
        if (emp) employees.push(emp);
      } else {
        const staffUser = await prisma.user.findUnique({
          where: { id: conversation.staffParticipantId },
          select: { id: true, name: true, role: true },
        });
        if (staffUser) staff.push(staffUser);
      }
    } else if (conversation.type === "STAFF_DIRECT") {
      const otherId = conversation.staffParticipantId === req.user.userId ? conversation.staffParticipantBId : conversation.staffParticipantId;
      const other = otherId
        ? await prisma.user.findUnique({ where: { id: otherId }, select: { id: true, name: true, role: true } })
        : null;
      if (other) staff.push(other);
    }

    res.json({
      employees: employees.filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i).slice(0, 20),
      staff: staff.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i).slice(0, 20),
    });
  } catch (err) {
    next(err);
  }
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
    forwardedFromSenderName: null,
    reactions: [],
    mentions: [],
  };
}

// Chat UI redesign — profilePictureUrl + role added so the message list
// can render a real avatar + role label per bubble (see reference's
// "Rehan Ahmed · Regional Manager" treatment) instead of a name-only
// label. Purely additive selects, nothing else about this shape changed.
const MESSAGE_INCLUDE = {
  senderEmployee: { select: { id: true, name: true, profilePictureUrl: true } },
  senderUser: { select: { id: true, name: true, role: true, profilePictureUrl: true } },
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
    select: {
      id: true,
      emoji: true,
      employeeId: true,
      userId: true,
      isRecognition: true,
      employee: { select: { name: true } },
      user: { select: { name: true, role: true } },
    },
  },
  mentions: {
    select: {
      id: true,
      employeeId: true,
      userId: true,
      employee: { select: { name: true } },
      user: { select: { name: true, role: true } },
    },
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
    res.json(await buildEmployeeConversationList(req));
  } catch (err) {
    next(err);
  }
}

// Phase 3: factored out of listMyConversations so organizedConversations
// (the Important People/Groups/Individuals/Unread aggregator) can reuse
// the exact same shaped list instead of a second, possibly-drifting
// query — "views over one source of truth" (see the schema's own
// comments on this convention).
async function buildEmployeeConversationList(req) {
  {
    const employeeId = req.user.employeeId;
    const marketId = req.user.marketId;
    const market = await prisma.market.findUnique({ where: { id: marketId }, select: { zoneId: true } });

    const [marketGroup, warnings, zoneGroup, zoneAnnouncements, supervisorConvo, rmConvos, groupMemberships, directs] = await Promise.all([
      findOrCreateChannel(marketId, "MARKET_GROUP"),
      findOrCreateChannel(marketId, "WARNINGS"),
      market?.zoneId ? findOrCreateZoneChannel(market.zoneId, "ZONE_GROUP") : null,
      market?.zoneId ? findOrCreateZoneChannel(market.zoneId, "ZONE_ANNOUNCEMENTS") : null,
      findOrCreateSupervisorConversation(marketId, employeeId),
      // RM_DIRECT is NEVER auto-created here — an employee can't initiate
      // contact with a Regional Manager (spec §14). Only shown once the
      // RM has already opened it (see
      // getOrCreateEmployeeConversationForRegionalManager).
      prisma.conversation.findMany({ where: { type: "RM_DIRECT", participantAId: employeeId } }),
      prisma.conversationMember.findMany({ where: { employeeId }, include: { conversation: true } }),
      prisma.conversation.findMany({
        where: { type: "DIRECT", OR: [{ participantAId: employeeId }, { participantBId: employeeId }] },
      }),
    ]);
    const groups = groupMemberships.map((m) => m.conversation);

    const conversations = [
      marketGroup,
      warnings,
      ...(zoneGroup ? [zoneGroup] : []),
      ...(zoneAnnouncements ? [zoneAnnouncements] : []),
      ...(supervisorConvo ? [supervisorConvo] : []),
      ...rmConvos,
      ...groups,
      ...directs,
    ];

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
          c.type === "ZONE_GROUP" ? "Zone Group" :
          c.type === "ZONE_ANNOUNCEMENTS" ? "Zone Announcements" :
          c.type === "SUPERVISOR_DIRECT" ? (supervisorName ?? "Supervisor") :
          c.type === "RM_DIRECT" ? (rmNameById.get(c.staffParticipantId) ?? "Regional Manager") :
          c.type === "CUSTOM_GROUP" ? (c.name ?? "Group") :
          nameById.get(c.participantAId === employeeId ? c.participantBId : c.participantAId) ?? "Employee",
        otherEmployeeId: c.type === "DIRECT" ? (c.participantAId === employeeId ? c.participantBId : c.participantAId) : null,
        marketId: c.marketId,
        zoneId: c.zoneId,
        groupType: c.groupType,
        category: categoryOf(c),
        openJoin: c.openJoin,
        pictureUrl: c.pictureUrl,
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

    return shaped;
  }
}

// PATCH /api/conversations/:id/preference — Body: any subset of
// { pinned, muted }. Uses the same ConversationRead row as mark-as-read
// (this caller's one "my relationship to this conversation" row) rather
// than a new table — works for both Employee and staff callers (Phase 3
// extended ConversationRead with staffUserId for exactly this).
export async function setConversationPreference(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const { pinned, muted } = req.body;
    const data = { ...(pinned !== undefined ? { pinned } : {}), ...(muted !== undefined ? { muted } : {}) };
    const read =
      req.user.kind === "employee"
        ? await prisma.conversationRead.upsert({
            where: { conversationId_employeeId: { conversationId: conversation.id, employeeId: req.user.employeeId } },
            update: data,
            create: { conversationId: conversation.id, employeeId: req.user.employeeId, pinned: pinned ?? false, muted: muted ?? false },
          })
        : await prisma.conversationRead.upsert({
            where: { conversationId_staffUserId: { conversationId: conversation.id, staffUserId: req.user.userId } },
            update: data,
            create: { conversationId: conversation.id, staffUserId: req.user.userId, pinned: pinned ?? false, muted: muted ?? false },
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

// GET /api/conversations/zone/:zoneId/group and /zone/:zoneId/announcements
// — Production Chat §6-8. Any account (employee or staff) with real
// membership in this zone (see isZoneMember) may open either channel
// directly, the same "explicit fetch by id" pattern getMarketGroup/
// getWarnings already provide at market scope.
export async function getZoneGroup(req, res, next) {
  try {
    const zoneId = Number(req.params.zoneId);
    if (!(await isZoneMember(req.user, zoneId))) {
      return res.status(403).json({ error: "You do not have access to this zone" });
    }
    res.json(await findOrCreateZoneChannel(zoneId, "ZONE_GROUP"));
  } catch (err) {
    next(err);
  }
}

export async function getZoneAnnouncements(req, res, next) {
  try {
    const zoneId = Number(req.params.zoneId);
    if (!(await isZoneMember(req.user, zoneId))) {
      return res.status(403).json({ error: "You do not have access to this zone" });
    }
    res.json(await findOrCreateZoneChannel(zoneId, "ZONE_ANNOUNCEMENTS"));
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/zone-announcements/broadcast — the zone-level
// counterpart to postWarningBroadcast. Restricted to the zone's own
// Regional Manager (assertZoneAccess — never someone else's zone) or
// Admin (spec §8: "Regional Manager / Zone Manager, Higher-level
// authorized Admin"); everyone else in the zone is read-only, enforced in
// sendMessage's own ZONE_ANNOUNCEMENTS block, not just here.
export async function postZoneAnnouncement(req, res, next) {
  try {
    const { zoneId, body } = req.body;
    await assertZoneAccess(req.user, zoneId);

    const conversation = await findOrCreateZoneChannel(zoneId, "ZONE_ANNOUNCEMENTS");
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, body, senderUserId: req.user.userId },
    });

    await createNotificationForZone({
      zoneId,
      type: "ANNOUNCEMENT",
      title: "New Zone Announcement",
      body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
      linkType: "CONVERSATION",
      linkId: conversation.id,
    });

    res.status(201).json(message);
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

// GET /api/conversations/staff — SUPERVISOR or OVERLOOKING_SUPERVISOR
// only (must be a market's actual staff account): Market Group + Warnings
// + every SUPERVISOR_DIRECT conversation where this staff account is the
// staffParticipant (only ever populated for the actual Supervisor — an
// Overlooking account simply has none), + every CUSTOM_GROUP this account
// is an explicit member of. This is the Supervisor/Overlooking Chat tab's
// real conversation list. A Regional Manager does NOT use this endpoint —
// see listMyRegionalManagerConversations, which deliberately does NOT
// auto-include a market's Market Group/Warnings (spec §12).
export async function listMyStaffConversations(req, res, next) {
  try {
    if (req.user.role !== "SUPERVISOR" && req.user.role !== "OVERLOOKING_SUPERVISOR") {
      return res.status(403).json({ error: "Only a Supervisor or Overlooking account has a market chat inbox" });
    }
    res.json(await buildStaffConversationList(req));
  } catch (err) {
    next(err);
  }
}

// Phase 3: factored out for organizedConversations reuse (see
// buildEmployeeConversationList's own comment).
async function buildStaffConversationList(req) {
  {
    const marketId = req.user.marketId;
    const market = await prisma.market.findUnique({ where: { id: marketId }, select: { zoneId: true } });

    const [marketGroup, warnings, zoneGroup, zoneAnnouncements, directs, staffDirects, groupMemberships] = await Promise.all([
      findOrCreateChannel(marketId, "MARKET_GROUP"),
      findOrCreateChannel(marketId, "WARNINGS"),
      market?.zoneId ? findOrCreateZoneChannel(market.zoneId, "ZONE_GROUP") : null,
      market?.zoneId ? findOrCreateZoneChannel(market.zoneId, "ZONE_ANNOUNCEMENTS") : null,
      prisma.conversation.findMany({
        where: { type: "SUPERVISOR_DIRECT", marketId, staffParticipantId: req.user.userId },
      }),
      // STAFF_DIRECT (Phase 3 §3-4 — Important People): this Supervisor's
      // own 1:1s with other staff accounts (e.g. their zone's Regional
      // Manager). Never auto-created — only shown once opened via
      // getOrCreateStaffContact.
      prisma.conversation.findMany({
        where: { type: "STAFF_DIRECT", OR: [{ staffParticipantId: req.user.userId }, { staffParticipantBId: req.user.userId }] },
      }),
      prisma.conversationMember.findMany({ where: { userId: req.user.userId }, include: { conversation: true } }),
    ]);
    const groups = groupMemberships.map((m) => m.conversation);

    const conversations = [
      marketGroup,
      warnings,
      ...(zoneGroup ? [zoneGroup] : []),
      ...(zoneAnnouncements ? [zoneAnnouncements] : []),
      ...directs,
      ...staffDirects,
      ...groups,
    ];

    const [lastMessages, reads] = await Promise.all([
      Promise.all(
        conversations.map((c) => prisma.message.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" } }))
      ),
      prisma.conversationRead.findMany({
        where: { staffUserId: req.user.userId, conversationId: { in: conversations.map((c) => c.id) } },
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

    const employeeIds = directs.map((c) => c.participantAId);
    const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } });
    const nameById = new Map(employees.map((e) => [e.id, e.name]));

    const staffOtherIds = staffDirects.map((c) => (c.staffParticipantId === req.user.userId ? c.staffParticipantBId : c.staffParticipantId));
    const staffOthers = await prisma.user.findMany({ where: { id: { in: staffOtherIds } }, select: { id: true, name: true } });
    const staffNameById = new Map(staffOthers.map((u) => [u.id, u.name]));

    const shaped = conversations.map((c, i) => {
      const read = readByConversation.get(c.id);
      return {
        id: c.id,
        type: c.type,
        title:
          c.type === "MARKET_GROUP" ? "Market Group" :
          c.type === "WARNINGS" ? "Warnings" :
          c.type === "ZONE_GROUP" ? "Zone Group" :
          c.type === "ZONE_ANNOUNCEMENTS" ? "Zone Announcements" :
          c.type === "CUSTOM_GROUP" ? (c.name ?? "Group") :
          c.type === "STAFF_DIRECT" ? (staffNameById.get(c.staffParticipantId === req.user.userId ? c.staffParticipantBId : c.staffParticipantId) ?? "Staff") :
          nameById.get(c.participantAId) ?? "Employee",
        employeeId: c.type === "SUPERVISOR_DIRECT" ? c.participantAId : null,
        staffUserId: c.type === "STAFF_DIRECT" ? (c.staffParticipantId === req.user.userId ? c.staffParticipantBId : c.staffParticipantId) : null,
        marketId: c.marketId,
        zoneId: c.zoneId,
        groupType: c.groupType,
        category: categoryOf(c),
        openJoin: c.openJoin,
        pictureUrl: c.pictureUrl,
        lastMessage: lastMessages[i] ? { body: lastMessages[i].deletedAt ? "" : lastMessages[i].body, createdAt: lastMessages[i].createdAt } : null,
        unreadCount: unreadCounts[i],
        pinned: read?.pinned ?? false,
        muted: read?.muted ?? false,
      };
    });

    shaped.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at;
    });

    return shaped;
  }
}

// GET /api/conversations/rm — Regional-Manager-only: every CUSTOM_GROUP
// this RM is an explicit member of (across any of their zones/markets),
// plus every RM_DIRECT conversation they've personally opened with an
// employee. Deliberately does NOT auto-include a market's Market Group or
// Warnings, or every CUSTOM_GROUP in a zone they manage — spec §12's own
// rule: "do not automatically add the Regional Manager to every market
// group... management hierarchy and group membership are separate
// concepts." An RM sees a group only once they created it or were
// explicitly added to it, same as everyone else.
export async function listMyRegionalManagerConversations(req, res, next) {
  try {
    if (req.user.role !== "REGIONAL_MANAGER") {
      return res.status(403).json({ error: "Only a Regional Manager account has this chat inbox" });
    }
    res.json(await buildRmConversationList(req));
  } catch (err) {
    next(err);
  }
}

// Phase 3: factored out for organizedConversations reuse (see
// buildEmployeeConversationList's own comment).
async function buildRmConversationList(req) {
  {
    const zoneIds = req.user.zoneIds ?? [];
    const [groupMemberships, directs, staffDirects, zoneChannels] = await Promise.all([
      prisma.conversationMember.findMany({ where: { userId: req.user.userId }, include: { conversation: true } }),
      prisma.conversation.findMany({ where: { type: "RM_DIRECT", staffParticipantId: req.user.userId } }),
      // STAFF_DIRECT (Phase 3 §3-4 — Important People): this Regional
      // Manager's own 1:1s with other staff accounts (e.g. an Admin).
      prisma.conversation.findMany({
        where: { type: "STAFF_DIRECT", OR: [{ staffParticipantId: req.user.userId }, { staffParticipantBId: req.user.userId }] },
      }),
      // Production Chat §6-8 — General Zone + Zone Announcements for every
      // zone this RM manages, auto-provisioned same as a Supervisor's
      // Market Group/Warnings.
      Promise.all(
        zoneIds.flatMap((zoneId) => [
          findOrCreateZoneChannel(Number(zoneId), "ZONE_GROUP"),
          findOrCreateZoneChannel(Number(zoneId), "ZONE_ANNOUNCEMENTS"),
        ])
      ),
    ]);
    const groups = groupMemberships.map((m) => m.conversation);
    const conversations = [...zoneChannels, ...groups, ...directs, ...staffDirects];

    const [lastMessages, reads] = await Promise.all([
      Promise.all(
        conversations.map((c) => prisma.message.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" } }))
      ),
      prisma.conversationRead.findMany({
        where: { staffUserId: req.user.userId, conversationId: { in: conversations.map((c) => c.id) } },
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

    const employeeIds = directs.map((c) => c.participantAId);
    const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } });
    const nameById = new Map(employees.map((e) => [e.id, e.name]));

    const staffOtherIds = staffDirects.map((c) => (c.staffParticipantId === req.user.userId ? c.staffParticipantBId : c.staffParticipantId));
    const staffOthers = await prisma.user.findMany({ where: { id: { in: staffOtherIds } }, select: { id: true, name: true } });
    const staffNameById = new Map(staffOthers.map((u) => [u.id, u.name]));

    const shaped = conversations.map((c, i) => {
      const read = readByConversation.get(c.id);
      return {
        id: c.id,
        type: c.type,
        title:
          c.type === "ZONE_GROUP" ? "Zone Group" :
          c.type === "ZONE_ANNOUNCEMENTS" ? "Zone Announcements" :
          c.type === "CUSTOM_GROUP" ? (c.name ?? "Group") :
          c.type === "STAFF_DIRECT" ? (staffNameById.get(c.staffParticipantId === req.user.userId ? c.staffParticipantBId : c.staffParticipantId) ?? "Staff") :
          nameById.get(c.participantAId) ?? "Employee",
        employeeId: c.type === "RM_DIRECT" ? c.participantAId : null,
        staffUserId: c.type === "STAFF_DIRECT" ? (c.staffParticipantId === req.user.userId ? c.staffParticipantBId : c.staffParticipantId) : null,
        marketId: c.marketId,
        zoneId: c.zoneId,
        groupType: c.groupType,
        category: categoryOf(c),
        openJoin: c.openJoin,
        pictureUrl: c.pictureUrl,
        lastMessage: lastMessages[i] ? { body: lastMessages[i].deletedAt ? "" : lastMessages[i].body, createdAt: lastMessages[i].createdAt } : null,
        unreadCount: unreadCounts[i],
        pinned: read?.pinned ?? false,
        muted: read?.muted ?? false,
      };
    });

    shaped.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at;
    });

    return shaped;
  }
}

// GET /api/conversations/admin — Admin-only (Phase 3.5). Every CUSTOM_GROUP
// this Admin is an explicit member of, plus every STAFF_DIRECT
// conversation they've opened with another staff account (Important
// People's underlying connection — see authorizedStaffContactsFor).
// There is no ADMIN_DIRECT-with-employee conversation type in this app
// (Admin never gets a 1:1 with a specific employee the way a Supervisor/
// RM does) — Admin's "Individuals" view is staff-to-staff only, an
// accurate reflection of what the backend actually supports rather than
// an invented capability.
export async function listMyAdminConversations(req, res, next) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only an Admin account has this chat inbox" });
    }
    res.json(await buildAdminConversationList(req));
  } catch (err) {
    next(err);
  }
}

// Phase 3.5: factored out for organizedConversations reuse (see
// buildEmployeeConversationList's own comment).
async function buildAdminConversationList(req) {
  {
    const [groupMemberships, staffDirects] = await Promise.all([
      prisma.conversationMember.findMany({ where: { userId: req.user.userId }, include: { conversation: true } }),
      prisma.conversation.findMany({
        where: { type: "STAFF_DIRECT", OR: [{ staffParticipantId: req.user.userId }, { staffParticipantBId: req.user.userId }] },
      }),
    ]);
    const groups = groupMemberships.map((m) => m.conversation);
    const conversations = [...groups, ...staffDirects];

    const [lastMessages, reads] = await Promise.all([
      Promise.all(
        conversations.map((c) => prisma.message.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" } }))
      ),
      prisma.conversationRead.findMany({
        where: { staffUserId: req.user.userId, conversationId: { in: conversations.map((c) => c.id) } },
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

    const staffOtherIds = staffDirects.map((c) => (c.staffParticipantId === req.user.userId ? c.staffParticipantBId : c.staffParticipantId));
    const staffOthers = await prisma.user.findMany({ where: { id: { in: staffOtherIds } }, select: { id: true, name: true } });
    const staffNameById = new Map(staffOthers.map((u) => [u.id, u.name]));

    const shaped = conversations.map((c, i) => {
      const read = readByConversation.get(c.id);
      return {
        id: c.id,
        type: c.type,
        title:
          c.type === "CUSTOM_GROUP" ? (c.name ?? "Group") :
          staffNameById.get(c.staffParticipantId === req.user.userId ? c.staffParticipantBId : c.staffParticipantId) ?? "Staff",
        staffUserId: c.type === "STAFF_DIRECT" ? (c.staffParticipantId === req.user.userId ? c.staffParticipantBId : c.staffParticipantId) : null,
        marketId: c.marketId,
        zoneId: c.zoneId,
        groupType: c.groupType,
        category: categoryOf(c),
        openJoin: c.openJoin,
        pictureUrl: c.pictureUrl,
        lastMessage: lastMessages[i] ? { body: lastMessages[i].deletedAt ? "" : lastMessages[i].body, createdAt: lastMessages[i].createdAt } : null,
        unreadCount: unreadCounts[i],
        pinned: read?.pinned ?? false,
        muted: read?.muted ?? false,
      };
    });

    shaped.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at;
    });

    return shaped;
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

// Phase 3 §3-4 — Important People's underlying authorization: which
// staff accounts a given staff user is allowed to open a real
// STAFF_DIRECT conversation with (and therefore also favorite as an
// Important Contact — see addImportantContact). Conservative mapping
// onto TeamMart's actual StaffRole enum (there is no separate "CEO"
// role): the spec's own examples — CEO, Operations Manager, senior
// management — are all ADMIN accounts here. A Regional Manager may
// contact any ADMIN. A Supervisor/Overlooking Supervisor may contact
// their own zone's Regional Manager(s) plus any ADMIN. An ADMIN may
// contact any other staff account (already the top of the hierarchy).
// This is the ONE place that decides staff-to-staff contact
// eligibility — reused by both getOrCreateStaffContact (creating the
// conversation) and addImportantContact (favoriting), so favoriting can
// never grant a permission the person didn't already have.
// Exported (Verification pass §1) so communicationTargeting.js can reuse
// the EXACT same "which staff accounts is this caller allowed to reach"
// rule for Warnings & Notifications' Specific-Supervisor targeting,
// rather than re-deriving a second, possibly-diverging version of it.
export async function authorizedStaffContactsFor(user) {
  if (user.role === "ADMIN") {
    return prisma.user.findMany({ where: { id: { not: user.userId } }, select: { id: true, name: true, role: true } });
  }
  if (user.role === "REGIONAL_MANAGER") {
    // Cleanup Phase §4 — a Regional/Zone Manager must be able to see and
    // message the Supervisors/Overlooking accounts of markets inside
    // their OWN zones (never every Supervisor company-wide) — this used
    // to only return Admin, leaving Supervisors completely unreachable
    // from the RM side even though the reverse direction already worked
    // (see the SUPERVISOR/OVERLOOKING_SUPERVISOR branch below, which
    // already resolves its own zone's manager the same way).
    const marketsInZone = await prisma.market.findMany({
      where: { zoneId: { in: user.zoneIds ?? [] } },
      select: { supervisorId: true, overlookingSupervisorId: true },
    });
    const supervisorIds = marketsInZone.flatMap((m) => [m.supervisorId, m.overlookingSupervisorId]).filter(Boolean);
    return prisma.user.findMany({
      where: { OR: [{ role: "ADMIN" }, { id: { in: supervisorIds } }] },
      select: { id: true, name: true, role: true },
    });
  }
  if (user.role === "SUPERVISOR" || user.role === "OVERLOOKING_SUPERVISOR") {
    const market = user.marketId ? await prisma.market.findUnique({ where: { id: user.marketId }, select: { zoneId: true } }) : null;
    const zone = market?.zoneId ? await prisma.zone.findUnique({ where: { id: market.zoneId }, select: { managerId: true } }) : null;
    return prisma.user.findMany({
      where: { OR: [{ role: "ADMIN" }, ...(zone?.managerId ? [{ id: zone.managerId }] : [])] },
      select: { id: true, name: true, role: true },
    });
  }
  return [];
}

async function isAuthorizedStaffContact(user, targetUserId) {
  const contacts = await authorizedStaffContactsFor(user);
  return contacts.some((c) => c.id === targetUserId);
}

// GET /api/conversations/staff-contacts — staff-only. Backend-filtered
// list of staff accounts this caller is allowed to start a real 1:1 with
// (see authorizedStaffContactsFor) — never every staff account in the
// company (spec: "never fetch everything and filter client-side").
export async function listAuthorizedStaffContacts(req, res, next) {
  try {
    const contacts = await authorizedStaffContactsFor(req.user);
    res.json(contacts);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/staff-contacts/:userId — staff-only. Get-or-
// create the STAFF_DIRECT conversation with another staff account. The
// target must be one of this caller's authorized contacts (re-checked
// here server-side, never trusted from the frontend having merely shown
// the option).
export async function getOrCreateStaffContact(req, res, next) {
  try {
    const targetUserId = Number(req.params.userId);
    if (targetUserId === req.user.userId) {
      return res.status(400).json({ error: "Cannot start a conversation with yourself" });
    }
    if (!(await isAuthorizedStaffContact(req.user, targetUserId))) {
      return res.status(403).json({ error: "You are not authorized to contact this staff account" });
    }
    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, name: true, role: true } });
    if (!target) return res.status(404).json({ error: "Staff account not found" });

    const pair = staffDirectPair(req.user.userId, targetUserId);
    const existing = await prisma.conversation.findFirst({ where: { type: "STAFF_DIRECT", ...pair } });
    const conversation = existing ?? (await prisma.conversation.create({ data: { type: "STAFF_DIRECT", ...pair } }));

    res.json({ ...conversation, title: target.name });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// Important People (Phase 3 §3-4) — a staff owner's personal, ordered
// shortlist of contacts. Purely organizational (see ImportantContact's
// schema comment) — never a communication-permission mechanism. Adding a
// contact here re-validates eligibility via authorizedStaffContactsFor /
// requireAccessibleEmployee exactly as creating the conversation would,
// so a favorite can never outlive or bypass the underlying authorization.
// ---------------------------------------------------------------------

async function shapeImportantContact(row) {
  return {
    id: row.id,
    priority: row.priority,
    contactUserId: row.contactUserId,
    contactEmployeeId: row.contactEmployeeId,
    name: row.contactUser?.name ?? row.contactEmployee?.name,
    role: row.contactUser?.role ?? null,
    position: row.contactEmployee?.position ?? null,
  };
}

// GET /api/conversations/important-people — staff-only. This owner's own
// shortlist, most important first.
export async function listImportantContacts(req, res, next) {
  try {
    const rows = await prisma.importantContact.findMany({
      where: { ownerUserId: req.user.userId },
      include: {
        contactUser: { select: { id: true, name: true, role: true } },
        contactEmployee: { select: { id: true, name: true, position: true } },
      },
      orderBy: { priority: "desc" },
    });
    res.json(await Promise.all(rows.map(shapeImportantContact)));
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/important-people — staff-only. Body:
// { contactUserId? | contactEmployeeId?, priority? }. contactUserId must
// be one of this caller's authorized staff contacts (see
// authorizedStaffContactsFor); contactEmployeeId must be an employee this
// caller can already access (requireAccessibleEmployee — same check
// used for RM_DIRECT/SUPERVISOR_DIRECT creation).
export async function addImportantContact(req, res, next) {
  try {
    const { contactUserId, contactEmployeeId, priority } = req.body;

    if (contactUserId) {
      if (!(await isAuthorizedStaffContact(req.user, contactUserId))) {
        return res.status(403).json({ error: "You are not authorized to add this staff account as a contact" });
      }
    } else {
      await requireAccessibleEmployee(req.user, contactEmployeeId);
    }

    const row = await prisma.importantContact.upsert({
      where: contactUserId
        ? { ownerUserId_contactUserId: { ownerUserId: req.user.userId, contactUserId } }
        : { ownerUserId_contactEmployeeId: { ownerUserId: req.user.userId, contactEmployeeId } },
      update: { priority },
      create: { ownerUserId: req.user.userId, contactUserId: contactUserId ?? null, contactEmployeeId: contactEmployeeId ?? null, priority },
      include: {
        contactUser: { select: { id: true, name: true, role: true } },
        contactEmployee: { select: { id: true, name: true, position: true } },
      },
    });

    res.status(201).json(await shapeImportantContact(row));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/conversations/important-people/:id — staff-only, owner-only.
// Body: { priority }. Reordering — never touches another owner's row
// (the where clause below scopes to req.user.userId, not just the row id).
export async function reorderImportantContact(req, res, next) {
  try {
    const { count } = await prisma.importantContact.updateMany({
      where: { id: req.params.id, ownerUserId: req.user.userId },
      data: { priority: req.body.priority },
    });
    if (count === 0) return res.status(404).json({ error: "Contact not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/conversations/important-people/:id — staff-only, owner-only.
// Unfavoriting only — never deletes the underlying conversation/messages.
export async function removeImportantContact(req, res, next) {
  try {
    await prisma.importantContact.deleteMany({ where: { id: req.params.id, ownerUserId: req.user.userId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Group ADMIN — spec's own explicit rule: "do not make every Supervisor
// automatically the administrator of every group." A staff or employee
// account controls a CUSTOM_GROUP (add/remove/promote/demote/rename/
// change picture) only when THEIR OWN ConversationMember row for that
// group has isAdmin=true — never just "I'm a Supervisor" or "I created
// it" (the creator gets isAdmin=true on their row at creation, but that's
// the only special treatment being the creator ever gets; a demoted
// creator loses control exactly like anyone else).
async function isGroupAdmin(conversationId, user) {
  if (user.kind === "employee") {
    const m = await prisma.conversationMember.findUnique({
      where: { conversationId_employeeId: { conversationId, employeeId: user.employeeId } },
    });
    return !!m?.isAdmin;
  }
  if (user.kind === "staff") {
    const m = await prisma.conversationMember.findFirst({ where: { conversationId, userId: user.userId } });
    return !!m?.isAdmin;
  }
  return false;
}

// Shared by renameGroup/changeGroupPicture/addGroupMember/removeGroupMember/
// setGroupMemberAdmin — loads the group and confirms the caller is one of
// its admins. Returns the conversation on success, or null after already
// sending the error response (same "check inside the function, res
// already handled" convention as requireGroupManagerRole before it).
async function requireGroupAdmin(req, res) {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation || conversation.type !== "CUSTOM_GROUP") {
    res.status(404).json({ error: "Group not found" });
    return null;
  }
  if (!(await isGroupAdmin(conversation.id, req.user))) {
    res.status(403).json({ error: "Only a group admin can do this" });
    return null;
  }
  return conversation;
}

async function shapeGroupMembers(conversationId) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    include: {
      employee: { select: { id: true, name: true, position: true, lastActiveAt: true } },
      user: { select: { id: true, name: true, role: true, lastActiveAt: true } },
    },
    orderBy: { addedAt: "asc" },
  });
  return members.map((m) => ({
    id: m.id,
    kind: m.employeeId ? "employee" : "staff",
    online: isOnline(m.employee?.lastActiveAt ?? m.user?.lastActiveAt),
    employeeId: m.employeeId,
    userId: m.userId,
    name: m.employee?.name ?? m.user?.name,
    position: m.employee?.position ?? m.user?.role,
    isAdmin: m.isAdmin,
    addedAt: m.addedAt,
  }));
}

// Only these roles may CREATE a group at all (spec §15's permission
// summary never lists group-creation for Overlooking). Once created,
// control passes entirely to admin membership (isGroupAdmin) — this list
// only gates the initial creation action.
const GROUP_CREATOR_ROLES = ["SUPERVISOR", "ADMIN", "REGIONAL_MANAGER"];

// Chat UI redesign — the authorization rule for "who may THIS staff
// member add to a group", now that group creation/invites are
// person-by-person rather than scoped to one pre-chosen market/zone (see
// createGroup/addGroupMember/listGroupMemberCandidates below). Reuses the
// exact same per-role reach every other staff-facing chat feature
// already uses — staffCanAccessMarket for an employee target (their own
// market for Supervisor/Overlooking, any market in their zones for a
// Regional Manager, anyone for Admin), authorizedStaffContactsFor for a
// staff target — instead of inventing a new access model.
async function canAddPersonToGroup(actor, { employeeId, userId }) {
  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { marketId: true } });
    if (!employee) return false;
    return (await staffCanAccessMarket(actor, employee.marketId)) === true;
  }
  if (userId) {
    if (userId === actor.userId) return true;
    return isAuthorizedStaffContact(actor, userId);
  }
  return false;
}

// POST /api/conversations/groups — Chat UI redesign: person-by-person
// group creation. Body: { name, memberEmployeeIds?, memberStaffUserIds?,
// groupType?, category?, openJoin?, pictureUrl?, marketId?, zoneId? }.
// marketId/zoneId are now optional display metadata only (e.g. "which
// market is this Night Shift group for") — they no longer constrain who
// can be a member. Every proposed member is instead checked individually
// against canAddPersonToGroup, the same per-role reach used everywhere
// else in chat (own market's employees for Supervisor/Overlooking, any
// employee in-zone for a Regional Manager, anyone for Admin; an
// authorized staff contact either way) — so a Supervisor can now build a
// group out of specific people without first "selecting a market", while
// still never reaching outside who they're actually allowed to contact.
// The creator is always added as the group's first admin.
export async function createGroup(req, res, next) {
  try {
    if (req.user.kind !== "staff" || !GROUP_CREATOR_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: "This action requires a Supervisor, Regional Manager, or Admin account" });
    }
    const {
      name,
      marketId = null,
      zoneId = null,
      memberEmployeeIds = [],
      memberStaffUserIds = [],
      groupType = "NORMAL",
      category = "GENERAL",
      openJoin = false,
      pictureUrl,
    } = req.body;

    if (memberEmployeeIds.length === 0 && memberStaffUserIds.length === 0) {
      return res.status(400).json({ error: "Select at least one member" });
    }

    let employees = [];
    if (memberEmployeeIds.length) {
      employees = await prisma.employee.findMany({ where: { id: { in: memberEmployeeIds } } });
      if (employees.length !== memberEmployeeIds.length) {
        return res.status(400).json({ error: "One or more selected employees could not be found" });
      }
      for (const e of employees) {
        if (!(await canAddPersonToGroup(req.user, { employeeId: e.id }))) {
          return res.status(400).json({ error: `You are not authorized to add ${e.name} to a group` });
        }
      }
    }

    const staffIds = memberStaffUserIds.filter((id) => id !== req.user.userId);
    let staffMembers = [];
    if (staffIds.length) {
      staffMembers = await prisma.user.findMany({ where: { id: { in: staffIds } } });
      if (staffMembers.length !== staffIds.length) {
        return res.status(400).json({ error: "One or more selected staff accounts could not be found" });
      }
      for (const s of staffMembers) {
        if (!(await canAddPersonToGroup(req.user, { userId: s.id }))) {
          return res.status(400).json({ error: `You are not authorized to add ${s.name} to a group` });
        }
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: "CUSTOM_GROUP",
        marketId: marketId ?? null,
        zoneId: zoneId ?? null,
        name,
        groupType,
        // A WARNING-type group is always shown under Announcements
        // regardless of category (see categoryOf) — no point storing one.
        category: groupType === "WARNING" ? null : category,
        openJoin: !!openJoin,
        pictureUrl: pictureUrl ?? null,
        createdById: req.user.userId,
        members: {
          create: [
            { userId: req.user.userId, isAdmin: true },
            ...employees.map((e) => ({ employeeId: e.id })),
            ...staffMembers.map((s) => ({ userId: s.id })),
          ],
        },
      },
    });

    res.status(201).json({ ...conversation, members: await shapeGroupMembers(conversation.id) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/conversations/:id/name — spec §8: renaming persists for
// every member (it's a column on the shared Conversation row, not a
// per-user label). Admin-only (see requireGroupAdmin).
export async function renameGroup(req, res, next) {
  try {
    const conversation = await requireGroupAdmin(req, res);
    if (!conversation) return;
    const updated = await prisma.conversation.update({ where: { id: conversation.id }, data: { name: req.body.name } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/conversations/:id — delete a CUSTOM_GROUP entirely. Admin-
// only (requireGroupAdmin — same rule as rename/picture/member management:
// a real membership row with isAdmin=true, never role alone). Every other
// conversation type (MARKET_GROUP/ZONE_GROUP/WARNINGS/ZONE_ANNOUNCEMENTS/
// DIRECT/etc.) is implicit organizational infrastructure, not something
// any user "owns" — requireGroupAdmin already 404s for those (it only
// ever matches type: "CUSTOM_GROUP"), so this can never be used to wipe
// out a market/zone's shared channel.
//
// A real hard delete, unlike every report-deletion endpoint elsewhere in
// this app (Notification/MarketProblem/ItemReport/etc. all soft-delete
// for audit-trail reasons) — a chat group has no such retention
// requirement once its own admin chooses to delete it, matching ordinary
// messenger "delete group" semantics. Message/MessageReaction/
// MessageMention/ConversationRead/ConversationMember all reference this
// conversation with no cascade (Message/ConversationRead) or a cascade
// that still requires those tables to go first (ConversationMember) —
// deleted explicitly, in FK-safe order, inside one transaction so a
// crash partway through can never leave an orphaned half-deleted group.
export async function deleteGroup(req, res, next) {
  try {
    const conversation = await requireGroupAdmin(req, res);
    if (!conversation) return;

    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversationId: conversation.id } }),
      prisma.conversationRead.deleteMany({ where: { conversationId: conversation.id } }),
      prisma.conversationMember.deleteMany({ where: { conversationId: conversation.id } }),
      prisma.conversation.delete({ where: { id: conversation.id } }),
    ]);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// PATCH /api/conversations/:id/picture — spec §1/§13: change the group's
// profile picture. Same data-URL convention as every other "photo" in
// this app (prepareImageForUpload on the frontend) — no real file storage
// backend exists yet. Admin-only.
export async function changeGroupPicture(req, res, next) {
  try {
    const conversation = await requireGroupAdmin(req, res);
    if (!conversation) return;
    const updated = await prisma.conversation.update({ where: { id: conversation.id }, data: { pictureUrl: req.body.pictureUrl } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/:id/members — anyone with access to the group
// (an actual member — see conversationAccessFor's CUSTOM_GROUP branch)
// can view its roster; viewing never requires being an admin.
export async function listGroupMembers(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation || conversation.type !== "CUSTOM_GROUP") return res.status(404).json({ error: "Group not found" });
    res.json(await shapeGroupMembers(conversation.id));
  } catch (err) {
    next(err);
  }
}

// Chat UI redesign — real "members/online" counts for the four implicit-
// membership types (MARKET_GROUP/WARNINGS/ZONE_GROUP/ZONE_ANNOUNCEMENTS),
// which have no ConversationMember rows to count at all (see
// ConversationMember's own schema comment — it's only ever populated for
// CUSTOM_GROUP). Mirrors the exact same "who's actually in this
// market/zone" logic already used to decide read access
// (conversationAccessFor/isZoneMember) and to build each role's
// conversation list, so this count can never disagree with who can
// actually see the channel. Returns null for any other type — there is
// no "members" concept for a 1:1 thread.
async function implicitGroupPresence(conversation) {
  if (conversation.type === "MARKET_GROUP" || conversation.type === "WARNINGS") {
    const [employees, market] = await Promise.all([
      prisma.employee.findMany({ where: { marketId: conversation.marketId }, select: { lastActiveAt: true } }),
      prisma.market.findUnique({ where: { id: conversation.marketId }, select: { supervisorId: true, overlookingSupervisorId: true } }),
    ]);
    const staffIds = [market?.supervisorId, market?.overlookingSupervisorId].filter(Boolean);
    const staff = staffIds.length ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { lastActiveAt: true } }) : [];
    const all = [...employees, ...staff];
    return { memberCount: all.length, onlineCount: all.filter((p) => isOnline(p.lastActiveAt)).length };
  }

  if (conversation.type === "ZONE_GROUP" || conversation.type === "ZONE_ANNOUNCEMENTS") {
    const [employees, markets, zone] = await Promise.all([
      prisma.employee.findMany({ where: { market: { zoneId: conversation.zoneId } }, select: { lastActiveAt: true } }),
      prisma.market.findMany({ where: { zoneId: conversation.zoneId }, select: { supervisorId: true, overlookingSupervisorId: true } }),
      prisma.zone.findUnique({ where: { id: conversation.zoneId }, select: { managerId: true } }),
    ]);
    const staffIds = [...markets.flatMap((m) => [m.supervisorId, m.overlookingSupervisorId]), zone?.managerId].filter(Boolean);
    const staff = staffIds.length ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { lastActiveAt: true } }) : [];
    const all = [...employees, ...staff];
    return { memberCount: all.length, onlineCount: all.filter((p) => isOnline(p.lastActiveAt)).length };
  }

  return null;
}

// GET /api/conversations/:id/presence-summary — Chat UI redesign: real
// "X members, Y online" for a group-like conversation, gated by the same
// conversationAccessFor every other per-conversation read already uses.
// { memberCount: null, onlineCount: null } for a 1:1 thread — there's no
// "members" concept for two people, and ConversationScreen.jsx simply
// doesn't render a subtitle in that case.
export async function getPresenceSummary(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    if (conversation.type === "CUSTOM_GROUP") {
      const members = await shapeGroupMembers(conversation.id);
      return res.json({ memberCount: members.length, onlineCount: members.filter((m) => m.online).length });
    }

    const presence = await implicitGroupPresence(conversation);
    res.json(presence ?? { memberCount: null, onlineCount: null });
  } catch (err) {
    next(err);
  }
}

// Actually adds { employeeId | userId } as a real ConversationMember of
// `conversation` — the one place both an admin's direct add and an
// openJoin group's member-initiated add end up. Re-validates
// canAddPersonToGroup even for an admin caller, since "I'm an admin of
// this group" was never itself a reason to bypass "is this specific
// person someone I'm allowed to reach" — same caution createGroup
// already takes for every proposed member.
async function insertGroupMember(actor, conversation, { employeeId, userId }) {
  if (employeeId) {
    if (!(await canAddPersonToGroup(actor, { employeeId }))) {
      throw new HttpError(400, "You are not authorized to add this employee");
    }
    await prisma.conversationMember.upsert({
      where: { conversationId_employeeId: { conversationId: conversation.id, employeeId } },
      update: {},
      create: { conversationId: conversation.id, employeeId },
    });
  } else if (userId) {
    if (!(await canAddPersonToGroup(actor, { userId }))) {
      throw new HttpError(400, "You are not authorized to add this staff account");
    }
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: conversation.id, userId } },
      update: {},
      create: { conversationId: conversation.id, userId },
    });
  } else {
    throw new HttpError(400, "Provide either employeeId or userId");
  }
}

// POST /api/conversations/:id/members — Chat UI redesign: Body:
// { employeeId } or { userId } (exactly one). Three cases, depending on
// the caller's standing in THIS group:
//   - A group admin adds directly, same as before.
//   - Any other MEMBER (staff only — matches createGroup's own staff-
//     only boundary) may still propose someone: if the group has
//     openJoin=true, that lands directly too (the admin already opted
//     into "let anyone in without approval"); otherwise it creates a
//     GroupJoinRequest for an admin to approve/reject instead of adding
//     anyone, and notifies the group's admin(s).
//   - Anyone else (a non-member, or an employee member) gets the same
//     403 this endpoint always returned for a non-admin.
export async function addGroupMember(req, res, next) {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation || conversation.type !== "CUSTOM_GROUP") return res.status(404).json({ error: "Group not found" });

    const { employeeId, userId } = req.body;
    const admin = await isGroupAdmin(conversation.id, req.user);

    if (admin || conversation.openJoin) {
      if (!admin) {
        if (req.user.kind !== "staff") return res.status(403).json({ error: "Only a group member can do this" });
        const membership = await prisma.conversationMember.findFirst({ where: { conversationId: conversation.id, userId: req.user.userId } });
        if (!membership) return res.status(403).json({ error: "Only a group member can do this" });
      }
      await insertGroupMember(req.user, conversation, { employeeId, userId });
      return res.status(201).json(await shapeGroupMembers(conversation.id));
    }

    if (req.user.kind !== "staff") return res.status(403).json({ error: "Only a group admin can do this" });
    const membership = await prisma.conversationMember.findFirst({ where: { conversationId: conversation.id, userId: req.user.userId } });
    if (!membership) return res.status(403).json({ error: "Only a group admin can do this" });
    if (!employeeId && !userId) return res.status(400).json({ error: "Provide either employeeId or userId" });
    if (!(await canAddPersonToGroup(req.user, { employeeId, userId }))) {
      return res.status(400).json({ error: "You are not authorized to add this person" });
    }

    const alreadyMember = employeeId
      ? await prisma.conversationMember.findUnique({ where: { conversationId_employeeId: { conversationId: conversation.id, employeeId } } })
      : await prisma.conversationMember.findFirst({ where: { conversationId: conversation.id, userId } });
    if (alreadyMember) return res.status(400).json({ error: "This person is already a member" });

    const request = await prisma.groupJoinRequest.upsert({
      where: employeeId
        ? { conversationId_employeeId: { conversationId: conversation.id, employeeId } }
        : { conversationId_userId: { conversationId: conversation.id, userId } },
      update: {
        status: "PENDING",
        invitedByUserId: req.user.userId,
        invitedByEmployeeId: null,
        requestedAt: new Date(),
        reviewedAt: null,
        reviewedByUserId: null,
        reviewedByEmployeeId: null,
      },
      create: { conversationId: conversation.id, employeeId: employeeId ?? null, userId: userId ?? null, invitedByUserId: req.user.userId },
    });

    const admins = await prisma.conversationMember.findMany({ where: { conversationId: conversation.id, isAdmin: true } });
    await Promise.all(
      admins.map((a) =>
        a.userId
          ? createNotificationForUser({
              userId: a.userId,
              type: "GROUP_JOIN_REQUESTED",
              title: "New group join request",
              body: `${req.user.name ?? "A member"} proposed adding someone to "${conversation.name ?? "a group"}"`,
              linkType: "CONVERSATION",
              linkId: conversation.id,
            })
          : createNotification({
              employeeId: a.employeeId,
              type: "GROUP_JOIN_REQUESTED",
              title: "New group join request",
              body: `${req.user.name ?? "A member"} proposed adding someone to "${conversation.name ?? "a group"}"`,
              linkType: "CONVERSATION",
              linkId: conversation.id,
            })
      )
    );

    res.status(202).json({ pending: true, request });
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/:id/join-requests — group admin only. Pending
// requests waiting on this admin's approve/reject.
export async function listGroupJoinRequests(req, res, next) {
  try {
    const conversation = await requireGroupAdmin(req, res);
    if (!conversation) return;
    const requests = await prisma.groupJoinRequest.findMany({
      where: { conversationId: conversation.id, status: "PENDING" },
      include: {
        employee: { select: { id: true, name: true, position: true } },
        user: { select: { id: true, name: true, role: true } },
        invitedByEmployee: { select: { id: true, name: true } },
        invitedByUser: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: "asc" },
    });
    res.json(
      requests.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        userId: r.userId,
        name: r.employee?.name ?? r.user?.name,
        position: r.employee?.position ?? r.user?.role,
        invitedByName: r.invitedByEmployee?.name ?? r.invitedByUser?.name,
        requestedAt: r.requestedAt,
      }))
    );
  } catch (err) {
    next(err);
  }
}

// Shared by approve/reject below — loads a PENDING request that actually
// belongs to a group this caller admins, or responds with the
// appropriate error and returns null (same "check inside, res already
// handled" convention as requireGroupAdmin itself).
async function requirePendingJoinRequest(req, res) {
  const conversation = await requireGroupAdmin(req, res);
  if (!conversation) return null;
  const request = await prisma.groupJoinRequest.findFirst({
    where: { id: req.params.requestId, conversationId: conversation.id },
  });
  if (!request) {
    res.status(404).json({ error: "Join request not found" });
    return null;
  }
  if (request.status !== "PENDING") {
    res.status(400).json({ error: "This request has already been reviewed" });
    return null;
  }
  return { conversation, request };
}

// POST /api/conversations/:id/join-requests/:requestId/approve — admin
// only. Creates the real ConversationMember row and notifies the person
// who was proposed.
export async function approveGroupJoinRequest(req, res, next) {
  try {
    const loaded = await requirePendingJoinRequest(req, res);
    if (!loaded) return;
    const { conversation, request } = loaded;

    await prisma.$transaction([
      prisma.conversationMember.upsert({
        where: request.employeeId
          ? { conversationId_employeeId: { conversationId: conversation.id, employeeId: request.employeeId } }
          : { conversationId_userId: { conversationId: conversation.id, userId: request.userId } },
        update: {},
        create: { conversationId: conversation.id, employeeId: request.employeeId, userId: request.userId },
      }),
      prisma.groupJoinRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedByUserId: req.user.userId },
      }),
    ]);

    const notify = request.employeeId
      ? createNotification({
          employeeId: request.employeeId,
          type: "GROUP_JOIN_REVIEWED",
          title: "You were added to a group",
          body: `Your request to join "${conversation.name ?? "a group"}" was approved.`,
          linkType: "CONVERSATION",
          linkId: conversation.id,
        })
      : createNotificationForUser({
          userId: request.userId,
          type: "GROUP_JOIN_REVIEWED",
          title: "You were added to a group",
          body: `Your request to join "${conversation.name ?? "a group"}" was approved.`,
          linkType: "CONVERSATION",
          linkId: conversation.id,
        });
    await notify;

    res.json(await shapeGroupMembers(conversation.id));
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/join-requests/:requestId/reject — admin
// only. No membership row is ever created; the requester is notified.
export async function rejectGroupJoinRequest(req, res, next) {
  try {
    const loaded = await requirePendingJoinRequest(req, res);
    if (!loaded) return;
    const { conversation, request } = loaded;

    await prisma.groupJoinRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewedByUserId: req.user.userId },
    });

    const notify = request.employeeId
      ? createNotification({
          employeeId: request.employeeId,
          type: "GROUP_JOIN_REVIEWED",
          title: "Group join request declined",
          body: `Your request to join "${conversation.name ?? "a group"}" was not approved.`,
          linkType: "CONVERSATION",
          linkId: conversation.id,
        })
      : createNotificationForUser({
          userId: request.userId,
          type: "GROUP_JOIN_REVIEWED",
          title: "Group join request declined",
          body: `Your request to join "${conversation.name ?? "a group"}" was not approved.`,
          linkType: "CONVERSATION",
          linkId: conversation.id,
        });
    await notify;

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/conversations/:id/settings — admin only. Body: { openJoin }.
// Same admin-gated single-field-update shape as renameGroup/
// changeGroupPicture.
export async function updateGroupSettings(req, res, next) {
  try {
    const conversation = await requireGroupAdmin(req, res);
    if (!conversation) return;
    const { openJoin } = req.body;
    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { ...(openJoin !== undefined ? { openJoin: !!openJoin } : {}) },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/groups/candidates?search= — staff-only
// (GROUP_CREATOR_ROLES, same as createGroup — a Supervisor/RM/Admin
// picking who to invite either at creation time or via GroupInfoModal's
// "Add member"). Scoped by the same canAddPersonToGroup rule everything
// else here already uses: employees reachable via staffCanAccessMarket
// (own market for Supervisor/Overlooking, in-zone for a Regional
// Manager, everyone for Admin), staff via authorizedStaffContactsFor.
// This is what makes "pick a person, not a market" possible on the
// frontend — the candidate pool is already correctly scoped server-side,
// no client-side filtering of an unscoped list.
export async function listGroupMemberCandidates(req, res, next) {
  try {
    if (req.user.kind !== "staff" || !GROUP_CREATOR_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: "This action requires a Supervisor, Regional Manager, or Admin account" });
    }
    const search = (req.query.search ?? "").trim();
    const nameFilter = search ? { name: { contains: search, mode: "insensitive" } } : {};

    let employeeWhere;
    if (req.user.role === "ADMIN") {
      employeeWhere = { ...nameFilter };
    } else if (req.user.role === "REGIONAL_MANAGER") {
      employeeWhere = { ...nameFilter, market: { zoneId: { in: req.user.zoneIds ?? [] } } };
    } else {
      employeeWhere = { ...nameFilter, marketId: req.user.marketId };
    }

    const [employees, staffContacts] = await Promise.all([
      prisma.employee.findMany({ where: employeeWhere, select: { id: true, name: true, position: true, marketId: true }, orderBy: { name: "asc" }, take: 50 }),
      authorizedStaffContactsFor(req.user),
    ]);

    const staff = search
      ? staffContacts.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
      : staffContacts;

    res.json({ employees, staff });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/conversations/:id/members/:memberId — spec §7: remove a
// member. `:memberId` is the ConversationMember row's own id (not an
// employeeId/userId) so the same route works uniformly for either kind of
// member. Admin-only.
export async function removeGroupMember(req, res, next) {
  try {
    const conversation = await requireGroupAdmin(req, res);
    if (!conversation) return;

    await prisma.conversationMember.deleteMany({
      where: { id: req.params.memberId, conversationId: conversation.id },
    });

    res.json(await shapeGroupMembers(conversation.id));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/conversations/:id/members/:memberId — spec §1/§13: promote a
// member to Group Admin, or remove their admin privileges. Body:
// { isAdmin: boolean }. Admin-only (an admin can demote themselves, same
// as any other member — the group just needs at least one admin left in
// practice, though nothing here enforces that as a hard floor, matching
// how this app doesn't hard-block a Supervisor from having zero direct
// reports either).
export async function setGroupMemberAdmin(req, res, next) {
  try {
    const conversation = await requireGroupAdmin(req, res);
    if (!conversation) return;

    const member = await prisma.conversationMember.findFirst({
      where: { id: req.params.memberId, conversationId: conversation.id },
    });
    if (!member) return res.status(404).json({ error: "Member not found in this group" });

    await prisma.conversationMember.update({ where: { id: member.id }, data: { isAdmin: req.body.isAdmin } });
    res.json(await shapeGroupMembers(conversation.id));
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
    if (conversation.type === "ZONE_ANNOUNCEMENTS") {
      return res.status(403).json({ error: "Post a zone announcement instead of a direct message here" });
    }
    // Phase 3 §7-8: a WARNING-type CUSTOM_GROUP is a restricted
    // announcement group — only group admins may post, everyone else is
    // read-only. Reuses the existing group-admin concept (isGroupAdmin)
    // rather than a new role/permission system, the conservative default
    // for an ambiguous posting policy.
    if (conversation.type === "CUSTOM_GROUP" && conversation.groupType === "WARNING") {
      if (!(await isGroupAdmin(conversation.id, req.user))) {
        return res.status(403).json({ error: "Only a group admin can post in this announcement group" });
      }
    }

    const isStaff = req.user.kind === "staff";

    // RM_DIRECT lock (spec §14): the employee can't reply until the
    // Regional Manager has sent the first message. The RM side is never
    // blocked — sending is exactly what unlocks it, below.
    if (conversation.type === "RM_DIRECT" && !isStaff && conversation.locked) {
      return res.status(403).json({ error: "This conversation is locked until the Regional Manager sends the first message" });
    }

    let { body, imageUrl, attachmentType, attachmentUrl, attachmentName, attachmentSize, attachmentDurationSec, replyToId, forwardMessageId, mentions } = req.body;

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

    // Forwarding (spec §5): the SOURCE message can be in any conversation
    // the caller has access to — never trusted blindly, re-checked via
    // conversationAccessFor exactly like every other cross-conversation
    // reference in this file, so a user can't forward content from a
    // conversation they don't belong to just by guessing a message id.
    // Only the body/attachment are copied — reactions, replies, and edit
    // history are NOT carried over, and forwardedFromSenderName is a
    // snapshot label, not a live link back (see its own schema comment).
    let forwardedFromSenderName = null;
    if (forwardMessageId) {
      const source = await prisma.message.findUnique({
        where: { id: forwardMessageId },
        include: { senderEmployee: { select: { name: true } }, senderUser: { select: { name: true } } },
      });
      if (!source || source.deletedAt) {
        return res.status(404).json({ error: "The message to forward could not be found" });
      }
      const sourceConversation = await conversationAccessFor(req.user, source.conversationId);
      if (!sourceConversation) {
        return res.status(403).json({ error: "You do not have access to the message you're trying to forward" });
      }
      body = source.body;
      imageUrl = source.imageUrl;
      attachmentType = source.attachmentType;
      attachmentUrl = source.attachmentUrl;
      attachmentName = source.attachmentName;
      attachmentSize = source.attachmentSize;
      attachmentDurationSec = source.attachmentDurationSec;
      replyToId = null; // a forward starts fresh, it doesn't inherit the source's reply context
      forwardedFromSenderName = source.senderEmployee?.name || source.senderUser?.name || "Unknown";
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
        forwardedFromSenderName,
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

    // Mentions (§14-15) — never derived from raw "@text"; only the
    // structured ids the composer sent, and only the ones that actually
    // pass membership validation.
    await createMentionsAndNotify(message, conversation, mentions, senderName ?? "Someone");

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
    } else if (conversation.type === "CUSTOM_GROUP") {
      const members = await prisma.conversationMember.findMany({
        where: { conversationId: conversation.id },
        select: { employeeId: true, userId: true },
      });
      const recipientEmployeeIds = members
        .map((m) => m.employeeId)
        .filter((id) => id && (isStaff || id !== req.user.employeeId));
      const recipientUserIds = members
        .map((m) => m.userId)
        .filter((id) => id && (!isStaff || id !== req.user.userId));
      const groupNotification = {
        type: "CHAT_MESSAGE",
        title: `New message in ${conversation.name ?? "Group"}`,
        body: notificationPreview,
        linkType: "CONVERSATION",
        linkId: conversation.id,
      };
      await Promise.all([
        notifyEmployeesUnlessMuted(recipientEmployeeIds, groupNotification),
        // Staff members have no mute concept yet (ConversationRead is
        // employee-only) — same as SUPERVISOR_DIRECT/RM_DIRECT above.
        ...recipientUserIds.map((userId) => createNotificationForUser({ userId, ...groupNotification })),
      ]);
    } else if (conversation.type === "STAFF_DIRECT") {
      // Both sides are always staff here — the recipient is whichever
      // participant slot ISN'T the sender. No mute concept for staff
      // (same limitation as SUPERVISOR_DIRECT/RM_DIRECT above).
      const recipientUserId = conversation.staffParticipantId === req.user.userId ? conversation.staffParticipantBId : conversation.staffParticipantId;
      await createNotificationForUser({
        userId: recipientUserId,
        type: "CHAT_MESSAGE",
        title: `New message from ${senderName}`,
        body: notificationPreview,
        linkType: "CONVERSATION",
        linkId: conversation.id,
      });
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

    const withMentions = mentions?.length
      ? await prisma.message.findUnique({ where: { id: message.id }, include: MESSAGE_INCLUDE })
      : message;
    res.status(201).json(withMentions);
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

    // Mentions are replaced wholesale on edit — same "re-validate against
    // real membership, never trust the request" rule as sendMessage. The
    // previous mention set is captured first so re-saving an unchanged
    // mention doesn't re-notify the same person (see
    // createMentionsAndNotify's own comment).
    const previousMentions = await prisma.messageMention.findMany({
      where: { messageId: message.id },
      select: { employeeId: true, userId: true },
    });
    const previousKeys = new Set(previousMentions.map((m) => (m.employeeId ? `e:${m.employeeId}` : `u:${m.userId}`)));
    await prisma.messageMention.deleteMany({ where: { messageId: message.id } });
    const senderName = req.user.kind === "staff" ? updated.senderUser?.name : updated.senderEmployee?.name;
    await createMentionsAndNotify(updated, conversation, req.body.mentions, senderName ?? "Someone", previousKeys);

    const withMentions = req.body.mentions?.length
      ? await prisma.message.findUnique({ where: { id: updated.id }, include: MESSAGE_INCLUDE })
      : { ...updated, mentions: [] };
    res.json(shapeMessage(withMentions));
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

    const { emoji, recognition } = req.body;
    const isStaff = req.user.kind === "staff";

    // Management Recognition (§13) — backend-decided, never client-
    // asserted: authorized management role, reacting to an Employee's
    // message. A Worker/Cashier (or staff reacting to another staff
    // member's message) requesting recognition is rejected outright
    // rather than silently downgraded — the frontend should never have
    // offered the option in the first place, so this is a hard stop, not
    // a soft fallback.
    const MANAGEMENT_ROLES = new Set(["SUPERVISOR", "OVERLOOKING_SUPERVISOR", "REGIONAL_MANAGER", "ADMIN"]);
    if (recognition) {
      const authorized = isStaff && MANAGEMENT_ROLES.has(req.user.role) && !!message.senderEmployeeId;
      if (!authorized) {
        return res.status(403).json({ error: "Only authorized management can send a Management Recognition reaction" });
      }
    }

    const mine = await prisma.messageReaction.findFirst({
      where: isStaff ? { messageId: message.id, userId: req.user.userId } : { messageId: message.id, employeeId: req.user.employeeId },
    });

    if (mine && mine.emoji === emoji) {
      await prisma.messageReaction.delete({ where: { id: mine.id } });
    } else if (mine) {
      await prisma.messageReaction.update({ where: { id: mine.id }, data: { emoji, isRecognition: !!recognition } });
    } else {
      await prisma.messageReaction.create({
        data: {
          messageId: message.id,
          emoji,
          employeeId: isStaff ? null : req.user.employeeId,
          userId: isStaff ? req.user.userId : null,
          isRecognition: !!recognition,
        },
      });
      if (recognition) {
        await createNotification({
          employeeId: message.senderEmployeeId,
          type: "MANAGEMENT_RECOGNITION",
          title: `Recognized by ${req.user.role === "REGIONAL_MANAGER" ? "Regional Manager" : req.user.role === "ADMIN" ? "Admin" : "your Supervisor"}`,
          body: "Your work was recognized in chat.",
          linkType: "CONVERSATION",
          linkId: conversation.id,
        });
      }
    }

    const reactions = await prisma.messageReaction.findMany({
      where: { messageId: message.id },
      select: {
        id: true,
        emoji: true,
        employeeId: true,
        userId: true,
        isRecognition: true,
        employee: { select: { name: true } },
        user: { select: { name: true, role: true } },
      },
    });
    res.json({ reactions });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/read — Phase 3: read-state now persists for
// staff too (Supervisor/Overlooking/Regional Manager/Admin), via the same
// ConversationRead row's staffUserId column, mirroring the employee path
// exactly rather than a second table.
export async function markConversationRead(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const read =
      req.user.kind === "employee"
        ? await prisma.conversationRead.upsert({
            where: { conversationId_employeeId: { conversationId: conversation.id, employeeId: req.user.employeeId } },
            update: { lastReadAt: new Date() },
            create: { conversationId: conversation.id, employeeId: req.user.employeeId },
          })
        : await prisma.conversationRead.upsert({
            where: { conversationId_staffUserId: { conversationId: conversation.id, staffUserId: req.user.userId } },
            update: { lastReadAt: new Date() },
            create: { conversationId: conversation.id, staffUserId: req.user.userId },
          });

    res.json(read);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/:id/media — Repair Pass follow-up: Group
// Information's real Media/Voice/Files browser, backed directly by real
// Message rows (never a separate media table — imageUrl/attachmentUrl
// are already the single source of truth for what a message attached).
// Only the three kinds this schema actually supports are ever returned —
// MessageAttachmentType is FILE/AUDIO/VOICE only (see its own schema
// comment), there is no video attachment type in this app, so a
// "Videos" category is deliberately never fabricated here.
export async function listConversationMedia(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        deletedAt: null,
        OR: [{ imageUrl: { not: null } }, { attachmentUrl: { not: null } }],
      },
      select: {
        id: true,
        imageUrl: true,
        attachmentType: true,
        attachmentUrl: true,
        attachmentName: true,
        attachmentSize: true,
        attachmentDurationSec: true,
        createdAt: true,
        senderEmployee: { select: { id: true, name: true } },
        senderUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    const media = { images: [], voice: [], files: [] };
    for (const m of messages) {
      const senderName = m.senderEmployee?.name ?? m.senderUser?.name ?? "Unknown";
      if (m.imageUrl) {
        media.images.push({ messageId: m.id, url: m.imageUrl, senderName, createdAt: m.createdAt });
      } else if (m.attachmentType === "AUDIO" || m.attachmentType === "VOICE") {
        media.voice.push({
          messageId: m.id, url: m.attachmentUrl, durationSec: m.attachmentDurationSec, senderName, createdAt: m.createdAt,
        });
      } else if (m.attachmentType === "FILE") {
        media.files.push({
          messageId: m.id, url: m.attachmentUrl, name: m.attachmentName, size: m.attachmentSize, senderName, createdAt: m.createdAt,
        });
      }
    }

    res.json(media);
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/:id/messages/:messageId/seen-by — real per-
// message read receipts (spec: "Verify group messages support an actual
// per-message Seen by reader list, not just conversation-level read
// state"). Deliberately NOT a new per-(message,reader) table written on
// every read (that would be a real-write storm for a 100+-member zone
// group on every single message) — instead derived at read time from the
// SAME ConversationRead row markConversationRead already
// upserts-once-per-open, same efficiency reasoning already documented on
// that model: "avoid unnecessary database writes" for large groups.
// Whoever's lastReadAt is at or after this message's createdAt has, by
// definition, seen it (and everything before it) — real data, computed
// fresh, never a stored per-message flag to keep in sync. Access is the
// same conversationAccessFor check as reading the messages themselves —
// no additional restriction (seeing who else in a group you already
// belong to has read a message isn't sensitive beyond that).
export async function getMessageSeenBy(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!message || message.conversationId !== conversation.id) {
      return res.status(404).json({ error: "Message not found in this conversation" });
    }

    const reads = await prisma.conversationRead.findMany({
      where: { conversationId: conversation.id, lastReadAt: { gte: message.createdAt } },
      include: {
        employee: { select: { id: true, name: true } },
        staffUser: { select: { id: true, name: true } },
      },
      orderBy: { lastReadAt: "desc" },
    });

    // Never list the sender as one of their own message's readers.
    const readers = reads
      .filter((r) => !(r.employeeId && r.employeeId === message.senderEmployeeId) && !(r.staffUserId && r.staffUserId === message.senderUserId))
      .map((r) => ({
        kind: r.employeeId ? "employee" : "staff",
        id: r.employeeId ?? r.staffUserId,
        name: r.employee?.name ?? r.staffUser?.name ?? "Unknown",
        readAt: r.lastReadAt,
      }));

    res.json({ count: readers.length, readers });
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

// GET /api/conversations/organized — Phase 3 §1-5: the single aggregator
// behind the Chat page's four views (Important People / Groups /
// Individuals / Unread). Not a separate data source — every bucket is
// computed from the exact same shaped conversation list the caller's
// existing inbox endpoint already returns (buildEmployeeConversationList /
// buildStaffConversationList / buildRmConversationList), so a
// conversation legitimately appears in more than one bucket and nothing
// here can drift from what listMyConversations/listMyStaffConversations/
// listMyRegionalManagerConversations already show. Employees have no
// Important People (ImportantContact.ownerUserId is always a staff
// account, per the spec's own framing — this is a Supervisor/Regional
// Manager/Admin feature).
const GROUP_TYPES = new Set(["MARKET_GROUP", "WARNINGS", "ZONE_GROUP", "ZONE_ANNOUNCEMENTS", "CUSTOM_GROUP"]);
const INDIVIDUAL_TYPES = new Set(["DIRECT", "SUPERVISOR_DIRECT", "RM_DIRECT", "STAFF_DIRECT"]);

export async function organizedConversations(req, res, next) {
  try {
    let conversations;
    let importantPeople = [];

    if (req.user.kind === "employee") {
      conversations = await buildEmployeeConversationList(req);
    } else if (req.user.role === "REGIONAL_MANAGER") {
      conversations = await buildRmConversationList(req);
    } else if (req.user.role === "SUPERVISOR" || req.user.role === "OVERLOOKING_SUPERVISOR") {
      conversations = await buildStaffConversationList(req);
    } else {
      // ADMIN (Phase 3.5 — Admin Chat screen): same "views over the same
      // list" reuse as every other role.
      conversations = req.user.role === "ADMIN" ? await buildAdminConversationList(req) : [];
    }

    if (req.user.kind === "staff") {
      const contacts = await prisma.importantContact.findMany({
        where: { ownerUserId: req.user.userId },
        include: {
          contactUser: { select: { id: true, name: true, role: true } },
          contactEmployee: { select: { id: true, name: true, position: true } },
        },
        orderBy: { priority: "desc" },
      });
      const conversationByStaffId = new Map(conversations.filter((c) => c.staffUserId).map((c) => [c.staffUserId, c]));
      const conversationByEmployeeId = new Map(conversations.filter((c) => c.employeeId).map((c) => [c.employeeId, c]));
      importantPeople = await Promise.all(
        contacts.map(async (contact) => {
          const matched = contact.contactUserId
            ? conversationByStaffId.get(contact.contactUserId)
            : conversationByEmployeeId.get(contact.contactEmployeeId);
          return {
            id: contact.id,
            priority: contact.priority,
            contactUserId: contact.contactUserId,
            contactEmployeeId: contact.contactEmployeeId,
            name: contact.contactUser?.name ?? contact.contactEmployee?.name,
            role: contact.contactUser?.role ?? null,
            position: contact.contactEmployee?.position ?? null,
            conversation: matched ?? null,
          };
        })
      );
    }

    res.json({
      importantPeople,
      groups: conversations.filter((c) => GROUP_TYPES.has(c.type)),
      individuals: conversations.filter((c) => INDIVIDUAL_TYPES.has(c.type)),
      unread: conversations.filter((c) => c.unreadCount > 0),
    });
  } catch (err) {
    next(err);
  }
}
