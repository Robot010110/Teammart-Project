import multer from "multer";

// Every real upload flow in this app (activity evidence, item-report/
// waste photos, sudden-task evidence, chat images/attachments, voice
// notes, profile/group pictures) funnels through this one multer config
// instead of each route inventing its own limits — mirrors the existing
// attendance-import multer instance (routes/attendance.routes.js), same
// memoryStorage + explicit-limit convention.
//
// 15MB covers an uncompressed phone-camera photo or a several-minute
// voice note; the frontend already compresses images before sending
// (utils/imageCompression.js) so this is a ceiling, not the normal size.
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "application/pdf",
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    // A first, cheap gate on the client-declared Content-Type. This is
    // NOT trusted alone for the image types (see verifyFileSignature in
    // uploadsController.js, which checks actual magic bytes) — but it's
    // enough on its own to reject obviously-wrong uploads (e.g. a .exe)
    // before spending time buffering the whole file.
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  },
});
