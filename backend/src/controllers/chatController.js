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
    if (conversation.type === "SUPERVISOR_DIRECT") {
      return conversation.participantAId === user.employeeId ? conversation : null;
    }
    // MARKET_GROUP / WARNINGS — any employee of that market can read.
    return user.marketId === conversation.marketId ? conversation : null;
  }

  if (user.kind === "staff") {
    if (conversation.type === "SUPERVISOR_DIRECT") {
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

    const [marketGroup, warnings, supervisorConvo, directs] = await Promise.all([
      findOrCreateChannel(marketId, "MARKET_GROUP"),
      findOrCreateChannel(marketId, "WARNINGS"),
      findOrCreateSupervisorConversation(marketId, employeeId),
      prisma.conversation.findMany({
        where: { type: "DIRECT", OR: [{ participantAId: employeeId }, { participantBId: employeeId }] },
      }),
    ]);

    const conversations = [marketGroup, warnings, ...(supervisorConvo ? [supervisorConvo] : []), ...directs];

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

    const shaped = conversations.map((c, i) => ({
      id: c.id,
      type: c.type,
      title:
        c.type === "MARKET_GROUP" ? "Market Group" :
        c.type === "WARNINGS" ? "Warnings" :
        c.type === "SUPERVISOR_DIRECT" ? (supervisorName ?? "Supervisor") :
        nameById.get(c.participantAId === employeeId ? c.participantBId : c.participantAId) ?? "Employee",
      otherEmployeeId: c.type === "DIRECT" ? (c.participantAId === employeeId ? c.participantBId : c.participantAId) : null,
      lastMessage: lastMessages[i] ? { body: lastMessages[i].body, createdAt: lastMessages[i].createdAt } : null,
      unreadCount: unreadCounts[i],
    }));

    res.json(shaped);
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

// GET /api/conversations/:id/messages?after= — ?after is an ISO
// timestamp; only messages strictly newer are returned, so a poll loop
// only ever pulls the delta instead of the whole history each time.
// Works for both an Employee and a staff (Supervisor) token — see
// conversationAccessFor.
export async function listMessages(req, res, next) {
  try {
    const conversation = await conversationAccessFor(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const { after } = req.query;
    const where = { conversationId: conversation.id };
    if (after) where.createdAt = { gt: new Date(after) };

    const messages = await prisma.message.findMany({
      where,
      include: {
        senderEmployee: { select: { id: true, name: true } },
        senderUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    res.json(messages);
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
    const { body, imageUrl, attachmentType, attachmentUrl, attachmentName, attachmentSize, attachmentDurationSec } = req.body;
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
        senderEmployeeId: isStaff ? null : req.user.employeeId,
        senderUserId: isStaff ? req.user.userId : null,
      },
      include: {
        senderEmployee: { select: { id: true, name: true } },
        senderUser: { select: { id: true, name: true } },
      },
    });

    const ATTACHMENT_LABEL = { FILE: "Sent a file", AUDIO: "Sent an audio clip", VOICE: "Sent a voice message" };
    const notificationPreview = body.trim()
      ? (body.length > 120 ? `${body.slice(0, 117)}...` : body)
      : imageUrl
      ? "Sent a photo"
      : ATTACHMENT_LABEL[attachmentType] ?? "Sent a message";

    const senderName = isStaff ? message.senderUser?.name : message.senderEmployee?.name;

    // Notify every other participant — employee recipients via
    // createNotification, staff recipients (SUPERVISOR_DIRECT sent by an
    // employee) via createNotificationForUser.
    if (conversation.type === "DIRECT") {
      const recipientIds = [conversation.participantAId, conversation.participantBId].filter((id) => id !== req.user.employeeId);
      await Promise.all(
        recipientIds.map((id) =>
          createNotification({
            employeeId: id,
            type: "CHAT_MESSAGE",
            title: `New message from ${senderName}`,
            body: notificationPreview,
            linkType: "CONVERSATION",
            linkId: conversation.id,
          })
        )
      );
    } else if (conversation.type === "SUPERVISOR_DIRECT") {
      if (isStaff) {
        await createNotification({
          employeeId: conversation.participantAId,
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
      await Promise.all(
        others.map((e) =>
          createNotification({
            employeeId: e.id,
            type: "CHAT_MESSAGE",
            title: "New message in Market Group",
            body: notificationPreview,
            linkType: "CONVERSATION",
            linkId: conversation.id,
          })
        )
      );
    }

    res.status(201).json(message);
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
