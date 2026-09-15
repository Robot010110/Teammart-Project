import { prisma } from "../lib/prisma.js";

// audit.js — Admin Phase 3 §9-13: the ONE place an AuditLog row is ever
// written, so every sensitive administrative action (Phase 2's role/
// account mutations, Phase 3's Visit/Inspection lifecycle) goes through
// the same shape instead of each controller hand-rolling
// `prisma.auditLog.create`. Append-only by convention — nothing in this
// file, or anywhere else in the app, ever updates or deletes a row here.
//
// Never pass anything password/hash/token-shaped as previousValue/
// newValue/metadata — this is a hard rule, not just a convention, since
// audit rows are meant to be broadly readable by any Admin (spec §10).
const FORBIDDEN_KEYS = /password|passwordhash|token|secret|jwt/i;

function sanitize(value) {
  if (value == null || typeof value !== "object") return value;
  const clean = {};
  for (const [key, val] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    clean[key] = val;
  }
  return clean;
}

// `tx` — optional Prisma transaction client (from `prisma.$transaction`).
// Defaults to the global `prisma` client, so every existing call site
// keeps working unchanged; pass `tx` only when the audit row must
// commit atomically alongside other writes in the same transaction
// (Admin Actions Verification — see updateEmployee/assignMarketSupervisor).
//
// `previousMarketId` — Admin Actions Verification: populated only for
// MARKET_ASSIGNMENT_CHANGED rows, promoting the same value already
// carried in previousValue.marketId into its own indexed column (see
// the schema's own comment on AuditLog.previousMarketId).
export function recordAudit({ actorUserId, action, targetType, targetId, marketId, previousMarketId, zoneId, reason, previousValue, newValue, metadata, tx }) {
  const client = tx ?? prisma;
  return client.auditLog.create({
    data: {
      actorUserId,
      action,
      targetType,
      targetId: targetId ?? null,
      marketId: marketId ?? null,
      previousMarketId: previousMarketId ?? null,
      zoneId: zoneId ?? null,
      reason: reason ?? null,
      previousValue: sanitize(previousValue) ?? undefined,
      newValue: sanitize(newValue) ?? undefined,
      metadata: sanitize(metadata) ?? undefined,
    },
  });
}
