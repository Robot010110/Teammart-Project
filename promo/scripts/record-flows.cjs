#!/usr/bin/env node
/**
 * Record the real TeamMart workflow that S4 of the film plays inside its
 * phones (public/recordings/<lang>/):
 *
 *   supervisor-assigns.mp4        Supervisor assigns "Restock dairy shelf" to an employee
 *   employee-completes-task.mp4   that employee starts it, takes a photo, completes it
 *   supervisor-approves.mp4       Supervisor approves logged work in the Review Queue
 *
 * It drives the actual app UI (no mock-ups), so it needs the stack running
 * locally with the seeded demo accounts (backend :4000, frontend :5173 —
 * see the repo README) and Playwright:
 *
 *   npm i --no-save playwright@1.56.1
 *   node scripts/record-flows.cjs            # English
 *   node scripts/record-flows.cjs --lang ckb # Sorani Kurdish (RTL)
 *
 * It WRITES to the database the API points at — it assigns and completes a
 * task and logs and approves an activity — so only run it against a local
 * or demo instance. For the Kurdish run it switches the two demo accounts'
 * language preference to Kurdish and switches them back afterwards.
 *
 * Each clip also gets its key moments (tap, screen shown…) written to
 * src/recordings/events.json, which the film uses to cut and time the
 * recordings — so a re-recording drops straight in.
 *
 * Capture: Chrome's screencast (every repaint, at device resolution, with
 * real timestamps) is retimed to a constant 60 fps H.264 file with ffmpeg,
 * so motion in the app keeps its real timing. Taps are drawn as a soft
 * ripple, like a screen recording on a phone.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm i --no-save playwright@1.56.1');
  process.exit(1);
}

const LANG = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'en';
const APP = process.env.APP_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:4000/api';
const OUT = path.resolve(__dirname, '..', 'public', 'recordings', LANG);
const PHOTO = path.resolve(__dirname, '..', '..', 'Frontend', 'src', 'assets', 'login', 'employee-aisle.jpg');
const EXECUTABLE = process.env.CHROME || undefined;
const EVENTS = path.resolve(__dirname, '..', 'src', 'recordings', 'events.json');

/** Key moments of the clip being recorded, in wall-clock seconds. */
let marks = null;
const mark = (name) => {
  if (marks) marks[name] = Date.now() / 1000;
};
const clips = {};

const ACCOUNTS = {
  supervisor: { route: '/auth/staff-id-login', body: { loginId: process.env.SUPERVISOR_ID || 'em881', password: process.env.SUPERVISOR_PASSWORD || 'Sr@9907' } },
  employee: { route: '/auth/employee-login', body: { employeeCode: process.env.EMPLOYEE_CODE || 'TM-1001', password: process.env.EMPLOYEE_PASSWORD || 'Employee123!' } },
};

const TEXT = {
  en: {
    title: 'Restock dairy shelf',
    description: 'Chiller in Aisle 4 is low. Pull near-expiry items and restock.',
    location: 'Aisle 4 · Dairy',
    activityNotes: 'Dairy chiller refilled, near-expiry items pulled.',
  },
  ckb: {
    title: 'پڕکردنەوەی ڕەفی شیر',
    description: 'سەلاجەی ڕێڕەوی 4 کەمە. کاڵای نزیک لە بەسەرچوون لاببە و پڕی بکەرەوە.',
    location: 'ڕێڕەوی 4 · شیرەمەنی',
    activityNotes: 'سەلاجەی شیرەمەنی پڕکرایەوە، کاڵای نزیک لە بەسەرچوون لابرا.',
  },
}[LANG];

// ── API helpers (setup only; every on-screen step goes through the UI) ──
async function call(method, route, token, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(API + route, {
    method,
    headers: { ...(isForm ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (res.status >= 400) throw new Error(`${method} ${route} -> ${res.status} ${text.slice(0, 300)}`);
  return json;
}

async function login(name) {
  const r = await call('POST', ACCOUNTS[name].route, null, ACCOUNTS[name].body);
  return r.token;
}

const setLanguage = (token, language) => call('PATCH', '/profile', token, { language });

// ── Capture ─────────────────────────────────────────────────────────────
const VIEW = { width: 390, height: 844, scale: 2 };

const TAP_RIPPLE = () => {
  const install = () => {
    const style = document.createElement('style');
    style.textContent = `
      .__tap{position:fixed;z-index:2147483647;pointer-events:none;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;
        background:rgba(255,255,255,.26);box-shadow:0 0 0 1.5px rgba(255,255,255,.6);animation:__tap .55s cubic-bezier(.2,.8,.2,1) forwards}
      @keyframes __tap{0%{transform:scale(.35);opacity:1}100%{transform:scale(1.3);opacity:0}}
      ::-webkit-scrollbar{display:none}`;
    document.head.appendChild(style);
    window.addEventListener(
      'pointerdown',
      (e) => {
        const d = document.createElement('div');
        d.className = '__tap';
        d.style.left = `${e.clientX}px`;
        d.style.top = `${e.clientY}px`;
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 700);
      },
      true,
    );
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
};

async function openApp(browser, token, route) {
  const ctx = await browser.newContext({
    viewport: { width: VIEW.width, height: VIEW.height },
    deviceScaleFactor: VIEW.scale,
    colorScheme: 'dark',
    isMobile: true,
    hasTouch: true,
    locale: LANG === 'ckb' ? 'ckb' : 'en-US',
  });
  await ctx.addInitScript((t) => localStorage.setItem('teammart_token', t), token);
  await ctx.addInitScript(TAP_RIPPLE);
  const page = await ctx.newPage();
  await page.goto(`${APP}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4200); // AION splash
  await page.evaluate((r) => {
    window.history.pushState({}, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  return { ctx, page };
}

/** Screencast `page` while `fn` runs; write a 60 fps MP4 to `file`. */
async function record(page, file, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-rec-'));
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const name = path.join(dir, `${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(name, Buffer.from(data, 'base64'));
    frames.push({ name, t: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  marks = {};
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: VIEW.width * VIEW.scale, maxHeight: VIEW.height * VIEW.scale, everyNthFrame: 1 });
  // Nudge one repaint so the first frame is the resting screen.
  await page.evaluate(() => document.body.style.setProperty('--rec', '1'));
  await page.waitForTimeout(700);
  await fn();
  await page.waitForTimeout(200);
  await cdp.send('Page.stopScreencast');
  await new Promise((r) => setTimeout(r, 300));

  // Concat list with each frame held until the next one arrived.
  const list = frames
    .map((f, i) => {
      const next = frames[i + 1];
      const dur = next ? Math.max(0.001, next.t - f.t) : 0.5;
      return `file '${f.name}'\nduration ${dur.toFixed(4)}`;
    })
    .join('\n');
  const listFile = path.join(dir, 'list.txt');
  fs.writeFileSync(listFile, `${list}\nfile '${frames[frames.length - 1].name}'\n`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', `fps=60,scale=${VIEW.width * VIEW.scale}:${VIEW.height * VIEW.scale}:flags=lanczos,format=yuv420p`,
    // Short GOP: the film seeks to arbitrary frames, which must decode fast.
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-g', '12', '-keyint_min', '12', '-movflags', '+faststart', '-an', file,
  ]);
  fs.rmSync(dir, { recursive: true, force: true });
  const seconds = frames.length ? frames[frames.length - 1].t - frames[0].t + 0.5 : 0;
  const t0 = frames[0].t;
  clips[path.basename(file, '.mp4')] = {
    duration: Number(seconds.toFixed(3)),
    events: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, Number(Math.max(0, v - t0).toFixed(3))])),
  };
  marks = null;
  console.log(`  ${path.relative(process.cwd(), file)}  ${frames.length} repaints, ${seconds.toFixed(1)} s`);
}

const pause = (page, ms) => page.waitForTimeout(ms);

/** Smooth-scroll an element into the middle of the screen (no jump cuts). */
async function reveal(page, locator) {
  await locator.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await pause(page, 650);
}

async function tap(page, locator, after = 700) {
  await reveal(page, locator);
  await locator.tap();
  await pause(page, after);
}

// ── Flows ───────────────────────────────────────────────────────────────
async function supervisorAssigns(browser, tokens, employeeId) {
  const { ctx, page } = await openApp(browser, tokens.supervisor, `/supervisor/employees/${employeeId}/tasks`);
  await record(page, path.join(OUT, 'supervisor-assigns.mp4'), async () => {
    await pause(page, 600);
    mark('tapAssignTask');
    await tap(page, page.getByRole('button', { name: /assign task|دیاریکردنی ئەرک/i }).first(), 900);
    mark('formOpen');
    const title = page.getByPlaceholder(/restock water bottles|بوتڵی ئاو/i);
    await reveal(page, title);
    await title.tap();
    mark('typeTitle');
    await title.pressSequentially(TEXT.title, { delay: 55 });
    mark('titleTyped');
    await pause(page, 300);
    const desc = page.getByPlaceholder(/what needs to be done|چی پێویستە بکرێت/i);
    await desc.tap();
    await desc.pressSequentially(TEXT.description, { delay: 18 });
    await pause(page, 400);
    // Priority → High (the second of Normal / High / Urgent).
    const field = (label) => page.locator('label', { hasText: label }).locator('xpath=..').locator('button');
    mark('pickPriority');
    await tap(page, field(/^(priority|گرنگی)$/i).nth(1), 450);
    // Category → Restocking (the one after General).
    await tap(page, field(/^(category|جۆر)$/i).nth(1), 450);
    const location = page.getByPlaceholder(/shelf a3|ڕەفی A3/i);
    await reveal(page, location);
    await location.tap();
    await location.pressSequentially(TEXT.location, { delay: 50 });
    mark('locationTyped');
    await pause(page, 500);
    const submit = page.getByRole('button', { name: /^\s*(assign|دیاریکردن)\s*$/i }).last();
    mark('tapSubmit');
    await tap(page, submit, 1400);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(page, 1100);
    mark('assigned');
    await pause(page, 500);
  });
  await ctx.close();
}

async function employeeCompletes(browser, tokens) {
  const { ctx, page } = await openApp(browser, tokens.employee, '/me/tasks');
  await record(page, path.join(OUT, 'employee-completes-task.mp4'), async () => {
    await pause(page, 900);
    mark('tapTask');
    await tap(page, page.getByText(TEXT.title).first(), 1300);
    mark('detail');
    mark('tapStart');
    await tap(page, page.getByRole('button', { name: /start task|دەستپێکردنی ئەرک/i }), 1300);
    mark('started');
    const camera = page.locator('label', { has: page.locator('input[type="file"][capture]') });
    await reveal(page, camera);
    const chooser = page.waitForEvent('filechooser');
    mark('tapCamera');
    await camera.tap();
    await (await chooser).setFiles(PHOTO);
    // The picker gives way to the photo preview once the upload finishes.
    await camera.waitFor({ state: 'detached', timeout: 20000 });
    mark('photoShown');
    await pause(page, 1200);
    mark('tapComplete');
    await tap(page, page.getByRole('button', { name: /complete task|تەواوکردنی ئەرک/i }), 1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(page, 700);
    mark('done');
    await pause(page, 1100);
  });
  await ctx.close();
}

async function supervisorApproves(browser, tokens) {
  const { ctx, page } = await openApp(browser, tokens.supervisor, '/supervisor/review-queue');
  await record(page, path.join(OUT, 'supervisor-approves.mp4'), async () => {
    await pause(page, 900);
    const row = page.locator('ul li button').filter({ hasText: /refilling/i }).first();
    mark('tapRow');
    await tap(page, row, 1100);
    mark('modal');
    mark('tapApprove');
    await tap(page, page.getByRole('button', { name: /^\s*(approve|پەسندکردن)\s*$/i }).first(), 800);
    mark('tapSave');
    await tap(page, page.getByRole('button', { name: /save decision|پاشەکەوتکردنی بڕیار/i }), 400);
    mark('approved');
    await pause(page, 1500);
  });
  await ctx.close();
}

(async () => {
  const tokens = { supervisor: await login('supervisor'), employee: await login('employee') };
  const emps = await call('GET', '/employees', tokens.supervisor);
  const list = Array.isArray(emps) ? emps : emps.employees || emps.data || [];
  const employee = list.find((e) => e.employeeCode === ACCOUNTS.employee.body.employeeCode);
  if (!employee) throw new Error('Demo employee is not in the demo supervisor’s market');

  // Logged work for the Review Queue: the employee logs a refill with a photo.
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(PHOTO)], { type: 'image/jpeg' }), 'aisle.jpg');
  const upload = await call('POST', '/uploads', tokens.employee, form);
  const now = new Date();
  await call('POST', '/activities', tokens.employee, {
    category: 'REFILLING',
    date: now.toISOString(),
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    notes: TEXT.activityNotes,
    status: 'PENDING',
    imageUrls: [upload.url],
  });

  const language = LANG === 'ckb' ? 'KURDISH' : 'ENGLISH';
  await setLanguage(tokens.supervisor, language);
  await setLanguage(tokens.employee, language);

  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  try {
    console.log(`Recording (${LANG})…`);
    await supervisorAssigns(browser, tokens, employee.id);
    await employeeCompletes(browser, tokens);
    await supervisorApproves(browser, tokens);
    const all = fs.existsSync(EVENTS) ? JSON.parse(fs.readFileSync(EVENTS, 'utf8')) : {};
    all[LANG] = clips;
    fs.mkdirSync(path.dirname(EVENTS), { recursive: true });
    fs.writeFileSync(EVENTS, `${JSON.stringify(all, null, 2)}\n`);
    console.log(`  ${path.relative(process.cwd(), EVENTS)} updated`);
  } finally {
    await browser.close();
    if (LANG !== 'en') {
      await setLanguage(tokens.supervisor, 'ENGLISH');
      await setLanguage(tokens.employee, 'ENGLISH');
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
