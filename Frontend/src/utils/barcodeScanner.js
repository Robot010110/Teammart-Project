// barcodeScanner.js — thin wrapper around @zxing/browser so the rest of
// the app never touches the library directly (same "keep the messy
// browser-API detail behind one small function" pattern as
// imageCompression.js and activityService.js's prepareImageForUpload).
//
// Camera access is never guaranteed (permission denied, no camera, an
// unsupported browser) — every caller of startScanning() MUST be
// prepared for the returned promise to reject and fall back to manual
// barcode entry. That fallback is not an edge case here, it's a first-
// class path.
//
// @zxing/browser is dynamically imported instead of a static top-level
// import — it's a sizeable dependency (see the vite build's chunk-size
// warning) that only a fraction of app sessions ever need (opening the
// barcode-scan step specifically). A static import would ship it in the
// initial bundle for every employee on every page load, including ones
// who only ever use the "take picture" path or never touch Expired/Wasted
// Items at all — a real cost on the slower mobile connections this app is
// primarily used on.

let reader = null;
let controls = null;

// Starts decoding frames from the device camera into `videoEl`. Calls
// onResult(text) the moment a barcode is recognized (scanning keeps
// running after that — call stopScanning() from onResult if you only
// want the first hit). Rejects if camera access isn't available.
export async function startScanning(videoEl, onResult) {
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  reader = new BrowserMultiFormatReader();
  controls = await reader.decodeFromVideoDevice(undefined, videoEl, (result, err) => {
    if (result) onResult(result.getText());
    // NotFoundException fires continuously while no barcode is in frame —
    // that's expected, not a real error, so it's silently ignored here.
  });
}

export function stopScanning() {
  controls?.stop();
  controls = null;
  reader = null;
}
