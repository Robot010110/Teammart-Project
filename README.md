# TeamMart

TeamMart is a role-based dashboard for managing supermarket staff and their
daily work, across four roles: **Admin**, **Regional Manager**,
**Supervisor**, and **Employee**. Each role sees a purpose-built view
scoped to what they're responsible for — an Employee only sees their own
profile and daily activity log; a Supervisor sees one market; a Regional
Manager sees every market in their zone; an Admin sees everything.

This repository contains both halves of the app:

```
Teammart-project-draft-1/
  Frontend/   React + Tailwind CSS client
  backend/    Express + Prisma + PostgreSQL API
```

Each folder has its own README with setup details specific to it —
[Frontend/README.md](Frontend/README.md) and
[backend/README.md](backend/README.md). This root README is the map of
the whole project; it doesn't replace either one. For a short walkthrough
of how the frontend is put together (folders, services, the auth/API
request flow), see [Frontend/docs/ARCHITECTURE.md](Frontend/docs/ARCHITECTURE.md).

## Technology stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, `lucide-react` icons |
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL |
| Auth | JWT (`jsonwebtoken`), passwords hashed with `bcryptjs` |
| Validation | Zod |

No frontend HTTP library (axios, etc.) is used — the browser's built-in
`fetch` is wrapped once in `Frontend/src/services/apiClient.js` and every
feature calls that instead of making requests directly.

## How to install

```bash
# Backend
cd backend
npm install
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET, see below

# Frontend (in a separate terminal)
cd Frontend
npm install
cp .env.example .env   # defaults are fine for local development
```

## How to run

```bash
# 1. Backend — applies migrations, seeds demo data, starts the API on :4000
cd backend
npx prisma migrate dev
npm run prisma:seed
npm run dev

# 2. Frontend — starts the Vite dev server, prints a local URL
cd Frontend
npm run dev
```

The frontend expects the backend to be running at the URL in its `.env`
(`VITE_API_URL`, defaults to `http://localhost:4000/api`).

## Environment variables

**`backend/.env`**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `PORT` | Port the API listens on (default `4000`) |
| `NODE_ENV` | `development` or `production` |

**`Frontend/.env`**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend API (default `http://localhost:4000/api`) |

### Troubleshooting: "Could not reach the server"

This message comes from `Frontend/src/services/apiClient.js` when the
browser's `fetch()` throws before any HTTP response comes back — i.e. it
never reached the backend at all. It is not a backend, CORS, Prisma, or
auth bug; it means `VITE_API_URL` in `Frontend/.env` is pointing somewhere
unreachable (most commonly a stale LAN IP left over from testing on
another device on the network, e.g. `http://192.168.x.x:4000/api`).

Fix: make sure `Frontend/.env` matches `Frontend/.env.example`
(`VITE_API_URL=http://localhost:4000/api`) for local development, then
restart `npm run dev` — Vite only reads `.env` at dev-server startup, so
editing it while the server is running has no effect until you restart.

## Current project status

The **Employee** (Worker + Cashier) and **Supervisor** roles are fully
connected to the real backend, with real routing/history so in-app
navigation and the Android/browser Back button behave like a real app
(not a fake back-button — see the routing note below). **Regional
Manager and Admin/CEO views are still mock data** (hardcoded
zone/password login in `Frontend/src/data/auth.js`, no backend calls) —
that's the remaining phase of work, not started.

Real, backend-connected features:

- **Auth** — Employee (`POST /api/auth/employee-login`), Cashier
  (`POST /api/auth/cashier-login`), and Supervisor
  (`POST /api/auth/login`, same endpoint every other staff role uses) all
  authenticate against real accounts and keep the session across page
  refreshes (JWT, with an optional longer-lived "remember me" token for
  Employee/Cashier).
- **Profile** (`GET /api/profile`) — name, employee ID, role, shift,
  market, employment start date, profile picture (when set), department.
- **Daily activity log** (`GET/POST/PATCH/DELETE /api/activities`) —
  create as Draft or submit for review, edit while Draft/Pending, delete
  while Draft, attach photos. Covers Shelf Cleaning/Facing/Refilling,
  Shelf Labels, Product Customization, Daily Cleaning, and Item Counting.
  The Activity tab is for submitting activities; an employee's own
  history (Draft/Pending/Approved/Rejected) lives under
  Profile → Performance History.
- **Expired & Wasted Items** and **Wasted Overall** (a fixed produce list
  — Eggs, Tomato, Potato, Cucumber, Onion, or Other with a free-text
  name — reported in kg, except Eggs which is a whole-number count of
  eggs, never kilograms) — both decrement/report correctly and notify the
  reporting employee's Supervisor.
- **Sudden Tasks**, **Attendance** (including Leave Requests), **Chat**
  (market group, warnings broadcast, direct messages, polling-based), and
  **Notifications** — all real, real backend models, no mock data.
- **Supervisor Mode** — a mobile management workspace (Home, Employees,
  Chat, Market activity feed, Settings) scoped to the Supervisor's own
  market via the same RBAC (`assertMarketAccess` /
  `requireAccessibleEmployee`) every other staff-scoped endpoint uses.
  Routes are navigation only — they are never the authorization boundary;
  the backend independently enforces access on every request.

**Routing:** the frontend uses `react-router-dom` (`BrowserRouter`) for
real, back-button-correct navigation across the Employee/Cashier/
Supervisor workspaces — list → detail screens use route params (e.g.
`/supervisor/employees/:employeeId`), not a single global "selected item"
state, so refresh/Back/Forward/direct links all work correctly. There is
no production deployment/hosting config in this repo yet; if one is
added, the static host must fall back to `index.html` for unknown paths
(a `BrowserRouter` requirement) — Vite's own dev server and
`vite preview` already do this by default.

**Known limitation:** there is no real file-upload endpoint on the backend
yet. Photos (activity evidence, waste reports, chat attachments) are
currently sent as base64-encoded text rather than uploaded to real file
storage — see
[Frontend/README.md](Frontend/README.md#employee-daily-activities-connected-to-the-backend)
for details. This should be replaced with a real upload endpoint (S3,
Cloudinary, or disk + static route) before this feature sees regular use.

## Development roadmap

1. ~~Backend: Employee module (profile fields, Activity model, Activity
   endpoints)~~ — done.
2. ~~Frontend: connect the Employee role to the real backend~~ — done.
3. ~~Employee module polish pass~~ — done.
4. ~~Backend + Frontend: Cashier role, Sudden Tasks, Attendance/Leave
   Requests, Chat, Notifications, Supervisor Mode~~ — done.
5. ~~Frontend: real routing/browser-history navigation across Employee,
   Cashier, and Supervisor workspaces~~ — done.
6. Backend: real file-upload endpoint for photos (activity evidence,
   waste reports, chat attachments) — currently base64.
7. Backend + Frontend: Regional Manager module — zone-wide view across
   multiple markets, connected to the real backend (currently mock
   login/data).
8. Backend + Frontend: Admin / CEO module — company-wide dashboard,
   reports, analytics.
9. Real performance-score calculation (Profile currently shows Attendance
   Rate and Approved/Rejected activity rate — both real — but no single
   composite "performance score" exists yet).
