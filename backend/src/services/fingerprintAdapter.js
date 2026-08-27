import { prisma } from "../lib/prisma.js";
import * as breakService from "./breakService.js";
import { createNotification } from "../utils/notifications.js";

// fingerprintAdapter.js — THE integration boundary for the physical
// fingerprint machine / company system. Read this whole comment before
// touching anything here.
//
// WHAT THIS IS NOT: a connection to real hardware. We do not currently
// have verified API/protocol/auth details for the actual fingerprint
// provider, so nothing here talks to a device, polls anything, or opens
// a socket. There is no fake "FingerprintDeviceClient" pretending to be
// real hardware anywhere in this codebase.
//
// WHAT THIS IS: the shape a real integration will plug into once those
// details exist. `ingestFingerprintEvent(payload)` is the one function
// a future real adapter (webhook handler, polling job, message-queue
// consumer — whichever the real system turns out to need) should call
// with a normalized event. Everything downstream of that call (creating
// a FingerprintEvent row, turning a BREAK_START event into a Break via
// the exact same breakService.createPendingBreak used by the ADMIN
// manual-test endpoint, notifying the employee) is already real and
// already wired to the rest of the app.
//
// For Phase 1, the only caller of this function is a controlled,
// ADMIN-only HTTP endpoint (POST /api/fingerprint-events — see
// fingerprintController.js and fingerprint.routes.js) standing in for
// "a real event arrived" during development/testing — never presented
// as a live hardware connection.
//
// Event contract (see utils/validate.js's fingerprintEventSchema for the
// enforced shape):
//   externalEventId — idempotency key from the external system; the
//                      same physical scan must never be processed twice
//   employeeCode     — which employee this event is about (their real,
//                      existing "User ID" — the same code they log in
//                      with — not an internal database id, since the
//                      external system has no reason to know that)
//   eventType        — currently only "BREAK_START" (see
//                      FingerprintEventType's own schema comment for
//                      why nothing broader is defined yet)
//   eventTimestamp   — when the physical event actually happened
//   sourceDeviceId   — optional, which device/reader reported it
//
// When the real provider's exact API/auth/webhook details are known,
// what changes: (1) a new transport-layer piece (webhook route, or a
// polling job) that receives/fetches real events and calls this same
// function — this file's own logic does NOT need to change; (2) the
// employeeCode -> Employee resolution below may need to change if the
// real system identifies people differently (a device-local badge id,
// for instance) — that mapping decision is explicitly deferred until
// real details exist, not guessed at here.
export async function ingestFingerprintEvent({ externalEventId, employeeCode, eventType, eventTimestamp, sourceDeviceId }) {
  // Idempotent on externalEventId — a retried/duplicated delivery from
  // the external system (common for webhooks) must never create a
  // second break for the same physical scan.
  const existing = await prisma.fingerprintEvent.findUnique({ where: { externalEventId } });
  if (existing) return existing;

  const employee = await prisma.employee.findFirst({
    where: { employeeCode: { equals: employeeCode, mode: "insensitive" } },
  });
  if (!employee) {
    const err = new Error(`No employee found for employeeCode "${employeeCode}"`);
    err.status = 400;
    throw err;
  }

  const event = await prisma.fingerprintEvent.create({
    data: {
      externalEventId,
      eventType,
      eventTimestamp,
      sourceDeviceId,
      rawPayload: { externalEventId, employeeCode, eventType, eventTimestamp, sourceDeviceId },
      employeeId: employee.id,
    },
  });

  if (eventType === "BREAK_START") {
    const brk = await breakService.createPendingBreak({
      employeeId: employee.id,
      marketId: employee.marketId,
      fingerprintEventId: event.id,
    });
    await createNotification({
      employeeId: employee.id,
      type: "BREAK_PENDING_CONFIRMATION",
      title: "Did you take a break?",
      body: "Confirm to start your 60-minute break.",
      linkType: "BREAK",
      linkId: brk.id,
    });
  }

  return prisma.fingerprintEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
}
