import { getToken, ApiError } from "./apiClient";

// uploadService.js — the one place that knows how to send a File/Blob to
// the real backend upload endpoint (POST /api/uploads) and get back a
// hosted URL. Deliberately separate from apiClient.apiRequest(), which
// always sends JSON — this sends multipart/form-data instead, so it
// can't reuse that wrapper directly, but it mirrors the same
// conventions (shared token, ApiError on failure, same base URL).
//
// Used by activityService.prepareImageForUpload and
// utils/fileEncoding.uploadAttachment — those two functions are the
// only callers; everything else in the app just calls one of those and
// gets back a URL string, unaware of how it got there.
//
// fetchProtectedFile() is the read-side counterpart: uploaded files are
// private (GET /api/uploads/:filename requires auth AND ownership — see
// backend/src/utils/fileAuthorization.js), and a plain <img src> can't
// attach an Authorization header. AuthenticatedImage.jsx (the one place
// that calls this) does an authenticated fetch instead and renders the
// result as a local blob: URL — see that component for the full story.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function uploadFile(fileOrBlob, { onProgress } = {}) {
  const formData = new FormData();
  formData.append("file", fileOrBlob, fileOrBlob.name || "upload");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/uploads`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // fall through — data stays null, handled below
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.url) {
        resolve(data.url);
      } else {
        reject(new ApiError(data?.error || "Upload failed. Please try again.", xhr.status));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError("Could not reach the server. Please check your connection and try again.", 0));
    };

    xhr.send(formData);
  });
}

// Fetches a private file (an /api/uploads/:filename URL) with the
// current session's Bearer token and resolves to a Blob. Throws
// ApiError on any non-2xx response (401/403/404), same shape as
// apiClient's apiRequest, so callers can branch on `.status` the same
// way they already do everywhere else.
export async function fetchProtectedFile(url) {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw new ApiError("Could not reach the server. Please check your connection and try again.", 0);
  }

  if (!response.ok) {
    let message = "Could not load this file.";
    try {
      message = (await response.json())?.error || message;
    } catch {
      // response body wasn't JSON — keep the generic message
    }
    throw new ApiError(message, response.status);
  }

  return response.blob();
}
