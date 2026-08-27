import { useEffect, useState } from "react";
import { fetchProtectedFile } from "../services/uploadService";

// useAuthenticatedImage.js — turns a private /api/uploads/:filename URL
// into a local blob: URL an <img> can actually render (a plain <img
// src> can't attach the Authorization header the backend now requires —
// see fetchProtectedFile's own comment). A src that's already a data:
// or blob: URL (legacy base64 records, or something already object-URL'd
// upstream) is passed straight through with no fetch at all, so this
// hook is safe to point at ANY stored image field regardless of when it
// was created.
//
// Revokes the previous blob: URL whenever src changes or the component
// unmounts — object URLs are not garbage-collected on their own and
// leak memory if left dangling.
export function useAuthenticatedImage(src) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(false);

    if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
      setBlobUrl(src || null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl = null;
    setLoading(true);

    fetchProtectedFile(src)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return { blobUrl, loading, error };
}
