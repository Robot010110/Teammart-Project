// imageCompression.js — resizes and compresses an image client-side
// before it's handed off for upload, so a large photo from a phone
// camera never fails to upload just because of its raw file size. Pure
// canvas API, no dependency needed.
//
// onProgress(percent) is optional — this is local processing today (see
// the TODO(real-upload) note in activityService.js), not a network
// request, so "progress" here means "how far through decode -> resize ->
// encode", not bytes-over-the-wire. Once a real upload endpoint exists,
// this same progress callback shape carries over to real network
// progress with no change needed at any call site.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image file."));
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode this image."))),
      "image/jpeg",
      quality
    );
  });
}

// Resolves to a compressed Blob. Resizes so neither dimension exceeds
// maxDimension, then repeatedly lowers JPEG quality until the result is
// under maxBytes (or quality bottoms out — a very busy/large photo may
// still end up somewhat over budget, which is fine; it will still be far
// smaller than the original).
export async function compressImage(
  file,
  { maxDimension = 1600, quality = 0.75, maxBytes = 1.5 * 1024 * 1024, onProgress } = {}
) {
  onProgress?.(10);
  const img = await loadImage(file);
  onProgress?.(35);

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  onProgress?.(60);

  let currentQuality = quality;
  let blob = await canvasToBlob(canvas, currentQuality);
  let attempts = 0;
  while (blob.size > maxBytes && currentQuality > 0.35 && attempts < 5) {
    currentQuality -= 0.15;
    blob = await canvasToBlob(canvas, currentQuality);
    attempts += 1;
    onProgress?.(60 + attempts * 8);
  }

  onProgress?.(100);
  return blob;
}
