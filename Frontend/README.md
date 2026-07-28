# TEAMMART — Market Management Dashboard (Front End)

Front end for TEAMMART, built with React + Tailwind CSS. The **Employee**
role (login, profile, daily activity log) is now connected to the real
backend via `src/services/`. Regional Manager and Supervisor still run on
mock data in `src/data/mockData.js` — that part hasn't been migrated yet.

## Getting started

```bash
npm install
cp .env.example .env   # points the app at the backend, defaults to localhost:4000
npm run dev
```

Then open the printed local URL in your browser. The backend
(`../backend`) must be running for the Employee role to work — see its
README for setup.

## Project structure

```
src/
  components/
    common/     Logo, StatusPill, Modal, PhotoEvidence, SkeletonCard
    layout/     Sidebar, Header, Breadcrumb — app chrome
    zones/      ZoneCard, ZoneGrid — zone-selection screen
    markets/    MarketCard, MarketGrid — market list inside a zone
    market/     EmployeePanel, EmployeeMiniCard, MarketMap, DepartmentTile,
                ActivityPanel, CartonCapacityCard — Market Dashboard pieces
    employee/   ProfileHeader, PerformanceCards, ActivityCalendar,
                DayDetailPanel, ActivityTimeline, SearchFilterBar,
                StatsSection — Employee Profile pieces
  pages/
    Dashboard.jsx        First screen: choose a zone
    ZonePage.jsx          Markets inside the selected zone
    MarketDashboard.jsx   Employees / Store Map / Today's Activities / Carton Capacity
    EmployeeProfile.jsx   Header / performance cards / calendar / timeline / stats
  data/
    mockData.js       Zones + markets — still mock, used by Regional Manager/Supervisor (not migrated)
    constants.js       Shared vocab: roles, shifts, departments, activity types
    marketData.js       Generates employees/departments/today's-activities/capacity per market (mock, RM/Supervisor only)
    employeeData.js      Generates performance stats, monthly calendar, timeline, chart series (mock, RM/Supervisor's Employee Profile view only)
    workspaceData.js     Static (not mock) config: the 6 Activity categories shown in the Employee Workspace
    auth.js               Prototype RM/Supervisor login checks (not migrated); Employee login moved to services/authService.js
  services/
    apiClient.js         The one place that knows the API base URL, attaches the JWT, and turns failed responses into errors
    authService.js        POST /api/auth/employee-login
    profileService.js      GET /api/profile
    activityService.js     GET/POST/PATCH/DELETE /api/activities (+ image endpoints)
  App.jsx           Page shell + state-based navigation + session persistence
  main.jsx          React entry point
  index.css         Tailwind + brand tokens + animation keyframes
```

## Navigation

Currently uses simple `useState` page switching in `App.jsx` (no router
dependency). It's built to map 1:1 onto real routes:

| State page | Future route |
|---|---|
| `dashboard` | `/` |
| `zone` | `/zones/:zoneId` |
| `market` | `/zones/:zoneId/markets/:marketId` |
| `employee` | `/employees/:employeeId` |

Full flow: **Dashboard → Zone → Market → Market Dashboard → Employee → Profile.**

Swap in `react-router-dom` (or your framework's router) by replacing the
`useState`/`setPage` calls with `<Route>` elements — the page components
themselves don't need to change.

## Mock data generators

`marketData.js` and `employeeData.js` use a small seeded-random helper
(`seededRandom` in `constants.js`) so every employee/market always renders
the same numbers across reloads, instead of re-randomizing on every render.
When you're ready to connect a backend, replace the generator functions'
bodies with real fetch calls — the shape of what they return is what the
components already expect, so the components themselves don't need to change.

## What's still UI-only (by design, per the brief)

- No image uploads — `PhotoEvidence.jsx` renders "Before/After" placeholders
  that open in a modal viewer.
- Charts in `StatsSection.jsx` are lightweight CSS bar/donut placeholders
  fed by generated numbers — no charting library dependency was added.
- "Storage Full" state shows the UI warning only; no notification is sent.
- Photo retention (8h for daily condition photos, 30 days for employee task
  photos) is displayed as a countdown label only — nothing is actually
  deleted. Task *metadata* (date, employee, type, approval) is treated as
  permanent even after a photo would expire, matching how most enterprise
  workforce systems separate media retention from record retention.

## Latest update: fixed roster, department detail, task approvals

- Every market now has a **fixed 10-person roster** (`MARKET_ROSTER` in
  `constants.js`): 1 Supervisor, 1 Storekeeper, 3 Cashiers, 2 Butchers,
  3 Workers — with one Worker also carrying a secondary "Assistant" role
  (`employee.secondaryRole` / `employee.displayRole`).
- Clicking a department on the Store Map now opens
  `DepartmentDetailPanel.jsx`: assigned employee (top), latest condition
  photo (left), latest activity counts (right), and who actually completed
  the last task (bottom) — deliberately separate from "assigned," since
  another employee may have helped out.
- Employee activities now carry `approvedBy` (Market Manager or Supervisor)
  and only show Before/After photos for tasks in `PHOTO_REQUIRED_TYPES`
  (Customization, Shelf Cleaning, Facing) — other task types don't get
  photo slots.
- The **Completed Tasks** performance card is now clickable and opens
  `CompletedTasksModal.jsx` with the employee's full completed-task history,
  including who approved each one.

### About the map redesign

Redesigned to match the reference floor-plan image you sent: an 8-column x
9-row grid with WC and Manager Office as dark decorative blocks up top, an
Entrance strip, and repeated department types (two "Non Food 1" zones, two
"Snacks" zones, two checkout counters) that are physically separate shelf
runs — each has its own `id` in `DEPARTMENT_LAYOUT` so it can be assigned
and tracked independently even though the label repeats. WC/Office/Entrance
are decorative (not clickable); every real department opens the detail
panel on click.

## Design tokens

| Token | Value | Usage |
|---|---|---|
| Deep Navy | `#1D2D5C` | card surfaces, avatar gradients |
| Orange | `#F47A20` | primary accent, CTAs, active states |
| Dark Gray | `#1A1A1A` | app background |
| Light Gray | `#E8E8E8` | secondary text on light surfaces |

Fonts: **Plus Jakarta Sans** (display/headings), **Inter** (body/UI).

## Logo

No logo file was supplied, so `src/components/common/Logo.jsx` renders a
wordmark badge built from the brand tokens. Once you have the real TEAMMART
logo asset, drop it in `public/logo.svg` and swap the badge `<div>` in
`Logo.jsx` for an `<img src="/logo.svg" alt="TEAMMART" />` — no other files
need to change.

## Adding future pages

The sidebar (`src/components/layout/Sidebar.jsx`) already lists the planned
sections (Markets, Employees, Reports, Settings) as disabled items. To add
a new page:

1. Create `src/pages/YourPage.jsx`.
2. Add a route/page-state entry in `App.jsx`.
3. Flip that item's `active: true` in `Sidebar.jsx`'s `NAV_ITEMS`.

Planned pages this structure supports without rework: Employee Profile,
Market Dashboard, Daily Activities, Expired Items, Labels, Cleaning, Shelf
Customization, Reports, Notifications.

## Role-based login

The app opens on `LoginPage.jsx`, not a dashboard. Flow: **role → location
(if applicable) → password → session**.

| Role | Location step | Auth |
|---|---|---|
| Regional Manager | Pick your zone | Still prototype/hardcoded — `RM<zoneNumber>12` (see `src/data/auth.js`). Not migrated yet. |
| Supervisor | Pick your market | Still prototype/hardcoded — **SP201**. Not migrated yet. |
| Employee | Enter your employee code | **Real** — `POST /api/auth/employee-login` via `services/authService.js`. The old "browse a directory, then type a shared demo password" flow was removed: the real backend has no public employee directory and each employee has their own private password, so a plain code + password form (like any normal login) replaced it. |

Each role gets a genuinely different shell, not just a filtered view:

- **Regional Manager** — full `Sidebar` + `Header`, lands on their own
  `ZonePage`, can drill into any market/employee inside their zone only.
  Never sees other zones. (Still mock data.)
- **Supervisor** — same shell minus the "Zones" nav item, lands directly on
  their one `MarketDashboard`. Breadcrumbs skip the zone level entirely.
  (Still mock data.)
- **Employee** — completely different, simpler shell: no `Sidebar` at all,
  just `Header` + `EmployeeWorkspace` (their real profile, a grid of
  submittable daily-activity categories, and a Draft/Pending/Completed/
  Approved/Rejected activity history — all from the backend).

An Employee session survives a page refresh: the JWT is kept in
`localStorage` and `App.jsx` re-validates it against `GET /api/profile` on
load instead of trusting anything cached client-side.

## Employee daily activities (connected to the backend)

`EmployeeWorkspace.jsx` now talks to `GET/POST/PATCH/DELETE /api/activities`
via `services/activityService.js`, replacing the old mock
`generateSeedTasks()`. The 6 submittable categories in
`data/workspaceData.js` (`ACTIVITY_SUBMISSION_OPTIONS`) match the
backend's `ActivityCategory` enum exactly — the old 8-option list (Facing,
Refilling, Department Photo, Waste Items, ...) was copied from a different
backend model (`Task`) and didn't line up, so it was replaced rather than
kept.

An activity can be saved as a **Draft** or **submitted for review**
(status `PENDING`). Editing is only allowed while a Draft or Pending;
deleting is only allowed while a Draft (and always asks for confirmation
first) — the UI mirrors rules the backend itself enforces, so there's no
dead-end button that 400s when clicked.

**Known limitation — photo uploads:** there is no file-storage endpoint on
the backend yet (no S3/Cloudinary/disk-upload route). Photos you attach
are converted to base64 "data URLs" in the browser and sent as the
`ActivityImage.url` string directly — this works today with zero backend
changes, but stores the whole image as text in the database, which doesn't
scale. Replace this with a real upload endpoint before this screen sees
regular use.
