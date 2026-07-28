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

## Current project status

The **Employee** role is the only one fully connected end to end:

- Real login (`POST /api/auth/employee-login`), with the session kept
  across page refreshes.
- Real profile (`GET /api/profile`): name, employee ID, role, shift,
  market, employment start date, profile picture (when set). Performance
  is shown honestly as "not yet available" rather than a fake number —
  the backend doesn't calculate it yet.
- Real daily activity log (`GET/POST/PATCH/DELETE /api/activities`):
  create as Draft or submit for review, edit while Draft/Pending, delete
  while Draft (with confirmation), attach photos.

**Regional Manager, Supervisor, Admin, and CEO views are still mock data**
and have not been connected to the backend yet — that's the next phase of
work, not started.

**Known limitation:** there is no real file-upload endpoint on the backend
yet. Employee activity photos are currently sent as base64-encoded text
rather than uploaded to real file storage — see
[Frontend/README.md](Frontend/README.md#employee-daily-activities-connected-to-the-backend)
for details. This should be replaced with a real upload endpoint (S3,
Cloudinary, or disk + static route) before this feature sees regular use.

## Development roadmap

1. ~~Backend: Employee module (profile fields, Activity model, Activity
   endpoints)~~ — done.
2. ~~Frontend: connect the Employee role to the real backend~~ — done.
3. ~~Employee module polish pass~~ — done: shared status/permission rules
   (`Frontend/src/data/activityRules.js`) instead of the same check
   copy-pasted three times, profile+activities now load in parallel
   (`Promise.allSettled`), image conversion isolated behind
   `prepareImageForUpload()` so swapping Base64 for a real upload later
   touches one function, and a few duplicated helpers (`initialsOf`) were
   consolidated. No UI or behavior changes.
4. Backend: real file-upload endpoint for activity photos.
5. Backend + Frontend: Supervisor module — review/approve/reject employee
   activities, manage one market's employees.
6. Backend + Frontend: Regional Manager module — zone-wide view across
   multiple markets.
7. Backend + Frontend: Admin / CEO module — company-wide dashboard,
   reports, analytics.
8. Attendance, notifications, and real performance calculation (explicitly
   deferred in every phase so far).
