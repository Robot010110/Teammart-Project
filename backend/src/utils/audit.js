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

export function recordAudit({ actorUserId, action, targetType, targetId, marketId, zoneId, reason, previousValue, newValue, metadata }) {
  return prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      targetType,
      targetId: targetId ?? null,
      marketId: marketId ?? null,
      zoneId: zoneId ?? null,
      reason: reason ?? null,
      previousValue: sanitize(previousValue) ?? undefined,
      newValue: sanitize(newValue) ?? undefined,
      metadata: sanitize(metadata) ?? undefined,
    },
  });
}
