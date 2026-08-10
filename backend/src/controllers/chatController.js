import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";
import { createNotification, createNotificationForMarket } from "../utils/notifications.js";

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

// Returns the conversation if `req.user` (an employee) may access it,
// otherwise null. Shared by every route below that takes a :id.
async function conversationForEmployee(conversationId, employeeId) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return null;
  if (conversation.type === "DIRECT") {
    const isParticipant = conversation.participantAId === employeeId || conversation.participantBId === employeeId;
    return isParticipant ? conversation : null;
  }
  // MARKET_GROUP / WARNINGS — any employee of that market can read.
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { marketId: true } });
  return employee?.marketId === conversation.marketId ? conversation : null;
}

function lastReadOrEpoch(read) {
  return read?.lastReadAt ?? new Date(0);
}

// GET /api/conversations — employee-only: Market Group + Warnings +
// every Direct conversation they're in, each with a last-message preview
// and unread count.
export async function listMyConversations(req, res, next) {
  try {
    const employeeId = req.user.employeeId;
    const marketId = req.user.marketId;

    const [marketGroup, warnings, directs] = await Promise.all([
      findOrCreateChannel(marketId, "MARKET_GROUP"),
      findOrCreateChannel(marketId, "WARNINGS"),
      prisma.conversation.findMany({
        where: { type: "DIRECT", OR: [{ participantAId: employeeId }, { participantBId: employeeId }] },
      }),
    ]);

    const conversations = [marketGroup, warnings, ...directs];

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

    const shaped = conversations.map((c, i) => ({
      id: c.id,
      type: c.type,
      title:
        c.type === "MARKET_GROUP" ? "Market Group" :
        c.type === "WARNINGS" ? "Warnings" :
        nameById.get(c.participantAId === employeeId ? c.participantBId : c.participantAId) ?? "Employee",
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

// GET /api/conversations/:id/messages?after= — ?after is an ISO
// timestamp; only messages strictly newer are returned, so a poll loop
// only ever pulls the delta instead of the whole history each time.
export async function listMessages(req, res, next) {
  try {
    const conversation = await conversationForEmployee(req.params.id, req.user.employeeId);
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

// POST /api/conversations/:id/messages — employee-only. Blocked on
// Warnings: employees can read but never post there (see
// postWarningBroadcast for the staff-only equivalent).
export async function sendMessage(req, res, next) {
  try {
    const conversation = await conversationForEmployee(req.params.id, req.user.employeeId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.type === "WARNINGS") {
      return res.status(403).json({ error: "Only a supervisor can post to Warnings" });
    }

    const { body, imageUrl } = req.body;
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, body, imageUrl, senderEmployeeId: req.user.employeeId },
    });

    // Notify every other participant.
    let recipientIds = [];
    if (conversation.type === "DIRECT") {
      recipientIds = [conversation.participantAId, conversation.participantBId].filter(
        (id) => id !== req.user.employeeId
      );
    } else {
      const others = await prisma.employee.findMany({
        where: { marketId: conversation.marketId, id: { not: req.user.employeeId } },
        select: { id: true },
      });
      recipientIds = others.map((e) => e.id);
    }
    const sender = await prisma.employee.findUnique({ where: { id: req.user.employeeId }, select: { name: true } });
    await Promise.all(
      recipientIds.map((id) =>
        createNotification({
          employeeId: id,
          type: "CHAT_MESSAGE",
          title: conversation.type === "MARKET_GROUP" ? "New message in Market Group" : `New message from ${sender.name}`,
          body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
          linkType: "CONVERSATION",
          linkId: conversation.id,
        })
      )
    );

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/read
export async function markConversationRead(req, res, next) {
  try {
    const conversation = await conversationForEmployee(req.params.id, req.user.employeeId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

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
