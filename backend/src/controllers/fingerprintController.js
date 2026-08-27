import { ingestFingerprintEvent } from "../services/fingerprintAdapter.js";

// POST /api/fingerprint-events — ADMIN-only. The controlled internal
// test entrypoint into services/fingerprintAdapter.js — see that file's
// own comment for exactly what this is (a boundary) and is not (a real
// hardware connection). Not intended as the real production ingress
// once actual hardware/provider details exist; that will most likely be
// a webhook route or a polling job instead, both calling the same
// ingestFingerprintEvent() this does.
export async function receiveFingerprintEvent(req, res, next) {
  try {
    const event = await ingestFingerprintEvent(req.body);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}
