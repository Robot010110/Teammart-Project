import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// fileStorage.js — the ONE place that knows how uploaded file bytes
// actually get persisted and turned into a URL. Everything else (the
// upload route, every controller that used to accept a base64 "url"
// field) only ever calls saveUploadedFile() and gets back a real,
// fully-qualified URL string — same contract a base64 data URL already
// satisfied, so no caller/schema change was needed to adopt this.
//
// Today's implementation writes to local disk under backend/uploads/.
// This directory is intentionally NOT served as public static content —
// files are private by default and only readable through the
// authenticated GET /api/uploads/:filename route (see
// controllers/uploadsController.js and utils/fileAuthorization.js), so
// the URL returned here points at THAT route, not a static file path.
// Storage keys are random UUIDs, not the client's original filename —
// never trust a client-provided filename for anything (path traversal,
// collisions, leaking another user's filename convention) — but a UUID
// alone is not the authorization mechanism; knowing this URL is not
// sufficient to read the file (see fileAuthorization.js).
//
// To move to an S3-compatible provider later (planned for the
// production/hosting phase — not part of this change), this is the only
// function that needs a new body: keep the same signature (buffer,
// mimetype, publicBaseUrl) -> { filename, url }, upload the buffer to
// the bucket instead of disk, and return a URL your GET /api/uploads
// route can still authorize before proxying/redirecting to (a bucket
// URL should stay private — signed/short-lived — rather than switching
// back to a publicly-readable one). Nothing outside this file needs to
// change to make that swap.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, "../../uploads");

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "application/pdf": "pdf",
};

export function extensionForMime(mimetype) {
  return EXTENSION_BY_MIME[mimetype] || "bin";
}

// Writes the buffer to backend/uploads/<uuid>.<ext> and returns a fully-
// qualified URL pointing at the authenticated GET /api/uploads/:filename
// route (not a static file path — see the file-level comment above).
// publicBaseUrl is passed in per-request (protocol + host, or
// PUBLIC_BASE_URL if set) so this stays deployable behind any domain
// without a code change.
export async function saveUploadedFile(buffer, mimetype, publicBaseUrl) {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `${randomUUID()}.${extensionForMime(mimetype)}`;
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return { filename, url: `${publicBaseUrl.replace(/\/$/, "")}/api/uploads/${filename}` };
}
