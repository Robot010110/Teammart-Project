// Render every deliverable with one bundle and one browser.
//
//   npm run render:all                         # everything below
//   npm run render:all -- TeamMart15 TeamMart6  # only compositions whose id starts with these
//   npm run render:all -- --props=prospects/example-northgate.json --suffix=-northgate TeamMartPromo
//
// Output: out/<file>.mp4 (H.264, CRF 18, AAC soundtrack).
import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition, openBrowser } from '@remotion/renderer';

const JOBS = [
  ['TeamMartPromo', 'teammart-40s-16x9'],
  ['TeamMartPromoVertical', 'teammart-40s-9x16'],
  ['TeamMartPromoSquare', 'teammart-40s-1x1'],
  ['TeamMart15', 'teammart-15s-16x9'],
  ['TeamMart15Vertical', 'teammart-15s-9x16'],
  ['TeamMart15Square', 'teammart-15s-1x1'],
  ['TeamMart6', 'teammart-6s-16x9'],
  ['TeamMart6Vertical', 'teammart-6s-9x16'],
  ['TeamMart6Square', 'teammart-6s-1x1'],
  ['TeamMartPromoKurdish', 'teammart-40s-16x9-ckb'],
  ['TeamMartPromoKurdishVertical', 'teammart-40s-9x16-ckb'],
  ['TeamMartPromoKurdishSquare', 'teammart-40s-1x1-ckb'],
];

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const filters = args.filter((a) => !a.startsWith('--'));
const propsFile = flag('props');
const inputProps = propsFile ? JSON.parse(fs.readFileSync(propsFile, 'utf8')) : undefined;
const suffix = flag('suffix') ?? '';
const concurrency = Number(flag('concurrency') ?? 4);

const jobs = JOBS.filter(([id]) => !filters.length || filters.some((f) => (f.endsWith('$') ? id === f.slice(0, -1) : id.startsWith(f))));
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
fs.mkdirSync('out', { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const browser = await openBrowser('chrome', { browserExecutable, chromiumOptions: { gl: 'angle' } });
for (const [id, file] of jobs) {
  const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser, browserExecutable });
  const outputLocation = path.join('out', `${file}${suffix}.mp4`);
  const t0 = Date.now();
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 18,
    pixelFormat: 'yuv420p',
    imageFormat: 'jpeg',
    jpegQuality: 94,
    audioCodec: 'aac',
    audioBitrate: '256k',
    inputProps,
    outputLocation,
    concurrency,
    puppeteerInstance: browser,
    browserExecutable,
    chromiumOptions: { gl: 'angle' },
    timeoutInMilliseconds: 120000,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10);
      if (p !== last) {
        last = p;
        process.stdout.write(`\r${id}: ${Math.round(progress * 100)}%   `);
      }
    },
  });
  console.log(`\r${outputLocation}  ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
await browser.close({ silent: true });
