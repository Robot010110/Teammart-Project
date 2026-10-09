#!/usr/bin/env node
/**
 * Re-capture the real TeamMart screens used in the promo (public/screens/).
 *
 * Prerequisites: the TeamMart app running locally with seeded demo data
 * (see the repo README: backend on :4000, frontend on :5173), plus Playwright:
 *
 *   npm i --no-save playwright@1.56.1 && npx playwright install chromium
 *   node scripts/capture-screens.cjs                 # capture only
 *   node scripts/capture-screens.cjs --seed-activity # first add a "lived-in" day
 *
 * --seed-activity uses the app's own API (no direct DB writes) to check the
 * demo Supervisor in and assign a few sudden tasks, so the screens show a
 * working day instead of empty states. It changes data in the database the
 * API points at — only use it against a local/demo instance.
 *
 * Logins default to the demo accounts created by backend/prisma/seed.js and
 * can be overridden with env vars (ADMIN_EMAIL, ADMIN_PASSWORD, RM_EMAIL, ...).
 */
const path = require('node:path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm i --no-save playwright@1.56.1 && npx playwright install chromium');
  process.exit(1);
}

const APP = process.env.APP_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:4000/api';
const OUT = path.resolve(__dirname, '..', 'public', 'screens');

const ACCOUNTS = {
  admin: { kind: 'staff', body: { email: process.env.ADMIN_EMAIL || 'admin@teammart.test', password: process.env.ADMIN_PASSWORD || 'Admin123!' } },
  rm: { kind: 'staff', body: { email: process.env.RM_EMAIL || 'ali.farsgardi@teammart.test', password: process.env.RM_PASSWORD || 'ZoneManager123!' } },
  supervisor: { kind: 'staffId', body: { loginId: process.env.SUPERVISOR_ID || 'em881', password: process.env.SUPERVISOR_PASSWORD || 'Sr@9907' } },
  employee: { kind: 'employee', body: { employeeCode: process.env.EMPLOYEE_CODE || 'TM-1001', password: process.env.EMPLOYEE_PASSWORD || 'Employee123!' } },
};

const ENDPOINT = { staff: '/auth/login', staffId: '/auth/staff-id-login', employee: '/auth/employee-login' };

async function call(method, route, token, body) {
  const res = await fetch(API + route, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function login(name) {
  const a = ACCOUNTS[name];
  const r = await call('POST', ENDPOINT[a.kind], null, a.body);
  if (!r.json || !r.json.token) throw new Error(`Login failed for ${name}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.token;
}

async function seedActivity(tokens) {
  console.log('Seeding a lived-in day through the API…');
  console.log('  supervisor check-in:', (await call('POST', '/attendance/check-in', tokens.supervisor, {})).status);
  const emps = (await call('GET', '/employees', tokens.supervisor)).json;
  const list = Array.isArray(emps) ? emps : emps.employees || emps.data || [];
  const target = list.find((e) => e.employeeCode === (process.env.EMPLOYEE_CODE || 'TM-1001'));
  if (!target) return console.log('  (employee not visible to supervisor — skipping tasks)');
  const due = (m) => new Date(Date.now() + m * 60000).toISOString();
  const tasks = [
    [tokens.rm, { title: 'Restock dairy shelf', description: 'Dairy chiller in Aisle 4 is running low. Pull anything near expiry, restock, and attach a photo.', priority: 'HIGH', category: 'RESTOCKING', dueAt: due(30), location: 'Aisle 4 · Dairy' }],
    [tokens.supervisor, { title: 'Fix price labels', description: "Snacks promo labels are showing last week's price.", priority: 'NORMAL', category: 'PRICE_LABEL', dueAt: due(90), location: 'Aisle 7 · Snacks' }],
    [tokens.supervisor, { title: 'Clean freezer doors', description: 'Fog and fingerprints on frozen section doors before the evening rush.', priority: 'URGENT', category: 'CLEANING', dueAt: due(20), location: 'Frozen · Doors 1–6' }],
  ];
  for (const [tok, body] of tasks) {
    const r = await call('POST', '/sudden-tasks/assign', tok, { employeeId: target.id, ...body });
    console.log(`  assign "${body.title}":`, r.status);
    if (r.status < 300 && body.priority === 'HIGH') {
      console.log('  start it as the employee:', (await call('PATCH', `/sudden-tasks/${r.json.id}/start`, tokens.employee)).status);
    }
  }
}

const MOBILE = { width: 390, height: 844, scale: 3, mobile: true };
const DESKTOP = { width: 1440, height: 900, scale: 2, mobile: false };

async function shoot(browser, { token, route, file, vp }) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.scale,
    reducedMotion: 'reduce', // shortens the AION splash to ~2 s
    colorScheme: 'dark',
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  await ctx.addInitScript((t) => localStorage.setItem('teammart_token', t), token);
  const page = await ctx.newPage();
  await page.goto(`${APP}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  await page.evaluate((r) => {
    window.history.pushState({}, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, file) });
  console.log('saved', file);
  await ctx.close();
}

(async () => {
  const tokens = {};
  for (const name of Object.keys(ACCOUNTS)) tokens[name] = await login(name);
  if (process.argv.includes('--seed-activity')) await seedActivity(tokens);

  const browser = await chromium.launch();
  const jobs = [
    { token: tokens.admin, route: '/admin/home', file: 'admin-dashboard.png', vp: DESKTOP },
    { token: tokens.rm, route: '/rm/profile', file: 'regional-manager-home.png', vp: MOBILE },
    { token: tokens.supervisor, route: '/supervisor/home', file: 'supervisor-home.png', vp: MOBILE },
    { token: tokens.employee, route: '/me/tasks', file: 'employee-tasks.png', vp: MOBILE },
  ];
  for (const job of jobs) await shoot(browser, job);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
