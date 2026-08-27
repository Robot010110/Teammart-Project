import { apiRequest } from "./apiClient";
import { compressImage } from "../utils/imageCompression";
import { uploadFile } from "./uploadService";

// activityService.js — talks to /api/activities (the Employee's own daily
// activity log). Mirrors backend/src/controllers/activitiesController.js
// one function per endpoint.
//
// A note on images: the backend's ActivityImage model stores a plain URL
// string per image. prepareImageForUpload() compresses the selected file
// (see utils/imageCompression.js — this is what keeps large phone-camera
// photos small) and uploads the result to POST /api/uploads (see
// uploadService.js), returning the real hosted URL the backend hands
// back. Every caller (SubmitTaskModal.jsx, ItemReportFlow.jsx, etc.) just
// does `const url = await prepareImageForUpload(file, { onProgress })`
// and has no idea how "url" was produced — that's the whole point of
// keeping this inside the service layer instead of in the component.

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

// --- Staff-only (Supervisor Mode) ---
export function listActivitiesForMarket({ marketId, employeeId, category, status } = {}) {
  const params = new URLSearchParams();
  if (marketId) params.set("marketId", marketId);
  if (employeeId) params.set("employeeId", employeeId);
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiRequest(`/activities/market${query ? `?${query}` : ""}`);
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

// getPerformanceSummary / getActivityPerformanceHistory — the real
// Performance figure (approved / (approved+rejected) reviewed
// Activities, never a hardcoded percentage — see
// activitiesController.computeActivityPerformance). Named distinctly
// from attendanceService's getPerformanceHistory (Attendance Rate) —
// these are two different, real metrics, not the same thing renamed.
export function getPerformanceSummary() {
  return apiRequest("/activities/performance");
}

export function getActivityPerformanceHistory({ weeks, months } = {}) {
  const params = new URLSearchParams();
  if (weeks) params.set("weeks", weeks);
  if (months) params.set("months", months);
  const query = params.toString();
  return apiRequest(`/activities/performance-history${query ? `?${query}` : ""}`);
}

export function addActivityImage(activityId, url) {
  return apiRequest(`/activities/${activityId}/images`, { method: "POST", body: { url } });
}

export function deleteActivityImage(activityId, imageId) {
  return apiRequest(`/activities/${activityId}/images/${imageId}`, { method: "DELETE" });
}

// Staff-only: approve/reject a PENDING activity.
// payload: { status: "APPROVED" | "REJECTED", rejectionReason? }
export function reviewActivity(id, payload) {
  return apiRequest(`/activities/${id}/review`, { method: "POST", body: payload });
}

// Takes a File selected from an <input type="file"> and resolves to a
// real hosted URL the backend should store as the ActivityImage url.
// Deliberately named around what it's FOR ("prepare this image so it can
// be uploaded") rather than HOW it works, so nothing that calls this
// function needs to know whether it's a compress+upload today or
// something else tomorrow — only this function's body would change.
//
// onProgress(percent), if given, is called through compression (0-70)
// and then the actual network upload (70-100).
export async function prepareImageForUpload(file, { onProgress } = {}) {
  const compressed = await compressImage(file, {
    onProgress: (pct) => onProgress?.(Math.round(pct * 0.7)),
  });

  return uploadFile(compressed, {
    onProgress: (pct) => onProgress?.(70 + Math.round(pct * 0.3)),
  });
}
