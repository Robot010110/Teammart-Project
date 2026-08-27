import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma.js";
import { saveUploadedFile, UPLOADS_DIR } from "../utils/fileStorage.js";
import { resolveFile, canAccessFile } from "../utils/fileAuthorization.js";

// A client can put anything it wants in the multipart Content-Type
// header for a part (upload.js's fileFilter only checks that claimed
// value). For the image types specifically, we can cheaply verify the
// actual bytes match a real image of that format via each format's
// magic-number signature — closing the "upload a script, claim it's a
// JPEG" gap without adding an image-parsing dependency. Non-image types
// here (audio, pdf) don't get this extra check: their signatures vary
// more across encoders, and — unlike an image — they are never rendered
// inline as executable-adjacent content, only played/downloaded.
const IMAGE_SIGNATURES = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  // WEBP: "RIFF" .... "WEBP" — bytes 8-11 checked separately below.
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

function matchesSignature(buffer, signature) {
  return signature.every((byte, i) => buffer[i] === byte);
}

function isValidImageSignature(buffer, mimetype) {
  const signatures = IMAGE_SIGNATURES[mimetype];
  if (!signatures) return true; // not an image type we know how to check
  if (!signatures.some((sig) => matchesSignature(buffer, sig))) return false;
  if (mimetype === "image/webp") {
    return buffer.slice(8, 12).toString("ascii") === "WEBP";
  }
  return true;
}

// POST /api/uploads — any authenticated user (staff or employee); every
// existing photo/attachment flow in the app is available to both kinds
// of account, so this mirrors that rather than restricting by role.
export async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!isValidImageSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ error: "File content does not match its declared type" });
    }

    const publicBaseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const { filename, url } = await saveUploadedFile(req.file.buffer, req.file.mimetype, publicBaseUrl);

    // Records who uploaded this, in case it's read back before it's been
    // attached to any business record yet — see fileAuthorization.js's
    // uploaderFallback and UploadedFile's own schema comment.
    await prisma.uploadedFile.create({
      data: {
        filename,
        mimetype: req.file.mimetype,
        uploaderEmployeeId: req.user.kind === "employee" ? req.user.employeeId : null,
        uploaderUserId: req.user.kind === "staff" ? req.user.userId : null,
      },
    });

    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
}

// Every filename this app ever generates is exactly `${randomUUID()}.${ext}`
// (see fileStorage.js) — this pattern is the ENTIRE input-validation step
// for the :filename route param. Anything that doesn't match (path
// separators, "..", or anything else) is rejected before it ever touches
// the filesystem or a query, which is what actually prevents path
// traversal here — not the later prisma/fs calls.
const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$/i;

// GET /api/uploads/:filename — the only way to read an uploaded file.
// Deliberately not a public express.static mount (see app.js and
// fileStorage.js's own comments): every request here is authenticated,
// then authorized against whatever business resource actually owns this
// file (fileAuthorization.js) — a valid Bearer token alone is not
// enough, and neither is knowing the filename.
export async function downloadFile(req, res, next) {
  try {
    const { filename } = req.params;
    if (!SAFE_FILENAME.test(filename)) {
      return res.status(400).json({ error: "Invalid file identifier" });
    }

    const { mimetype, owner } = await resolveFile(filename);
    // No UploadedFile row at all — this was never a real upload (or the
    // filename was guessed). A flat 404 here, before any authorization
    // check, doesn't leak whether a FILE exists vs. whether the caller
    // is allowed to see it — both look identical from outside.
    if (!mimetype) {
      return res.status(404).json({ error: "File not found" });
    }

    const allowed = await canAccessFile(req.user, owner);
    if (!allowed) {
      return res.status(403).json({ error: "You do not have access to this file" });
    }

    const absolutePath = path.join(UPLOADS_DIR, filename);
    let fileStat;
    try {
      fileStat = await stat(absolutePath);
    } catch {
      // A DB row exists but the physical file is missing (disk cleanup,
      // corrupted deploy, etc.) — a real, if unusual, 404, not a 500.
      return res.status(404).json({ error: "File not found" });
    }

    res.set({
      "Content-Type": mimetype,
      "Content-Length": fileStat.size,
      // Private: this response is authorization-gated per requester, so
      // a shared/proxy cache must never serve it to a different user.
      // Browser-local caching is still fine (same user, same check next
      // time) — same reasoning the old public mount's 1-year cache used,
      // just scoped down to "private" now that access isn't universal.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });

    createReadStream(absolutePath).pipe(res);
  } catch (err) {
    next(err);
  }
}
