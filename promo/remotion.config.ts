// Render defaults for `npx remotion render` / `npx remotion studio`.
// Every option here can still be overridden per-render on the CLI.
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./src/index.ts');

// JPEG frames are much faster to encode than PNG and the grain hides any
// compression; quality stays high enough that UI text in the screenshots is crisp.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(94);

// H.264 at a low CRF keeps the soft glows and gradients free of banding.
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');

Config.setOverwriteOutput(true);

// Optional: use an already-installed Chrome/Chromium instead of letting
// Remotion download its headless shell (useful on locked-down networks / CI).
//   REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npx remotion render ...
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
