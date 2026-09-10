import { prisma } from "../lib/prisma.js";
import { findOrCreateChannel } from "./chatController.js";

// kochOperationsController.js — Koch Operation (spec: addition-only
// feature). One endpoint, two submission shapes, decided from the
// AUTHENTICATED employee's real EmployeeRole — never from anything the
// client claims (see schema.prisma's own comment on KochOperation for
// why Worker/Cashier share one table).

function nowTimeLabel(now) {
  return now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const OPERATION_TYPE_LABEL = {
  CUSTOMIZATION: "Customization",
  DISCOUNT_CUSTOMIZATION: "Discount Customization",
};

// Builds the same structured text every real submission posts into the
// market's own KOCH_OPERATION conversation — same "controller creates a
// Message directly" pattern marketManagementController.sendDepartmentReport
// already uses for MARKET_GROUP. Plain, unlocalized English, matching
// that existing precedent for auto-generated system chat messages (chat
// message bodies are never translated server-side anywhere in this app).
function buildMessageBody({ isCashier, employeeName, marketName, operationType, products, dateLabel, time }) {
  if (isCashier) {
    return [
      "Koch Operation",
      "",
      `Cashier: ${employeeName}`,
      `Market: ${marketName}`,
      "",
      "Products:",
      ...products.map((p) => {
        const variant = p.kochProduct.variant ? ` ${p.kochProduct.variant}` : "";
        const size = p.kochProduct.size ? ` — ${p.kochProduct.size}` : "";
        const qty = p.quantity > 1 ? ` × ${p.quantity}` : "";
        return `- ${p.kochProduct.name}${variant}${size}${qty}`;
      }),
      "",
      `Date: ${dateLabel}`,
      `Time: ${time}`,
    ].join("\n");
  }
  return [
    "Koch Operation",
    "",
    `Worker: ${employeeName}`,
    `Market: ${marketName}`,
    `Operation: ${OPERATION_TYPE_LABEL[operationType]}`,
    `Date: ${dateLabel}`,
    `Time: ${time}`,
  ].join("\n");
}

// GET /api/koch-products — any authenticated employee (Cashier's own
// selection screen is the only real caller today, but this mirrors
// every other read-only catalog endpoint in the app — no role gate on a
// plain list). Active only: an inactive product stays referenced by past
// KochOperationProduct rows (never deleted), it just stops being
// offered for a NEW submission.
export async function listKochProducts(req, res, next) {
  try {
    const products = await prisma.kochProduct.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
}

// GET /api/koch-operations — the current employee's own submissions
// only (Worker or Cashier) — same "own records only" scope as
// listPriceReports/listMyWastedOverallReports.
export async function listMyKochOperations(req, res, next) {
  try {
    const operations = await prisma.kochOperation.findMany({
      where: { employeeId: req.user.employeeId },
      include: { products: { include: { kochProduct: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(operations);
  } catch (err) {
    next(err);
  }
}

// POST /api/koch-operations — employee-only (requireEmployeeAuth on the
// route). Identity/market/department are ALWAYS read fresh from the
// employee's own DB row via req.user.employeeId (from the verified JWT),
// never from the request body — an employee cannot submit as someone
// else or into another market's group by any request shape.
export async function createKochOperation(req, res, next) {
  try {
    const { operationType, evidenceUrl, products } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employeeId },
      select: { id: true, name: true, role: true, marketId: true, department: true },
    });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const isCashier = employee.role === "CASHIER";

    if (isCashier) {
      if (!products || products.length === 0) {
        return res.status(400).json({ error: "Select at least one product." });
      }
      const ids = [...new Set(products.map((p) => p.kochProductId))];
      const existingCount = await prisma.kochProduct.count({ where: { id: { in: ids } } });
      if (existingCount !== ids.length) {
        return res.status(400).json({ error: "One or more selected products are no longer available." });
      }
    } else if (!operationType) {
      return res.status(400).json({ error: "Select an operation type." });
    }

    const now = new Date();
    const time = nowTimeLabel(now);

    const operation = await prisma.kochOperation.create({
      data: {
        operationType: isCashier ? null : operationType,
        evidenceUrl,
        employeeId: employee.id,
        marketId: employee.marketId,
        department: employee.department,
        date: now,
        time,
        ...(isCashier
          ? { products: { create: products.map((p) => ({ kochProductId: p.kochProductId, quantity: p.quantity ?? 1 })) } }
          : {}),
      },
      include: { products: { include: { kochProduct: true } } },
    });

    // Auto-post into this market's own Koch Operation group — the
    // employee never opens Chat themselves (spec's own rule).
    const market = await prisma.market.findUnique({ where: { id: employee.marketId }, select: { name: true } });
    const conversation = await findOrCreateChannel(employee.marketId, "KOCH_OPERATION");
    const dateLabel = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const body = buildMessageBody({
      isCashier,
      employeeName: employee.name,
      marketName: market?.name ?? "",
      operationType,
      products: operation.products,
      dateLabel,
      time,
    });

    const message = await prisma.message.create({
      data: { conversationId: conversation.id, body, imageUrl: evidenceUrl, senderEmployeeId: employee.id },
    });

    const finalOperation = await prisma.kochOperation.update({
      where: { id: operation.id },
      data: { conversationId: conversation.id, messageId: message.id },
      include: { products: { include: { kochProduct: true } } },
    });

    res.status(201).json(finalOperation);
  } catch (err) {
    next(err);
  }
}
