// fileEncoding.js — turns a File/Blob into a base64 data URL with no
// compression, for anything that isn't a photo (compressImage in
// imageCompression.js assumes image input, which a PDF/voice recording
// isn't). Same TEMPORARY, DEV-ONLY stand-in as
// activityService.prepareImageForUpload — there is no real upload
// endpoint anywhere in this backend yet (see that function's own doc
// comment); this is the exact same convention applied to non-image
// attachments instead of duplicating a second ad-hoc approach.
export function readFileAsDataUrl(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(fileOrBlob);
  });
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
