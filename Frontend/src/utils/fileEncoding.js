import { uploadFile } from "../services/uploadService";

// uploadAttachment — uploads a File/Blob to the real backend upload
// endpoint (see services/uploadService.js) and resolves to the hosted
// URL. Used for anything that isn't a photo (compressImage in
// imageCompression.js assumes image input, which a PDF/voice recording
// isn't) — same upload path as activityService.prepareImageForUpload,
// just without the image-specific compression step first. (Formerly
// named readFileAsDataUrl, back when this actually base64-encoded the
// file instead of uploading it — renamed along with the two call sites
// once a real upload endpoint existed, so the name stays honest.)
export function uploadAttachment(fileOrBlob) {
  return uploadFile(fileOrBlob);
}

export function formatFileSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds) {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
