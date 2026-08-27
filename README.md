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
| `CORS_ORIGIN` | Comma-separated allowlist of origins allowed to call the API; unset in dev |
| `PUBLIC_BASE_URL` | Base URL uploaded-file links are built from; unset in dev (falls back to the request's own host) — see "File storage" below |
| `TEST_DATABASE_URL` | Optional — a separate database for `npm test` to use instead of `DATABASE_URL`; see "Security tests" below |

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

After restarting the dev server, also **hard-refresh the browser tab**
(Ctrl+Shift+R, or close and reopen it). `VITE_API_URL` is baked into the
JS as a plain string when the browser loads the module — a tab that was
already open before you fixed `.env` and restarted the server keeps
running that old already-executed code until it's reloaded, even though
the server itself is now serving the corrected value.

## Current project status

Every role — **Employee** (Worker + Cashier), **Supervisor**, **Regional
Manager**, and **Admin** — is fully connected to the real backend: real
login, real data, real server-side authorization. There is no mock data
or hardcoded login anywhere in the app; `Frontend/src/data/auth.js` is
just the static role-picker labels on the login screen, nothing more.

All four roles share the same mobile-first app shell (a bottom nav bar +
one screen at a time — `Frontend/src/components/employee/AppShell.jsx`),
not a desktop sidebar. Each role's tabs are scoped to what that role
actually does (e.g. Admin: Home/Zones/Markets/Staff/Settings; Regional
Manager: Home/Markets/Employees/Chat/Settings) — same visual language and
navigation model throughout, not a separate look per role.

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
- **Regional Manager** — zone/market oversight (Markets, Employees,
  market visits/ratings/notes/formal Warning-Recognition feedback, Total
  Sales/Card Sales review, Chat), scoped server-side to the zones on the
  account's own token (`User.managedZones` — a Regional Manager can be
  assigned more than one zone) via `assertZoneAccess`/`staffCanAccessMarket`.
- **Admin** — company-wide: create/list Zones and assign each one's
  Regional Manager (`POST /api/zones`, `PATCH /api/zones/:id/manager`),
  create new staff accounts of any role (`POST /api/auth/register`,
  Admin-only), and a company-wide Zones/Markets/Staff directory view.
  Everything else in the app (every RM/Supervisor endpoint) already
  treats ADMIN as an elevated role via the same RBAC helpers, so no
  separate Admin-only backend module was needed beyond this.

**Routing:** the frontend uses `react-router-dom` (`BrowserRouter`) for
real, back-button-correct navigation across the Employee/Cashier/
Supervisor workspaces — list → detail screens use route params (e.g.
`/supervisor/employees/:employeeId`), not a single global "selected item"
state, so refresh/Back/Forward/direct links all work correctly. There is
no production deployment/hosting config in this repo yet; if one is
added, the static host must fall back to `index.html` for unknown paths
(a `BrowserRouter` requirement) — Vite's own dev server and
`vite preview` already do this by default.

## File storage

Photos and attachments (activity evidence, waste reports, chat
images/voice notes/files, profile/group pictures) are uploaded to a real
backend endpoint — `POST /api/uploads` (authenticated, `multipart/form-data`,
15MB max) — instead of being embedded as base64 text. See
`backend/src/utils/fileStorage.js`, `backend/src/middleware/upload.js`,
and `backend/src/controllers/uploadsController.js`.

**Files are private by default.** There is no public static directory —
the only way to read a file back is `GET /api/uploads/:filename`, which
requires a valid login **and** a per-file authorization check against
whatever business record actually owns it (see "File authorization"
below). Knowing a file's URL is never, on its own, enough to read it.

- **Upload validation**: file type is checked against an explicit
  allowlist (JPEG/PNG/WebP/GIF images, common audio formats, PDF); for
  images, the actual file bytes are checked against each format's
  magic-number signature (not just the client-declared Content-Type,
  which can be spoofed) before the file is saved.
- **Storage keys**: every uploaded file is saved under a random UUID
  filename — never the client's original filename (path traversal /
  collision risk). A UUID is not the security mechanism here, though —
  see the authorization section below for what actually is.
- **Local dev storage**: files are written to `backend/uploads/`
  (gitignored, created automatically). **This is intentional for the
  current phase of the project, not a placeholder that happened to be
  left in** — object storage (S3-compatible or Cloudinary) is planned
  for the hosting/production phase, not part of this change. Set
  `PUBLIC_BASE_URL` in `backend/.env` if the API sits behind a
  proxy/domain that isn't the request's own host.
- **Moving to real object storage later**: only `saveUploadedFile()` in
  `fileStorage.js` needs a new body — same
  `(buffer, mimetype, publicBaseUrl) -> { filename, url }` contract,
  upload to the bucket instead of disk. The bucket itself should stay
  private (signed/short-lived URLs), with `GET /api/uploads/:filename`
  authorizing the request and then proxying/redirecting to it — the same
  authorization layer described below keeps working unchanged either
  way. **Not implemented in this change** — do not assume S3/Cloudinary
  is wired up anywhere in this codebase.
- **Existing base64 data**: nothing was migrated or deleted — old
  records with a `data:image/...;base64,...` URL still render exactly as
  before (an `<img>` doesn't care whether its value is a data URL, a
  blob URL, or a real hosted URL); only new uploads go through the real
  endpoint.

### File authorization

`GET /api/uploads/:filename` — `requireAuth`, then
`backend/src/utils/fileAuthorization.js` figures out which business
record (if any) actually references this file and applies that
resource's own access rule, reusing the same helpers every other
endpoint uses (`staffCanAccessMarket`, and chat's own
`conversationAccessFor`) rather than a second authorization system:

| File type | Who can read it |
|---|---|
| Activity photo, profile picture, Sudden Task evidence, item/price/wasted report photo | The employee it belongs to, or staff with access to that employee's market |
| Regional Manager Warning/Recognition photo, Card Sales evidence | Any staff with access to that market |
| Total Sales evidence | Regional Manager/Admin with access to that market only (matches the existing rule that even the submitting Supervisor can't read Total Sales back) |
| Chat image/file/voice attachment, group picture | Members of that conversation only |
| A freshly uploaded file not yet attached to anything | Only whoever uploaded it |

A request for a file that was never uploaded through this app returns
`404`. A request for a real file the caller isn't authorized for returns
`403` — never a redirect to a public URL, never a weaker fallback.

**Known limitation:** there's no UI yet for revoking access after the
fact (e.g. removing a photo from an Activity doesn't currently un-link
it from `fileAuthorization.js`'s lookup) — this mirrors how the app
doesn't hard-delete most business records today either (soft
deletes/status flags throughout), so it's consistent with the existing
data model rather than a new gap.

## Cross-role attendance, breaks, and department foundation (Phase 1)

This was foundation work — the backend/data architecture Phase 2 (below)
built the complete operational workflow on top of. Fingerprint hardware
and the Excel export destination are still not real connections — see
"Department operations, break UX, and reporting (Phase 2)" for what
changed and what's still intentionally a boundary.

### Attendance

Employee/Cashier AND Supervisor/Overlooking now share one real live
check-in/check-out flow — `POST /api/attendance/check-in`,
`POST /api/attendance/check-out` — through the exact same
`AttendanceRecord` table and per-day unique constraint every existing
Excel-imported row already used, not a second attendance system.
`AttendanceRecord.employeeId` is now nullable and a new
`AttendanceRecord.staffUserId` was added (same dual-nullable-FK
convention already used elsewhere in this schema, e.g.
`Message.senderEmployeeId`/`senderUserId`) — exactly one is set per row,
enforced in the controller. Regional Manager/Admin ("Zone Manager") are
deliberately excluded — neither has a market to check in at.

Supervisor/Overlooking view their own attendance via
`GET /api/attendance/me/month` — a simpler view than the employee-facing
one, since Worker/Cashier-only business rules (extra hours, required
hours, punishment) don't apply to staff attendance.

### Breaks

A new `Break` model (`PENDING_CONFIRMATION` → `ACTIVE` → `COMPLETED`, or
→ `CANCELLED`) — genuinely new, not a reuse of the existing
`AttendanceRecord.breakStart`/`breakEnd` pair, which has no state,
confirmation step, or race-condition guarantee. `startTime`/
`expectedEndTime` (always +60 minutes) are set server-side the moment a
break is confirmed; every read recomputes `remainingSeconds` fresh from
those timestamps — the frontend never stores or decrements a countdown
itself, so a refresh, a second tab, or reopening the app all show the
same number.

**Race safety**: at most one `PENDING_CONFIRMATION`/`ACTIVE` break per
employee (or per staff user) is enforced by a partial unique index added
by hand in that migration's `migration.sql` (Prisma's schema language
can't express a `WHERE` clause on `@@unique`) — this is the real
guarantee against two near-simultaneous requests both succeeding, not
just an application-level check.

**State machine**: no endpoint accepts a raw `status` field from the
client. `PATCH /api/breaks/:id/confirm` always transitions
`PENDING_CONFIRMATION → ACTIVE` and nothing else, regardless of what the
request body contains — verified by an automated test that deliberately
sends `{"status":"COMPLETED"}` and asserts the break becomes `ACTIVE`
anyway.

`POST /api/breaks` (ADMIN-only) is the controlled manual/test entrypoint
for creating a break in place of real hardware — see the fingerprint
section below.

### Fingerprint integration boundary

**Not connected to any real hardware.** `backend/src/services/fingerprintAdapter.js`
is the boundary a real integration will plug into later: one function,
`ingestFingerprintEvent(payload)`, that a future webhook/polling job
would call with a normalized event
(`externalEventId`, `employeeCode`, `eventType`, `eventTimestamp`,
`sourceDeviceId`) — idempotent on `externalEventId` so a retried
delivery never double-processes the same physical scan. A new
`FingerprintEvent` model records every event received, `rawPayload`
preserved verbatim. `POST /api/fingerprint-events` (ADMIN-only) is the
controlled test entrypoint standing in for a live connection during
development — see that route/controller's own comments for exactly what
changes once real hardware/API details exist.

### Excel integration boundary

The **inbound** direction (the company's Excel export → TeamMart) already
existed before this phase — `AttendanceImportBatch` +
`AttendanceSource.IMPORT` + `POST /api/attendance/import` — untouched.

The **outbound** direction (TeamMart → the company's Excel system) is new
and is a boundary only, same as fingerprint above: `backend/src/services/excelExportAdapter.js`
shapes break/attendance data into the flat row structure a future export
will need (employee id/name/role, market, date, break start/end,
duration, status) — `GET /api/attendance/break-export-preview` (ADMIN-only)
returns those rows as JSON so the shaping logic can be verified today.
**No real destination is connected** — nothing here writes a file,
calls an API, or assumes Microsoft Graph/SharePoint/OneDrive. What a
real destination will need once chosen: the target (API+auth, SFTP,
shared path, or scheduled email), the expected file format/column
order on their side, and whether it's push or pull.

### Department assignment (already existed — verified, not rebuilt)

`Employee.department` (denormalized current value) +
`DepartmentAssignment` (append-only history, `assignedById`) already
correctly implemented every authorization rule this phase asked for
(employee sees only their own, Supervisor/RM/Admin scoped via the same
`assertMarketAccess` every other market-scoped endpoint uses, and an
employee/market mismatch is structurally impossible since the
department is always assigned against the employee's own real
`marketId`, never a client-supplied one) — confirmed by inspection and
now covered by automated tests, not changed.

### Department Closing (extends the existing Activity model)

A new `Activity.category = "DEPARTMENT_CLOSING"` — reuses the existing
Activity/ActivityImage architecture rather than a parallel model (one
source of truth: the same record Employee "My Activity", Supervisor
market monitoring, and Phase 2/3 reporting will all read from). New
fields: `Activity.department`, `Activity.submittedByStaffId` (null =
employee self-submitted; set = an authorized Supervisor submitted on
their behalf, via the new `POST /api/activities/department-closing/:employeeId`,
scoped by the same `requireAccessibleEmployee` every other
staff-on-behalf-of-an-employee endpoint uses).

**Photo retention**: `ActivityImage.expiresAt` — set to 16 hours from
submission for `DEPARTMENT_CLOSING` images only (every other Activity
category's images stay permanent, unchanged). The actual cleanup job
that acts on this field is Phase 2 work — see below; this phase only
established the timestamp reliably.

**Safe replace**: `PATCH /api/activities/:id/images/:imageId` — replaces
an image in place (ownership + editable-status checked exactly like
every other mutation on the activity), deletes the old physical
file/`UploadedFile` row so nothing is orphaned, and recomputes
`expiresAt` fresh from the replacement time. `DELETE .../images/:imageId`
now does the same physical-file cleanup it didn't do before.

**File privacy**: Department Closing photos need zero new authorization
code — they're `ActivityImage` rows like any other Activity category, so
the existing `GET /api/uploads/:filename` authorization (from the prior
security-hardening phase) already covers them correctly, verified by a
dedicated automated test.

## Department operations, break UX, and reporting (Phase 2)

Built the complete operational workflow on top of Phase 1's foundation.
Local disk storage, no fingerprint hardware, and no real Excel
destination remain unchanged — see Phase 1 above for what those
boundaries mean and why they're intentional.

### Reliable break completion and photo expiry — a real maintenance sweep

This app had no scheduler/job infrastructure at all (checked before
adding one). `backend/src/jobs/maintenanceScheduler.js` adds the minimal
mechanism actually appropriate here: a `setInterval` inside the same
Node process (break completion every minute, photo expiry every 15
minutes) — no new dependency, no new service to deploy. Both sweep
functions are exported and safe to call directly too (used by the
automated tests, and available for a real cron/process-manager trigger
later if this ever needs to run outside the API process).

Both sweeps are **idempotent and partial-failure-safe**: the break sweep
re-checks `status: "ACTIVE"` inside the actual update (not just the
initial read) so a break confirmed/cancelled by its owner in the exact
same moment isn't clobbered; the photo sweep processes one image at a
time with its own try/catch, so one bad row (already-missing file,
already-missing `UploadedFile` row) never blocks the rest of the sweep —
confirmed by tests that run each sweep twice in a row and assert the
second run does nothing.

A break's own lazy-on-read completion from Phase 1
(`breakService.withLazyCompletion`) still exists too — now sharing the
exact same race-tolerant `updateMany`-with-status-guard pattern as the
scheduler, so whichever gets there first (a scheduled tick, or someone
opening a screen) is the one that actually completes it and sends the
one `BREAK_COMPLETED` notification; the other silently no-ops.

### Department Closing — real authorization, not just a UI flow

**The security-critical fix**: Phase 1's Department Closing endpoints
accepted a `department` field from the client. Phase 2 removes it
entirely from every schema an employee/on-behalf-of-employee submission
uses — the department is always the employee's own real,
currently-assigned one, looked up fresh from the database inside
`activitiesController.createActivity`/`createDepartmentClosingForEmployee`.
There is no `employeeId=A, department=B` to even attempt anymore.

**Genuinely unassigned departments** (spec: "Dairy — Unassigned — Needs
Supervisor") needed a real architectural extension: `Activity.employeeId`
is now nullable, with a new `Activity.marketId` used instead when a
Supervisor completes a department with no employee at all
(`submittedByStaffId` is the sole owner) — same dual-nullable-FK
convention `AttendanceRecord.staffUserId` already established in Phase
1. `GET /api/uploads/:filename`'s authorization and the market-scoped
activity list were both updated to recognize this second ownership
shape — found and fixed via the automated test suite, not shipped
untested.

New `MarketDepartment` model — the per-market department **catalog**,
genuinely new in Phase 2 (nothing like it existed before): required
because "which departments does this market track" cannot be derived
from current `DepartmentAssignment` rows alone (an unassigned department
has no assignment row to derive it from). Auto-registered the first time
a department name is actually used (an assignment, or a submission), or
added explicitly via `POST /api/markets/:id/departments` for a
department that should be tracked before anyone is assigned to it. This
is what Department Completion counts against — never a hardcoded
number.

### Market Department Monitoring, completion, and the Final Report

`GET /api/markets/:id/departments` and `.../departments/completion`
(`departmentMonitoringService.js`) derive everything live from
`MarketDepartment` + current `DepartmentAssignment` + today's
`DEPARTMENT_CLOSING` Activity rows — no separate display table, per
Phase 2's own "one source of truth" requirement.

`POST /api/markets/:id/department-report` (the Supervisor's "Send
Department Report"):
- **Re-validates completion server-side** — never trusts a
  frontend-computed count.
- Requires an explicit `override: true` + a reason to send while
  incomplete; both are recorded on the resulting `DepartmentReport` row.
- A new `DepartmentReport` model's `@@unique([marketId, date, shift])`
  is the real guarantee against two concurrent "Send Report" requests
  both succeeding — the same partial-unique-index philosophy as Break's
  one-active-break guarantee in Phase 1, just without needing a `WHERE`
  clause since every row here represents an actually-sent report.
- **Posted through the existing chat system** — the market's own
  `MARKET_GROUP` conversation (`chatController.findOrCreateChannel`,
  exported and reused, not duplicated) — never an invented "Zone group".
  Chat itself was not redesigned; this only adds one more caller of an
  endpoint/helper that already existed.

### Notifications

Reuses the existing `Notification` model — no second notification
system. New `DEPARTMENT_CLOSING_SUBMITTED` type notifies the market's
Supervisor/Overlooking (whichever accounts exist) the moment a
submission is created, scoped to that market only — verified by a test
asserting an unrelated market's Supervisor receives nothing.
`BREAK_COMPLETED` (added to the schema in Phase 1, unused until now) is
sent exactly once per break, from whichever path (sweep or lazy-on-read)
actually performs the transition.

### Frontend

Employee: **My Activity → Department Closing** — shows the employee's
own real department (never a picker), reuses the existing
`EvidenceCapture` take/preview/retake component unchanged, submits
through the same activity architecture. `AttendanceCheckInCard`
(Phase 1) now shows the full break lifecycle: pending confirmation →
active with a live "ends at HH:MM, remaining M:SS" (server-computed,
polled every 15s, correct across refresh/reopen/multiple tabs) →
briefly shown as completed.

Supervisor: **Market → Department Monitoring** — per-department
assigned employee/state/last-submission/photo-availability, a
"Complete This Department" action on unassigned rows, backend-computed
completion count with the missing list, and "Send Department Report"
(with the override flow when incomplete). All in the existing Market
tab, not a separate screen/application.

## Chat organization, Important People, and Groups (Phase 3)

Phase 3 does not add a second chat system — Important People, Groups,
Individuals, and Unread are four **views** computed over the exact same
`Conversation`/`Message`/`ConversationMember`/`ConversationRead` tables
Chat already used (same "one source of truth" principle as Phase 2's
Department Closing). A conversation can legitimately appear in more than
one view at once (e.g. an unread group chat shows up under both Groups
and Unread).

### Database changes

- `ConversationType` gained `STAFF_DIRECT` — the one 1:1 shape that
  didn't exist yet: a real conversation between two **staff** accounts
  (e.g. a Regional Manager and an Admin/"CEO"). `DIRECT` is
  Employee-only and `SUPERVISOR_DIRECT`/`RM_DIRECT` are always
  Employee↔staff, so there was previously no way for two staff accounts
  to message each other at all. `Conversation` gained
  `staffParticipantBId` (mirrors the existing `participantA`/
  `participantB` employee-pair pattern) and a `@@unique([type,
  staffParticipantId, staffParticipantBId])` constraint, with pair
  ordering (lower id first) enforced in `chatController.staffDirectPair`
  — same convention as the existing employee `directPair`.
- `Conversation.groupType` (`GroupType`: `NORMAL` | `WARNING`) — a
  `CUSTOM_GROUP` is either a standard group or an announcement group
  where only group admins can post. Both variants use the same
  `Conversation`/`Message`/`ConversationMember` rows; `groupType` is the
  only thing that distinguishes them, never a separate table.
- `ConversationRead` — previously employee-only (`employeeId` was
  required). Extended with the same dual-nullable-FK convention used
  everywhere else in this schema (`AttendanceRecord`, `Break`):
  `employeeId` is now nullable, `staffUserId Int?` was added with its own
  `@@unique([conversationId, staffUserId])`, so unread/pin/mute tracking
  now works for Supervisor/Overlooking/Regional Manager/Admin too, not
  just employees.
- `ImportantContact` (new) — a staff owner's personal, reorderable
  contact shortlist: `ownerUserId` (always staff), a dual-nullable
  target (`contactUserId` OR `contactEmployeeId`), and `priority` for
  ordering. **Purely organizational** — see Security below.

### API changes

- `GET /api/conversations/staff-contacts` — staff-only, backend-filtered
  list of staff accounts this caller may start a real 1:1 with (never
  every staff account in the company).
- `GET /api/conversations/staff-contacts/:userId` — get-or-create the
  `STAFF_DIRECT` conversation with an authorized staff contact.
- `GET/POST/PATCH/DELETE /api/conversations/important-people[/:id]` —
  Important People CRUD, always scoped to the caller's own
  `ownerUserId`.
- `GET /api/conversations/organized` — the single aggregator behind the
  four views (`importantPeople`, `groups`, `individuals`, `unread`),
  built from the exact same shaped list each caller's existing inbox
  endpoint (`/conversations`, `/conversations/staff`, `/conversations/rm`)
  already returns — never a second, possibly-drifting query.
- `POST /api/conversations/groups` gained an optional `groupType`
  (`"NORMAL"` default, `"WARNING"`).
- `POST /api/conversations/:id/messages` now 403s a non-admin poster in
  a `WARNING`-type group (reuses the existing `ConversationMember.isAdmin`
  concept — no new role/permission system).
- `POST /api/conversations/:id/read` and `PATCH
  /api/conversations/:id/preference` now persist for staff callers too
  (previously a silent no-op for anyone but an employee).

### Security

- **Important People is never an authorization mechanism.** Favoriting a
  contact (`ImportantContact`) is checked against the exact same
  eligibility function used to create the underlying conversation
  (`authorizedStaffContactsFor` / `requireAccessibleEmployee`) — a
  favorite can never outlive or bypass the real authorization, and
  removing a favorite never touches the conversation or its history.
- **Staff-to-staff contact eligibility is conservative and role-based**
  (TeamMart has no separate "CEO" role — `StaffRole` is `ADMIN` /
  `REGIONAL_MANAGER` / `SUPERVISOR` / `OVERLOOKING_SUPERVISOR`): a
  Regional Manager may contact any `ADMIN`; a Supervisor/Overlooking
  account may contact their own zone's Regional Manager(s) plus any
  `ADMIN`; an Admin may contact anyone. This is documented as the
  conservative default the spec asked for where the exact policy was
  ambiguous.
- **`GET /api/conversations/organized` never fetches everything and
  filters client-side** — it reuses the same backend-filtered,
  permission-checked query each account kind's existing inbox endpoint
  already runs.
- Opening the Chat page (or `/organized`) still never marks anything
  read — only `POST /:id/read` (an explicit "I opened this
  conversation" action) does, unchanged from before Phase 3.
- Removing a member, or a Group Admin demoting/removing another admin,
  never deletes historical messages — unchanged from the existing group
  model.

### Frontend

`CreateGroupModal`/`RmCreateGroupModal` gained a Normal/Announcement
group-type selector. A new `ImportantPeopleSection` (shared by
`SupervisorChatTab` and `RmChatPage`) lists a staff account's authorized
contacts, lets them star/unstar (organizational only), and opens a real
`STAFF_DIRECT` conversation on tap. Conversation rows now show a real
unread-count badge for staff, sourced from the same `unreadCount` field
the employee side already had.

## Master Admin — company-wide visibility and administrative control (Admin Phase 1 & 2)

Uses the existing `ADMIN` role throughout — no `ZONE_MANAGER` or second
administrative role was created. Regional Manager stays zone-scoped
everywhere; every company-wide endpoint below is `ADMIN`-only.

### Provisioning

`npm run admin:provision` (`backend/scripts/provisionAdmins.js`) creates
the two real Admin accounts from environment variables
(`ADMIN_1_NAME`/`ADMIN_1_EMAIL`/`ADMIN_1_PASSWORD`, `ADMIN_2_*` — see
`.env.example`). Passwords are never hardcoded, logged, or committed;
the script is idempotent and never overwrites an existing account.

### Company-wide visibility (Phase 1)

`GET /api/admin/overview` (real zone/market/employee/staff-role counts),
`GET /api/admin/search` (backend-filtered employee/market/zone search),
`GET /api/attendance/company` and `GET /api/activities/company`
(company-wide, unscoped — new endpoints; every other attendance/activity
endpoint stays single-employee or single-market). Zones/Markets/
Employees lists reuse the existing `listZones`/`listMarkets`/
`listEmployees` endpoints, which were already unscoped for an `ADMIN`
caller. Frontend: `AdminHomeTab`, `AdminEmployeesPage` (Staff Accounts +
Workforce, two real views over the two real tables — never merged into
one fake structure), `AdminAttendancePage`, `AdminActivitiesPage`, a
read-only `AdminEmployeeProfilePage` (reuses `RmEmployeeProfile`
unchanged), and `AdminChatPage` (existing Chat system, unmodified).

### Administrative control (Phase 2)

**The core architectural problem**: a staff account (`User`, Int id) and
an employee account (`Employee`, String cuid id) are different identity
spaces — dozens of tables reference "whichever one this belongs to" via
a dual-nullable-FK pair (`employeeId` OR `staffUserId`/`senderUserId`/
etc.), not a single polymorphic owner. Promoting a Worker to Supervisor
can't safely be "change a role field" — that would either require an
impossible id-space merge or silently orphan every historical
Activity/AttendanceRecord/Message row still pointing at the old
`employeeId`. So promotion/demotion is a **linked identity transition**:
a new row is created in the target table (`User.promotedFromEmployeeId`
/ `Employee.demotedFromUserId`, both `@unique`), the old row is
deactivated (`accountStatus: SUSPENDED`) but **never deleted**, and every
past historical record stays exactly where it was.

- **Role change** (same-table: Supervisor ↔ Regional Manager ↔
  Overlooking Supervisor ↔ Admin) — `POST /api/admin/staff/:userId/role`,
  transactional: clears every stale old-role relationship (market/zone
  ownership) before applying the new one. Supervisor/Overlooking require
  `marketId`; Regional Manager requires `zoneIds` (RMs can manage
  multiple zones — preserved, not flattened to one).
- **Promote/demote** (account-type-crossing) —
  `POST /api/admin/employees/:employeeId/promote` and
  `POST /api/admin/staff/:userId/demote`, both transactional. An Admin
  account can never be demoted.
- **Assignment**: market/shift/department changes reuse the *existing*
  `PATCH /api/employees/:id` and `POST /api/employees/:id/department`
  endpoints (already ADMIN-accessible) — not duplicated. Supervisor
  market reassignment reuses `PATCH /api/markets/:id/supervisor`, fixed
  in this phase to clear the stale prior market assignment transactionally
  (it previously could crash on a unique-constraint violation). Regional
  Manager zone reassignment: new `POST /api/admin/staff/:userId/zones`
  (full-replace, preserves multi-zone).
- **Employee ID**: reuses the existing `updateEmployee` uniqueness check.
  Staff `loginId`: new `PATCH /api/admin/staff/:userId`.
- **Password reset**: `POST /api/admin/{employees,staff}/:id/reset-password`
  — hashes server-side, never returns or logs the plaintext, always bumps
  `tokenVersion`.
- **Account status** (Suspend/Ban/Reactivate) — new `AccountStatus` enum
  (`ACTIVE`/`SUSPENDED`/`BANNED`) added to both `User` and `Employee`,
  **deliberately separate** from `Employee.employmentStatus` (an HR
  concept — the two can disagree, e.g. suspended-pending-review but
  still employed).
- **Session invalidation**: JWTs are stateless, so a DB change alone
  can't revoke an already-issued token. Both `User` and `Employee`
  gained `tokenVersion` (embedded in every JWT at sign time);
  `requireAuth` now does one cheap lookup per request comparing the
  token's version against the account's current one, and rejects a
  non-`ACTIVE` account outright. Bumping `tokenVersion` (password reset,
  suspend/ban, role change) makes every previously-issued token for that
  account stop working on its very next request.
- **Two-Admin safety**: role/count-based, never name-based — every
  status/role mutation that would leave zero `ACTIVE` Admin accounts is
  rejected before any write happens.
- **Chat/notifications**: not redesigned. Chat access is already derived
  from the caller's current token scope (market/zone/role), not a
  snapshot, so forcing re-authentication via `tokenVersion` is
  sufficient for scope-derived access (Market Group, Warnings, RM/
  Supervisor-direct) to update correctly after a role change; explicit
  `CUSTOM_GROUP` memberships are untouched, per spec. Two new
  `NotificationType` values (`ROLE_CHANGED`, `ACCOUNT_STATUS_CHANGED`)
  notify the affected person through the existing notification system.

## Market Visits, Administrative Inspections, Audit Log, and Reports (Admin Phase 3)

### Market Visit / Administrative Inspection

Both concepts share the **existing** `MarketVisit` table (already used by
a Regional Manager's own lightweight visit-grouping flow —
`marketManagementController.createMarketVisit`) rather than a new table —
extended with `adminUserId` (dual-nullable alongside the pre-existing
`regionalManagerId`, same convention as everywhere else in this schema),
`visitType` (`VISIT`/`INSPECTION`), `status`
(`STARTED`/`COMPLETED`/`CANCELLED`), `endedAt`, `adminNotes`. An RM's
plain grouping visit is untouched — it still creates with
`regionalManagerId` set and defaults to `status: COMPLETED` (no
lifecycle). Only an explicit `POST /api/admin/markets/:id/visits`
(never just opening the Market page) creates a real Admin visit/
inspection, with `PATCH /api/admin/visits/:id/complete` and `/cancel`
as the only valid transitions out of `STARTED`. Admin market inspection
reuses `RmMarketOverview.jsx` entirely (`AdminMarketDetailPage.jsx` just
adds the Visit/Inspection action bar on top) — no duplicate Market UI.

### Audit Log

New `AuditLog` model (none existed before this phase) — append-only by
omission: no route anywhere updates or deletes a row. Every Phase 2
mutation (role change, promote/demote, password reset, suspend/ban/
reactivate) and every Phase 3 visit/inspection transition writes one row
via the single `utils/audit.js:recordAudit` function, which actively
strips any password/hash/token-shaped key before writing. Routine
Supervisor/RM edits through shared endpoints (e.g.
`PATCH /api/employees/:id`) are only audited when the actual caller is
`ADMIN`, so the log stays a real administrative-accountability record
rather than a firehose of ordinary staff activity. `GET /api/admin/audit`
is paginated and filterable (actor/action/target type/market/zone/date
range).

### Reports

`GET /api/admin/reports/summary` — real aggregate queries (never
fabricated) over Attendance (today), Activities/Visits/Audit actions (a
date range, default last 30 days), optionally scoped to one market or
zone.

### Security

- `startMarketVisit`/`completeMarketVisit`/`cancelMarketVisit` are
  ADMIN-only and ownership-checked (`adminUserId` must match the caller)
  — a second Admin cannot complete/cancel a visit they didn't start.
- Malformed/nonexistent market/visit ids return a clean 404, never a
  raw database error.
- A found-and-fixed test-infrastructure bug during this phase: running
  the full suite with Node's default test-file concurrency let two
  different test files' two-Admin-safety tests race each other's shared
  Admin fixtures (one file's "quarantine every other active Admin"
  step could suspend another file's Admin mid-run). Fixed by running
  `npm test` with `--test-concurrency=1` (serial test files) — the
  smallest correct fix, not a rewrite of the safety logic itself, which
  was already correct in isolation.

## Security tests

`backend/test/security/` — a focused suite covering the authorization
boundaries that matter most: employee-to-employee isolation, Supervisor
market isolation, Regional Manager zone isolation (including IDOR
attempts via URL/body id manipulation), Admin-only endpoints, the full
file-download authorization matrix (owner/non-owner/same-market
staff/other-market staff/owning RM/outside RM/Admin/unauthenticated),
cross-role attendance, the break state machine (including the race-safe
one-active-break guarantee and the "can't skip a state" check), and
department assignment/closing (Phase 1); the maintenance sweeps (break
completion and photo expiry, including idempotency on repeated runs),
department monitoring/completion accuracy, the unassigned-department
ownership path, and the Final Report's completion
validation/override/duplicate-prevention (Phase 2); and — as of Phase 3
— Important People/`STAFF_DIRECT` authorization (including IDOR on
staff-contact and important-people ids), the WARNING-group posting
restriction, and staff unread tracking through the `/organized`
aggregator.

Uses Node's built-in test runner — no new dependency was added. Run it
from `backend/`:

```bash
npm test
```

Every row this suite creates is tagged with a random per-run suffix and
deleted again once the suite finishes, so it's safe to run against your
normal dev database. For real isolation, set `TEST_DATABASE_URL` in
`backend/.env` to a separate database (e.g.
`postgresql://user:password@localhost:5432/teammart_test`) and the suite
uses it automatically instead. The suite never runs a migration reset or
truncates a table — only creates and deletes its own tagged rows.

## Development roadmap

1. ~~Backend: Employee module (profile fields, Activity model, Activity
   endpoints)~~ — done.
2. ~~Frontend: connect the Employee role to the real backend~~ — done.
3. ~~Employee module polish pass~~ — done.
4. ~~Backend + Frontend: Cashier role, Sudden Tasks, Attendance/Leave
   Requests, Chat, Notifications, Supervisor Mode~~ — done.
5. ~~Frontend: real routing/browser-history navigation across Employee,
   Cashier, and Supervisor workspaces~~ — done.
6. ~~Backend: real file-upload endpoint for photos~~ — done, see "File
   storage" above.
7. ~~Backend + Frontend: Regional Manager module, mobile-first UI~~ — done.
8. ~~Backend + Frontend: Admin module — Zones/Markets/Staff management~~ — done.
9. Real performance-score calculation (Profile currently shows Attendance
   Rate and Approved/Rejected activity rate — both real — but no single
   composite "performance score" exists yet).
10. Move file storage from local disk to a real object storage provider
    (S3-compatible or Cloudinary) for production deployment — see "File
    storage" above for the exact swap point. **Not done yet** — local
    disk is intentional for the current phase.
11. ~~File authorization (private files, ownership-based access) +
    automated security test suite~~ — done, see "File storage" and
    "Security tests" above.
12. Broader automated test coverage beyond the security-critical
    boundaries (the current suite is deliberately focused, not
    exhaustive) — e.g. business-logic correctness tests, not just
    authorization.
13. ~~Phase 1: cross-role attendance (Employee/Cashier + Supervisor/
    Overlooking, one shared check-in/check-out system), Break
    state-machine foundation, fingerprint/Excel-export integration
    boundaries, Department Closing (extends Activity), 16h photo
    retention metadata~~ — done, see "Cross-role attendance, breaks, and
    department foundation" above.
14. ~~Phase 2: reliable break completion (a real maintenance sweep, not
    just lazy-on-read), reliable 16h photo cleanup, the complete
    employee Department Closing workflow, Supervisor Market Department
    Monitoring/completion tracking, the Final Department Report
    (backend-validated completion, override, duplicate-prevention,
    posted through the existing chat system)~~ — done, see "Department
    operations, break UX, and reporting" above.
15. Real fingerprint hardware connection — still not done, intentionally
    (no verified API/protocol access exists yet). Excel export to a real
    destination — still not done, intentionally (no destination details
    provided yet). Both boundaries remain exactly as documented above,
    ready for whichever real integration is confirmed later.
16. **Phase 3 (not started)**: the chat system redesign — explicitly out
    of scope for Phase 1 and Phase 2, untouched by either.
