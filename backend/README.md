# TEAMMART Backend (v2)

Express + Prisma + PostgreSQL API built to match the `teammart_draft_1`
frontend. This is a rebuild of the original `backend/` folder — most of
its ideas (Prisma client singleton, Zod validation middleware, JWT auth,
centralized error handling) are reused, but the schema and RBAC are
expanded to support three real account types and the task workflow.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

The API listens on `http://localhost:4000` by default (see `PORT` in `.env`).

## The three account types

The frontend has three logins, and they are NOT interchangeable — this is
the most important structural change from the old backend:

| Role               | Table      | Login field    | Scope                     |
|---------------------|------------|----------------|----------------------------|
| Admin               | `User`     | email          | everything                |
| Regional Manager     | `User`     | email          | one Zone (all its Markets) |
| Supervisor           | `User`     | email          | one Market                 |
| Employee             | `Employee` | employeeCode   | just themselves            |

Staff (`User`) log in at `POST /api/auth/login`.
Employees log in at `POST /api/auth/employee-login`.

Both return a JWT, but the token payloads are different shapes — see
`src/utils/jwt.js`. Critically, **the token carries the zoneId/marketId
the account is scoped to**. The old backend's token only had `{ userId,
role }`, which is *why* its `requireOwnZoneOrElevated` middleware existed
but could never actually be wired up to anything.

## RBAC — how ownership is actually enforced

`src/middleware/auth.js` has four pieces:

- `requireAuth` — verifies the JWT, sets `req.user`.
- `requireStaffRole(...roles)` — blocks anyone who isn't staff with an
  allowed role. Used at the top of most route files.
- `requireEmployeeAuth` — the mirror image, for employee-only actions
  (submitting a task).
- `requireOwnZoneOrElevated` / `requireOwnMarketOrElevated` /
  `staffCanAccessMarket` — the actual IDOR guard. A Regional Manager can
  only touch their own zone; a Supervisor can only touch their own
  market. `staffCanAccessMarket` is exported separately so controllers
  that already have a record in hand (e.g. an Employee, to check their
  `marketId`) can run the same check without re-parsing the request.

**This is the fix for the bug found in the old codebase**: the guard
existed in the file but no route ever imported and applied it. Every
zone/market/employee/task route below is guarded for real.

## Folder structure

```
src/
  app.js               Express app, mounts all routes
  index.js             starts the server
  lib/prisma.js        shared PrismaClient instance
  middleware/
    auth.js            requireAuth, requireStaffRole, ownership guards
    errorHandler.js    central error -> HTTP response mapping
    notFound.js         404 fallback
  utils/
    jwt.js             sign/verify helpers, token payload shapes
    validate.js        Zod schemas + validateBody/validateQuery
    asyncHandler.js    wraps async route handlers (no repeated try/catch)
  routes/              thin: path + middleware + call into controllers/
  controllers/         the actual business logic, one file per resource
prisma/
  schema.prisma
  seed.js              creates one Admin, one Regional Manager, one
                       Supervisor, two Employees, and a couple of Tasks
```

## API overview

| Method | Path                              | Who                          |
|---|---|---|
| POST | `/api/auth/login`                   | public                        |
| POST | `/api/auth/employee-login`          | public                        |
| POST | `/api/auth/register`                | Admin (creates staff)         |
| GET  | `/api/zones`                        | Admin, Regional Manager       |
| GET/POST/PATCH/DELETE | `/api/zones/:id...`     | Admin, own Regional Manager   |
| GET/POST/PATCH/DELETE | `/api/markets/:id...`   | scoped by zone/market         |
| GET/POST/PATCH/DELETE | `/api/employees/:id...`| scoped by market; employee can read own record |
| POST | `/api/tasks`                         | Employee (self-submit)        |
| POST | `/api/tasks/assign`                  | staff (assign to an employee) |
| PATCH| `/api/tasks/:id/submit`              | Employee (complete an assigned task) |
| PATCH| `/api/tasks/:id/approve`             | staff, scoped                 |
| PATCH| `/api/tasks/:id/reject`              | staff, scoped                 |
| GET  | `/api/tasks`, `/api/tasks/:id`        | scoped by role                |
| GET  | `/api/dashboard`                    | anyone logged in, scoped stats|
| GET  | `/api/reports/tasks`                | staff, scoped                 |
| GET  | `/api/reports/employees/:id/summary`| staff (scoped) or the employee themself |
| GET  | `/api/profile`                       | anyone logged in              |
| PATCH| `/api/profile/password`             | anyone logged in (own password)|

## Known limitation

Photo evidence fields (`beforePhotoUrl`, `afterPhotoUrl`) exist on `Task`
but there is no file-upload endpoint yet — the frontend's "attach photo"
step is still a local-only UI flag. Wire up a real upload (S3, Cloudinary,
or local disk + static route) and pass its resulting URL into these
fields when you're ready.
