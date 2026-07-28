# Frontend Architecture (short version)

This covers how the Employee-facing part of the app is wired together.
For setup/run instructions see [../README.md](../README.md); for what's
mock vs. real, see its "Current project status" section.

## Folder structure (Employee-relevant parts)

```
src/
  services/            The only code allowed to call the backend
    apiClient.js          fetch wrapper: base URL, auth header, error shape
    authService.js         POST /api/auth/employee-login
    profileService.js      GET /api/profile
    activityService.js     /api/activities (CRUD) + image handling
  data/
    activityRules.js      Which Activity statuses are editable/deletable
    workspaceData.js       Static list of the 6 Activity categories
    auth.js                 Regional Manager / Supervisor mock login (not migrated)
  utils/
    initials.js            "Shalaw Naji" -> "SN"
  pages/
    EmployeeWorkspace.jsx   The whole Employee screen: profile + activities
    LoginPage.jsx            role -> location -> password -> session
  components/
    auth/                  Login step components (per-role)
    workspace/              SubmitTaskModal, TaskStatusTabs, TaskSubmissionGrid
  App.jsx                 Session state, routing-by-state, session restore
```

## The service layer

Nothing outside `src/services/` calls `fetch` directly. The chain is
always: **component → service function → `apiRequest` (in apiClient.js) →
backend**.

- `apiClient.js` is the only file that knows the API base URL, attaches
  `Authorization: Bearer <token>`, and turns a failed HTTP response into
  a thrown `ApiError` (with `.status` and `.message`). Every service
  function is a thin, named wrapper around one backend endpoint — e.g.
  `activityService.deleteActivity(id)` is just
  `apiRequest(`/activities/${id}`, { method: "DELETE" })`.
- Why bother with this layer instead of `fetch()` in components? Because
  "attach the token," "handle a 401," "parse the error JSON" would
  otherwise be copy-pasted into every component that talks to the
  backend. One change to auth handling (e.g. refresh tokens later) means
  editing `apiClient.js` once, not every page.

## Authentication flow

1. **Login** — `LoginPage.jsx` collects an employee code + password, calls
   `authService.employeeLogin()`, which calls `POST /api/auth/employee-login`
   and stores the returned JWT in `localStorage` (via `apiClient.setToken`).
2. **Every later request** — `apiClient.apiRequest()` reads the token from
   `localStorage` and attaches it automatically. Components never touch
   the token directly.
3. **Page refresh** — `App.jsx` runs once on mount: if a token exists, it
   calls `GET /api/profile` to ask the backend "is this still valid, and
   who is it?" instead of trusting anything cached client-side. Success
   rebuilds the session; failure (expired/invalid token) clears it and
   shows the login page.
4. **Mid-session expiry** — if any request ever comes back `401`,
   `apiClient` calls a callback registered via `onUnauthorized()`.
   `App.jsx` registers that callback to log the user out and return to
   the login page, so an expired token never leaves the user staring at a
   screen full of silently-failed requests.
5. **Logout** — clears the token and all session/navigation state.

## A typical request flow (submitting an activity)

```
SubmitTaskModal (component)
  -> activityService.createActivity(payload)
     -> apiClient.apiRequest("/activities", { method: "POST", body: payload })
        -> attaches Authorization header, fetch()
        -> backend validates + saves
  <- returns the created Activity (or throws ApiError)
EmployeeWorkspace.handleSaved() adds it to local state — no extra GET needed
```

## What's intentionally NOT here yet

Real file uploads (images are Base64 for now — see
`activityService.js`), pagination, Supervisor/Manager/Admin screens, and
push notifications. Each has a `TODO(...)` comment at its most relevant
spot in the code rather than being tracked only in prose.
