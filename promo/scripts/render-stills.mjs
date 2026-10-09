// Render a handful of frames as JPEG stills with a single bundle + browser.
//
//   npm run stills                              -> key frames, 16:9
//   npm run stills -- TeamMartPromoVertical     -> key frames, 9:16
//   npm run stills -- TeamMartPromo 360 900     -> specific frames
//
// Output: out/stills/<composition>-<frame>.jpg
import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';

const [compId = 'TeamMartPromo', ...frameArgs] = process.argv.slice(2);
// One representative frame per shot of the plan (see PLAN.md).
const KEY_FRAMES = [8, 150, 330, 372, 400, 470, 600, 700, 780, 840, 900, 960, 1060, 1150, 1230, 1290, 1330, 1370, 1440, 1520, 1600, 1720, 1820, 1940, 2060, 2170, 2260, 2380];
const frames = frameArgs.length ? frameArgs.map(Number) : KEY_FRAMES;

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
const outDir = path.resolve('out/stills');
fs.mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const browser = await openBrowser('chrome', { browserExecutable });
const composition = await selectComposition({ serveUrl, id: compId, puppeteerInstance: browser, browserExecutable });

for (const frame of frames) {
  const output = path.join(outDir, `${compId}-${String(frame).padStart(4, '0')}.jpg`);
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, output, frame, imageFormat: 'jpeg', jpegQuality: 90, puppeteerInstance: browser, browserExecutable });
  console.log(`frame ${frame} -> ${path.relative(process.cwd(), output)} (${Date.now() - t0} ms)`);
}
await browser.close({ silent: true });
