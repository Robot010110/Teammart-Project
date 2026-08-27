import { ImageOff } from "lucide-react";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";

// AuthenticatedImage.jsx — drop-in replacement for <img src={url} ...>
// everywhere in this app that renders a photo/attachment field. Files
// are private now (see backend/src/utils/fileAuthorization.js) — a plain
// <img> tag can't send the Authorization header the backend requires, so
// this fetches the file itself (via useAuthenticatedImage) and renders
// the result as a local blob: URL instead. Every prop other than `src`
// is passed straight through to the underlying <img>, so swapping
// `<img src={x} className={y} alt={z} />` for
// `<AuthenticatedImage src={x} className={y} alt={z} />` is the entire
// change needed at each render site.
export default function AuthenticatedImage({ src, className = "", alt = "", ...rest }) {
  const { blobUrl, loading, error } = useAuthenticatedImage(src);

  if (error) {
    return (
      <div className={`${className} grid place-items-center bg-white/[0.04] text-[#4C5266]`}>
        <ImageOff size={16} />
      </div>
    );
  }

  if (loading || !blobUrl) {
    return <div className={`${className} bg-white/[0.04] animate-pulse`} />;
  }

  return <img src={blobUrl} className={className} alt={alt} {...rest} />;
}
