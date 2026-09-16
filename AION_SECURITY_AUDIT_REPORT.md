# AION — Production Security Audit & Hardening Report

**Date:** 2026-09-16
**Scope:** Full-stack audit of the existing AION codebase (Express/Node backend, PostgreSQL + Prisma, React/Vite frontend). No architecture, database, or authentication system was replaced. All fixes are additive/corrective and minimal.

---

## 1. Executive Summary

AION's backend was already carrying a mature, deliberately-built security posture from prior hardening work: JWT auth with server-side session invalidation (`tokenVersion`), bcrypt password hashing, a consistent Zod-based input-validation layer that doubles as mass-assignment protection, per-file authorized uploads with magic-byte verification and path-traversal-proof filenames, IP+account-aware rate limiting, and an extensive existing test suite (535 tests) covering role/market/zone isolation, IDOR, and admin-action authorization.

This audit found **no application-level vulnerability requiring a code change** in authentication, authorization, database access, file handling, or input validation — every one of those areas was inspected against real code and, where a test already existed, verified passing. The audit did find and fix **two real, currently-exploitable dependency vulnerabilities** (a high-severity DoS in `multer`, a moderate DoS in `qs`), applied via non-breaking patch upgrades, and identified **three lower-severity dependency vulnerabilities** that require a breaking major-version upgrade and were deliberately left for a separate, scheduled change rather than force-upgraded during a security audit.

Eight new focused security tests were added to close small coverage gaps (self-service role escalation, cross-role admin-endpoint access). All 543 backend tests pass (535 pre-existing + 8 new), the frontend build is clean, and no existing functionality was changed.

---

## 2. What Was Audited

1. API keys & secrets (env handling, frontend exposure)
2. Git secret exposure (tracked files, history)
3. Database security (SQL injection, Prisma usage, mass assignment)
4. Row/record-level access control (IDOR/BOLA across role/market/zone boundaries)
5. Server-side authorization (admin/supervisor/RM/employee operations)
6. Field-level tampering / mass assignment
7. Authentication (password hashing, login, tokens, session invalidation)
8. Session/cookie security (N/A — token-based, see §7 below)
9. Login rate limiting
10. Bot/automated abuse protection
11. Input validation
12. User content / XSS
13. File upload security
14. SQL injection (explicit raw-query sweep)
15. Error handling / information disclosure
16. CORS
17. HTTP security headers
18. Dependencies (backend + frontend `npm audit`)
19. Authorization testing (new + existing)
20. Overall production readiness

---

## 3. Verified Secure

### 3.1 Secrets & Git exposure — 🟢 VERIFIED
- Real `.env` files (`backend/.env`, `Frontend/.env`) are `.gitignore`d and were **never committed** — confirmed via `git log --all --full-history -- backend/.env Frontend/.env` (empty result) and `git ls-files | grep env`, which shows only the two `.env.example` templates are tracked.
- `git grep` across all tracked `.js`/`.jsx`/`.json` for secret-shaped literals (`api_key=`, `secret=`, `password=`, `token=` followed by a 16+ char literal) returned zero real hits — the one match was a test-fixture password (`backend/test/security/adminPhase2.test.js`), not a real credential.
- Frontend exposes exactly one env var to the browser: `VITE_API_URL` (`Frontend/src/services/apiClient.js`, `uploadService.js`) — a public API base URL, safe by design. No API keys, DB credentials, or JWT secret ever reach client code (`JWT_SECRET`/`DATABASE_URL` are read only in `backend/src/**`, never imported by Vite).

### 3.2 Database & SQL injection — 🟢 VERIFIED
- Every backend query goes through Prisma's parameterized query builder. The only raw SQL in the entire backend is `prisma.$queryRaw\`SELECT 1\`` in the health-check endpoint (`backend/src/app.js`) — a literal, non-interpolated string with zero user input.
- No `$queryRawUnsafe`/`$executeRawUnsafe` calls exist anywhere in `backend/src`.

### 3.3 Mass assignment — 🟢 VERIFIED
Audited every `data: req.body` passthrough in the codebase (5 total: `activitiesController.updateActivity`, `marketsController.updateMarket`, `productsController.updateProduct`, `nightShiftController.updateTaskDefinition`, plus the profile endpoints below). In every case, `validateBody(schema)` runs first and **reassigns `req.body = result.data`** (`backend/src/utils/validate.js`), so only the Zod schema's explicitly-declared, whitelisted keys ever reach `req.body` — a client cannot smuggle `employeeId`, `marketId`, `role`, `status: "APPROVED"`, etc. through these routes. Confirmed by reading each schema (`updateActivitySchema`, `updateMarketSchema`, `updateProductSchema`) and by the dedicated comment in `validate.js:372` explaining why `EMPLOYEE_SETTABLE_ACTIVITY_STATUSES = ["DRAFT", "PENDING"]` deliberately excludes `APPROVED`/`REJECTED` ("would let an employee self-approve").
- `profileController.updateMyProfile` goes further than schema whitelisting: it copies individual named fields out of `req.body` one at a time (`if ("profilePictureUrl" in req.body) data.profilePictureUrl = ...`) rather than spreading the whole object — a second, independent layer of protection.
- New test coverage added and passing (see §9): a Supervisor cannot set `role: "ADMIN"` via `PATCH /api/profile`; a Worker cannot set `marketId` to another market via the same endpoint; both attempts are silently dropped, verified by re-fetching the profile afterward.

### 3.4 Authentication — 🟢 VERIFIED
- `bcryptjs` with cost factor 10 for every password path (registration, staff/employee/cashier login) — `backend/src/controllers/authController.js`. No plaintext storage anywhere; `passwordHash` is never selected into any API response.
- JWTs carry `tokenVersion` (`tv`), checked against the account's live DB value on every request (`middleware/auth.js:requireAuth`) — a password reset, suspension, ban, or role change invalidates every previously-issued token immediately, without a stateful session store.
- Account status (`SUSPENDED`/`BANNED`) is enforced server-side on every authenticated request, not just at login.
- Token TTL: 8h standard, 30d for an explicit "Remember me" — both expire via `jsonwebtoken`'s own `expiresIn`, verified in `verifyToken()`.
- Admin-only staff registration (`POST /api/auth/register` requires `requireStaffRole("ADMIN")`) — this is an internal operational tool with no public sign-up, matching the app's actual threat model.

### 3.5 Session/cookie security — ⚪ NOT APPLICABLE (see §7)

### 3.6 Rate limiting — 🟢 VERIFIED
- `authLimiter`: 20 attempts / 15 min, IP-keyed (deliberately never identity-keyed, since a credential-guessing attacker has no valid token to key off — `backend/src/middleware/rateLimit.js`), applied to all four login routes.
- `apiLimiter`: 600 req / 15 min, keyed by verified JWT identity when present (falls back to IP for anonymous/invalid tokens) — this specific design fixes a real prior incident (documented in-file) where IP-only keying let one busy office network exhaust the whole building's shared budget.
- `app.set("trust proxy", 1)` is correctly scoped to exactly one hop, which is what makes IP-based keying meaningful behind a reverse proxy without allowing IP-spoofing via forged `X-Forwarded-For` chains.

### 3.7 File upload security — 🟢 VERIFIED (this is the most heavily hardened subsystem in the app)
- No public static mount for uploads — every read goes through `GET /api/uploads/:filename`, which is authenticated **and** authorized per-file against whichever business record owns it (`fileAuthorization.js`'s resolver list), never "logged in = can read."
- Filenames are exactly `${randomUUID()}.${ext}`, enforced by a strict regex (`SAFE_FILENAME`) before any filesystem or DB access — path traversal (`../`, absolute paths) is rejected before it can touch `path.join`, not merely normalized away. **Tested**: `test/security/fileAuthorization.test.js` ("F: path traversal in the filename param is rejected, not resolved").
- Client-declared MIME type is not trusted alone for images: actual file bytes are checked against known magic-number signatures (JPEG/PNG/GIF/WEBP) before the upload is accepted. **Tested**: same file, "E: a spoofed file signature is rejected."
- `multer` fileFilter whitelists exact MIME types (images, specific audio formats, PDF only) and a 15MB size limit — no arbitrary file type, no unbounded upload size.
- A file that exists in a different requester's business context (different market/zone/user) returns 404 (not 403) when the requester shouldn't even know it exists, and 403 when they should know it exists but aren't authorized — deliberately avoiding an existence-leak side channel.

### 3.8 XSS / user content — 🟢 VERIFIED
- Zero occurrences of `dangerouslySetInnerHTML` anywhere in `Frontend/src` — every piece of user content (chat messages, employee names, notes, announcements) is rendered through React's default JSX text interpolation, which auto-escapes.
- No `eval`, `new Function()`, or other dynamic-code-from-string patterns found in application code.

### 3.9 CORS — 🟢 VERIFIED
- `CORS_ORIGIN` env var drives an explicit allowlist in production; unset in development so the Vite dev server works with zero setup (`backend/src/app.js`).
- `cors()` is called **without** `credentials: true` anywhere — confirmed no cookie-based auth exists at all (see §7), so there is no scenario where an overly-broad origin allowlist could be combined with ambient credentials to enable a cross-site attack.

### 3.10 HTTP security headers — 🟢 VERIFIED
- `helmet()` applied globally (`app.js`) — sets `X-Content-Type-Options`, frame protections, a default CSP, etc. Appropriate defaults for a JSON-only API that serves no HTML from the backend (the CSP directives that matter for an HTML-serving app are moot here since the backend never renders a page).
- File downloads explicitly set `X-Content-Type-Options: nosniff` and a `private` (not shared-cacheable) `Cache-Control`, correct for per-requester-authorized content.

### 3.11 Error handling — 🟢 VERIFIED
- `errorHandler.js` gates `err.message`/stack detail behind `NODE_ENV !== "production"` — production responses are a generic `"Internal server error"` with no filesystem paths, SQL, or internal detail; `console.error(err)` (server-side log only, never in the HTTP response) still preserves full diagnostics for developers.
- Prisma error codes (P2025 not-found, P2002 unique-constraint, P2003/foreign-key) are translated into clean, generic HTTP responses rather than leaking raw Prisma/Postgres error text to the client.
- No password, token, or request-body logging found anywhere in the codebase — the only `console.error` call in the error path logs the error object, never `req.body`.

### 3.12 Row/record-level access control & server-side authorization — 🟢 VERIFIED
This is the single most extensively tested area of the whole app already. Verified by reading `middleware/auth.js` in full (`requireAuth`, `requireStaffRole`, `assertMarketAccess`, `assertZoneAccess`, `staffCanAccessMarket`, `requireOwnEmployeeOrStaff`) and by the passing state of the existing test suite, which specifically targets this boundary:
- `test/security/roleAndScopeIsolation.test.js` — cross-zone/cross-market denial, tampering with `zoneId` in a request body.
- `test/security/adminActionsVerification.test.js`, `adminPhase1/2/3.test.js` — every admin mutation gated correctly.
- `test/security/marketProblems.test.js`, `fileAuthorization.test.js`, `nightShift.test.js`, `workReview.test.js`, `productionChat.test.js`, `groupDelete.test.js`, `messageSeenBy.test.js` — per-feature IDOR coverage across markets/zones/roles.
- `test/security/departmentClosing.test.js`, `test/zoneActivities/zoneActivities.test.js` — RM zone-scoping, added in this session's prior feature work, still passing.
Every important read/write endpoint sampled during this audit (`activitiesController`, `marketsController`, `productsController`, `profileController`, `adminAccountController`, `zoneActivitiesController`) enforces authorization via one of these shared primitives server-side — never a frontend-only check.

---

## 4. Vulnerabilities Found

### 4.1 🟠 `multer` — HIGH severity, multiple DoS vectors
- **Affected component:** File upload middleware (`backend/src/middleware/upload.js`, used by every photo/voice-note/attachment upload endpoint in the app).
- **Affected file(s):** `backend/package.json` / `package-lock.json` (dependency version only — no application code changed).
- **What was wrong:** `multer@2.2.0` (the version in use) is affected by four published advisories: DoS via crafted multipart field names, a file-descriptor leak on aborted uploads, a `fileFilter` race condition that can bypass the file-size limit, and a DoS via oversized array indices in field names.
- **Why it matters:** the upload endpoint (`POST /api/uploads`) is reachable by any authenticated user (staff or employee) — a malicious or compromised account could exploit these to exhaust server resources or bypass the configured 15MB size cap.
- **How it was fixed:** upgraded to `multer@2.4.0` via `npm audit fix` (a non-breaking patch-range bump — `package.json`'s existing `^2.2.0` range already permitted it; only `package-lock.json` changed).
- **Test used to verify the fix:** full existing backend suite re-run post-upgrade (535/535 passing, including all file-upload and file-authorization tests) — confirmed no behavioral change to the upload flow.

### 4.2 🟡 `qs` (transitive, via `express`/`body-parser`) — MODERATE severity DoS
- **Affected component:** Express's query-string/body parser, used on every request.
- **Affected file(s):** `backend/package-lock.json` only.
- **What was wrong:** `qs@6.15.3` (pulled in by `body-parser@1.20.6` / `express@4.22.2`) has an array-limit bypass and a DoS via attacker-controlled `isBuffer` check.
- **Why it matters:** reachable on every request the API receives, unauthenticated included.
- **How it was fixed:** `npm audit fix` bumped `express` 4.22.2→4.22.3, `body-parser` 1.20.6→1.20.8, `qs` 6.15.3→6.16.0 — all within the existing `^4.19.2` semver range in `package.json`, no code change required.
- **Test used to verify the fix:** same full-suite re-run as above (535/535 passing).

### 4.3 🟡 Self-service role-escalation / cross-role admin access — coverage gap, not a live bug
- **Affected component:** `POST /api/auth/register`, `PATCH /api/profile`, `POST /api/admin/employees/:id/reset-password`, `POST /api/admin/staff/:id/reset-password`, `GET /api/admin/overview`.
- **Affected file(s):** none changed — the authorization was already correct (role-gated routes, whitelisted update schemas). No test previously exercised these specific attack attempts explicitly.
- **What was wrong:** nothing in the implementation; this is a **test-coverage gap**, listed here (rather than in §6) because closing it was itself a finding worth reporting per the audit's own instructions.
- **Why it matters:** these are exactly the endpoints a real attacker would try first for privilege escalation; having explicit regression tests locks in the current-correct behavior against future refactors.
- **How it was fixed:** no code change — 8 new tests added in `backend/test/security/productionAudit.test.js` (see §5/§9).
- **Test used to verify the fix:** the new tests themselves, all passing.

---

## 5. Improvements Made

Every change made during this audit, in full:

1. **`backend/package.json`** — unchanged (no version ranges edited).
2. **`backend/package-lock.json`** — dependency patch upgrade via `npm audit fix`: `multer` 2.2.0→2.4.0, `express` 4.22.2→4.22.3, `body-parser` 1.20.6→1.20.8, `qs` 6.15.3→6.16.0. No `package.json` range was changed; these were already-permitted patch/minor versions.
3. **`Frontend/package-lock.json`** — `npm audit fix` run; resolved zero additional advisories (the two remaining frontend findings both require a breaking major upgrade — see §8) but updated some transitive sub-dependencies within existing ranges. Verified with a clean `npm run build` afterward.
4. **`backend/test/security/productionAudit.test.js`** (new file, 8 tests) — added coverage for: non-Admin registration attempts, unauthenticated registration attempts, invalid-role registration rejection, self-service role escalation via `PATCH /api/profile`, self-service market reassignment via the same endpoint, cross-role password-reset IDOR (RM and Supervisor against an unrelated employee), and Employee-token access to `/api/admin/*`.
5. **`AION_SECURITY_AUDIT_REPORT.md`** (this file, new).

**Nothing else was touched.** No controller, route, middleware, schema, or frontend component was modified. No migration was created or run. No existing test was edited or deleted.

---

## 6. Items That Did Not Require Changes

- **CORS configuration** — already environment-driven and correctly unset-by-default in dev, explicit-allowlist in production; no `credentials: true` anywhere, so there's no cookie/CORS interaction to harden.
- **Password hashing** — bcrypt cost factor 10 is an appropriate, industry-standard default; raising it would only add latency with no corresponding threat this audit identified.
- **Error handling** — already environment-gated; no change needed.
- **Mass assignment protection** — already enforced at the schema layer (and, in the profile controller, a second explicit field-whitelist layer); adding anything further (e.g., a generic allowlist wrapper) would be speculative engineering the checklist itself warns against.
- **File upload validation** — already includes MIME whitelisting, size limits, magic-byte verification, and path-traversal-proof filenames; this is already at or above what a typical production app implements.
- **Rate limiting** — already tiered correctly (tight on login, loose elsewhere) and already identity-aware to avoid the shared-network false-positive failure mode. No change needed.
- **CAPTCHA / bot protection** — evaluated per the audit's own instruction not to add this speculatively. AION is an internal staff/employee operational tool (not a public-facing consumer app with open registration), reached by a known, finite set of accounts created only by an Admin. The existing IP-keyed login rate limiter (20 attempts/15min) is a proportionate control for this threat model; CAPTCHA would add user friction for zero realistic benefit here and was correctly not present. **Recommendation: do not add.**
- **Redis / session store** — the stateless-JWT-plus-`tokenVersion` design already achieves session invalidation without one; introducing Redis here would be exactly the kind of unnecessary architectural change the audit's rules prohibit.

---

## 7. Not Applicable

- **Session/cookie security (checklist §8)** — AION uses Bearer-token authentication exclusively (`Authorization: Bearer <jwt>`), stored client-side in `localStorage` (`Frontend/src/services/apiClient.js`). Confirmed via a repo-wide search: zero occurrences of `document.cookie`, `credentials: "include"`, or `withCredentials` anywhere in frontend or backend source. `HttpOnly`/`Secure`/`SameSite` do not apply to an architecture with no cookies. This also means **CSRF is not applicable**: CSRF exploits a browser's *automatic* attachment of ambient credentials (cookies) to cross-site requests; a custom `Authorization` header must be set explicitly by JavaScript running on the same origin, which a cross-site form or image tag cannot do.
- **Registration/password-reset self-service email flow** — AION has no public "forgot password" email flow; all password resets are Admin-initiated (`adminAccountController.resetEmployeePassword`/`resetStaffPassword`), audit-logged, and always bump `tokenVersion`. This matches the app's actual model (an internal tool with Admin-managed accounts, not a consumer app with self-service recovery) — building an email-based reset flow would be new functionality, not a security fix, and was correctly out of scope.

---

## 8. Needs Verification

These are real findings the audit could not resolve without either a breaking dependency upgrade (out of scope for a security-only pass per the audit's own rules) or environment access this audit doesn't have. None were found to be actively exploited or exploitable in AION's actual usage pattern, but they should be tracked and scheduled deliberately.

1. **🔵 `react-router`/`react-router-dom` 6.0.0–7.17.0 — moderate** (open redirect via backslash in `<Link>`/`useNavigate`; a separate SSR-hydration constructor-injection advisory). AION is a pure client-side SPA (no server-side rendering), so the SSR-hydration advisory does not apply to this deployment. A repo-wide search for `navigate()` calls driven by untrusted/user-controlled redirect targets found none (the one dynamic `navigate()` call found interpolates only a `period` query value into a fixed internal path, never an external or attacker-supplied URL) — so the open-redirect advisory has no known exploitable path in this app today. The fix requires `react-router-dom` 6→7, a breaking major upgrade (`npm audit fix --force`), left for a scheduled dependency-upgrade change with its own regression pass, not bundled into this security audit.
2. **🔵 `uuid` <11.1.1 (transitive via `exceljs`, used only by `backend/src/utils/attendanceExcel.js` for internal Excel export generation) — moderate.** The advisory concerns a missing bounds check when a caller supplies its own buffer to `uuid.parse`/`stringify`; `exceljs`'s internal usage is not driven by attacker-controlled buffer input in this codebase's usage (report generation only). Fixing requires `npm audit fix --force`, which would downgrade `exceljs` to `3.4.0` — a breaking change to a library actively used for a real feature. Left for a scheduled upgrade once `exceljs` itself ships a fix that doesn't require downgrading.
3. **🔵 `esbuild` <=0.24.2 (transitive via `vite`, a devDependency/build tool only) — moderate.** The advisory ("any website can send requests to the dev server and read the response") only applies while `vite`'s dev server is running and reachable from an untrusted network — it has zero impact on the production build output, which does not include `esbuild` or a dev server at all. Fixing requires Vite 6→8 (`npm audit fix --force`), a breaking build-tooling upgrade. Recommend scheduling separately with its own build/smoke-test pass; in the meantime, ensure the dev server (`npm run dev`) is never exposed to an untrusted network (standard practice, already the case for local development here).
4. **🔵 Production deployment configuration** (`CORS_ORIGIN`, `NODE_ENV=production`, `PUBLIC_BASE_URL`, TLS termination, reverse-proxy `trust proxy` correctness) — the code correctly supports all of these via environment variables, but this audit ran against a local development environment and cannot verify the actual production environment's variables are set correctly. **Action for whoever deploys this: confirm `CORS_ORIGIN`, `NODE_ENV=production`, and `JWT_SECRET` are set to real production values before go-live** (see §11).

---

## 9. Tests

- **Pre-existing backend suite:** 535 tests, **535 passed**, 0 failed (baseline, before this audit's dependency patch).
- **Full backend suite after the `multer`/`express`/`qs` patch upgrade:** re-run in full — **535/535 passed**, confirming zero regression from the dependency bump.
- **New security tests added:** `backend/test/security/productionAudit.test.js` — **8 tests, 8 passed**.
- **Full backend suite, final (535 + 8 new):** **543 tests, 543 passed, 0 failed.**
- **Frontend build:** `npm run build` — **clean**, no errors, after the `npm audit fix` dependency patch (Vite production bundle unaffected).
- **Lint/type-check:** no ESLint config file present in this repo (confirmed: `npx eslint` reports no `eslint.config.*` found) — this predates the audit and is a pre-existing project characteristic, not something introduced or fixed here.
- **Dependency audit — backend:** before: 7 vulnerabilities (6 moderate, 1 high). After: **2 moderate** remaining (both require a breaking major upgrade — see §8).
- **Dependency audit — frontend:** before: 2 moderate. After: **4** shown (2 pre-existing moderate `react-router` findings unchanged since they need a breaking upgrade, plus 2 devDependency-only `esbuild`/`vite` findings that were already present but only surfaced once the audit checked dev dependencies too, not newly introduced by any change made here). All 4 require a breaking major-version upgrade to resolve — see §8.

---

## 10. Remaining Risks

1. **Three dependency vulnerabilities requiring a breaking major upgrade** (`react-router-dom` 6→7, `exceljs`/`uuid`, `vite`/`esbuild`) — all moderate severity, all with no currently-exploitable path in this codebase's actual usage (detailed in §8), but should be scheduled as a dedicated dependency-upgrade task with its own regression pass rather than left indefinitely.
2. **Production environment variables must be verified at deploy time** — the application code correctly *supports* secure production configuration (`CORS_ORIGIN` allowlist, `NODE_ENV=production` hiding stack traces, a strong `JWT_SECRET`), but this audit cannot confirm what values are actually set in the real production environment, since it only has access to local `.env.example` templates.
3. **No lint/type-check tooling configured** — not a security vulnerability per se, but static analysis tooling (ESLint at minimum) would catch some classes of bugs (unused variables, accidental `==`, etc.) before they reach review. Outside this audit's scope to add speculatively, but worth the team's own consideration.

---

## 11. Production Recommendation

Before deploying AION to real users, confirm:

1. **Set `JWT_SECRET`** in the production environment to a long, random, unique value (never the placeholder from `.env.example`) — generation command is already documented in that file.
2. **Set `CORS_ORIGIN`** to the real production frontend origin(s) — leaving it unset in production would allow any origin to call the API.
3. **Set `NODE_ENV=production`** — this gates both error-detail exposure (`errorHandler.js`) and `morgan`'s log verbosity.
4. **Set `PUBLIC_BASE_URL`** if the API sits behind a reverse proxy/load balancer, so uploaded-file URLs are built correctly (see `app.js`'s own comment on `trust proxy`).
5. **Confirm `DATABASE_URL`/`SHADOW_DATABASE_URL`** point at real production/shadow databases, never a shared dev database.
6. **Schedule the three deferred dependency upgrades** (`react-router-dom`, `exceljs`, `vite`) as their own tracked task with a full regression pass, rather than force-upgrading them under a security audit.
7. Optionally: add ESLint (or an equivalent static-analysis tool) as general engineering hygiene — not a security blocker for launch.

Everything else audited in this report — authentication, authorization, database access, file handling, input validation, XSS, CORS, error handling, rate limiting — is already production-appropriate as implemented.
