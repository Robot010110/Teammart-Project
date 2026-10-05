# Deploying TeamMart (get a live link)

This repo ships a **Render Blueprint** (`render.yaml`) that stands up the
whole app — PostgreSQL + API + frontend — on Render's free tier. Render is
used because the backend is a long-running Express/Prisma server with a
background scheduler (not a serverless function), and it offers a free
managed Postgres, a free Node web service, and free static hosting in one
place.

> Free-tier notes: the API **cold-starts** after ~15 min of inactivity (the
> first request then takes ~30–60s). Uploaded files are written to local
> disk, which is **ephemeral** on the free plan — images survive until the
> next deploy/restart. Both are fine for testing; neither needs a code
> change to fix later (attach a Render disk, or point `PUBLIC_BASE_URL` at
> object storage).

## Steps

1. **Have the code on GitHub.** This branch is already pushed to
   `Robot010110/Teammart-Project`.

2. **Create a Render account** at <https://render.com> (free; sign in with
   GitHub so Render can read the repo).

3. **New → Blueprint.** Select this repository and the branch you want to
   deploy. Render detects `render.yaml` and shows the three resources it
   will create (`teammart-db`, `teammart-api`, `teammart-web`). Click
   **Apply**. Render will also ask you to supply `VITE_API_URL` for
   `teammart-web` — leave it blank for now (step 5 fills it in).

4. **Wait for `teammart-api` to go live.** First build runs the migrations
   and seeds the demo accounts. When it's green, open the service and copy
   its URL, e.g. `https://teammart-api-xxxx.onrender.com`.

5. **Point the frontend at the API** (the one manual wire-up — the frontend
   bakes the API URL in at build time):
   - Open **teammart-web → Environment**.
   - Set `VITE_API_URL` to the API URL **plus `/api`**, e.g.
     `https://teammart-api-xxxx.onrender.com/api`.
   - Save → it redeploys. When green, open the `teammart-web` URL. **That
     link is the app.**

## Demo logins (created by the seed)

| Role               | Login                         | Password      |
|--------------------|-------------------------------|---------------|
| Admin              | `admin@teammart.test`         | `Admin123!`   |
| Supervisor         | `em881`                       | `Sr@9907`     |
| Employee (Worker)  | `TM-1001`                     | `Employee123!`|
| Cashier            | `em149`                       | `Rr@0049`     |

## Optional hardening (after it works)

- Set `CORS_ORIGIN` on `teammart-api` to the `teammart-web` URL to stop
  allowing any origin.
- Add a Render **persistent disk** mounted at `backend/uploads` (or wire
  `PUBLIC_BASE_URL` to object storage) so uploads survive restarts.
