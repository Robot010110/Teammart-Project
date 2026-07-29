import { apiRequest } from "./apiClient";
import { compressImage } from "../utils/imageCompression";

// activityService.js — talks to /api/activities (the Employee's own daily
// activity log). Mirrors backend/src/controllers/activitiesController.js
// one function per endpoint.
//
// A note on images — read this before touching anything image-related:
// the backend's ActivityImage model stores a plain URL string per image,
// and there is currently NO file-upload endpoint anywhere in the backend
// (no route that accepts a raw photo and hands back a hosted URL). Until
// one exists, prepareImageForUpload() below is a TEMPORARY, DEV-ONLY
// stand-in: it compresses the selected file (see utils/imageCompression.js
// — this is what keeps large phone-camera photos from failing to upload)
// and turns the result into a base64 "data URL" (re-encoded as text) sent
// as the "url" field. It works today with zero backend changes, but it is
// not how this should work in production — encoding a photo as text
// bloats it further and stores it directly in the database.
//
// TODO(real-upload): once a real upload endpoint exists (S3, Cloudinary,
// or disk + a static route), replace the body of prepareImageForUpload()
// with a call to that endpoint (the compression step stays — send the
// compressed blob, not the raw file) and return the hosted URL it
// responds with. That is the ONLY function that needs to change — every
// caller (SubmitTaskModal.jsx, ItemReportFlow.jsx) already just does
// `const url = await prepareImageForUpload(file, { onProgress })` and has
// no idea whether "url" is base64 text or a real hosted link. That's the
// whole point of keeping this conversion inside the service layer instead
// of in the component: the component is not coupled to Base64 at all.

// TODO(pagination): this always fetches the employee's entire activity
// history in one request. Fine at prototype scale; once an employee can
// realistically have hundreds of activities, this should take a
// page/cursor parameter the way `category`/`status` already work.
export function listActivities({ category, status } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiRequest(`/activities${query ? `?${query}` : ""}`);
}

// Not called anywhere in the Employee UI today (the list view already has
// everything it needs from listActivities). Kept because it's a direct,
// correct wrapper for a real backend endpoint (GET /api/activities/:id)
// — a service layer's job is to expose the API it wraps, not just today's
// call sites. Likely useful for a future single-activity detail view.
export function getActivity(id) {
  return apiRequest(`/activities/${id}`);
}

// payload: { category, date, time, notes?, status?, imageUrls? }
export function createActivity(payload) {
  return apiRequest("/activities", { method: "POST", body: payload });
}

// patch: any subset of { category, date, time, notes, status }
export function updateActivity(id, patch) {
  return apiRequest(`/activities/${id}`, { method: "PATCH", body: patch });
}

export function deleteActivity(id) {
  return apiRequest(`/activities/${id}`, { method: "DELETE" });
}

export function addActivityImage(activityId, url) {
  return apiRequest(`/activities/${activityId}/images`, { method: "POST", body: { url } });
}

export function deleteActivityImage(activityId, imageId) {
  return apiRequest(`/activities/${activityId}/images/${imageId}`, { method: "DELETE" });
}

// Takes a File selected from an <input type="file"> and resolves to
// whatever string the backend should store as the ActivityImage url.
// Deliberately named around what it's FOR ("prepare this image so it can
// be uploaded") rather than HOW it currently works ("compress + convert
// to base64"), so that when the real implementation changes (see
// TODO(real-upload) above), nothing that calls this function needs to
// change its name or its assumptions — only this function's body.
//
// onProgress(percent), if given, is called through compression (0-85)
// and then encoding (85-100) — see utils/imageCompression.js for why
// this is "processing progress" rather than "network progress" today.
export async function prepareImageForUpload(file, { onProgress } = {}) {
  const compressed = await compressImage(file, {
    onProgress: (pct) => onProgress?.(Math.round(pct * 0.85)),
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      onProgress?.(100);
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(compressed);
  });
}
