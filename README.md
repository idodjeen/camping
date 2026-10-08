# מחנאות 🏕️

Mobile-first, Hebrew (RTL) app for planning camping trips with friends. It hosts many groups,
each with its own people and trips, and keeps every group's data invisible to the others.
On a trip you claim gear, follow the meal plan, tick off the shopping, split expenses, chat,
and keep a private packing list.

Built on free tiers: Vercel Hobby + Neon Postgres + Open-Meteo.

## What's in the app

Everything inside a trip lives under `/t/[tripId]`. Three tabs sit at the bottom, and the rest
is in the ☰ menu (`src/lib/nav.ts`).

| Screen | What it does |
|---|---|
| **בית** | Countdown, forecast, Waze/Maps buttons, progress rings, next meal, what's still unclaimed |
| **ציוד** | Claim gear by category, take part of a quantity, release it, add missing items |
| **צ׳אט** | Every thread in the trip, plus the general chat room |
| **ארוחות** | Day-by-day timeline with each meal's ingredients and whether they were bought |
| **קניות** | Checklist by category; only the trip's shoppers can tick items |
| **הוצאות** | Expenses with a split, payments between people, balances and a chart |
| **לוח התורמים** | Who brought and packed the most |
| **חשבון** | Your role, push and notification switches, the short guide |
| **ניהול הטיול** | Group admins: trip details, categories, meals |

Outside a trip:

| Path | Who | What |
|---|---|---|
| `/` | everyone | Your trips by group; opens your last trip |
| `/g/[groupId]` | group admins | Members and roles, new trips, who is on each trip and who shops |
| `/admin` | super admin | All groups, creating a group and its first admin |

First sign-in shows a few swipeable onboarding cards; they can be replayed from חשבון.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Database | Neon Postgres + Drizzle ORM |
| Auth | Auth.js (NextAuth v5), Google only, JWT sessions, access from the database |
| Styling | Tailwind CSS v4 (CSS-first tokens) |
| Data | SWR, 15s polling + revalidate on focus |
| Notifications | Web Push (VAPID) and Gmail SMTP |
| Weather | Open-Meteo (no API key) |

Requires **Node 22+** (the Neon driver uses the global `WebSocket`).

---

## Setup, in order

### 1. Google OAuth client

1. [Google Cloud Console](https://console.cloud.google.com/) -> create a project.
2. **APIs & Services -> OAuth consent screen** -> *External* -> fill in app name + support email.
3. ⚠️ Set the consent screen to **In production**. While it's in **Testing**, Google refuses
   every account that isn't listed under **Test users**, before this app's own check runs.
   With only the email and profile scopes, Google doesn't require verification.
4. **Credentials -> Create credentials -> OAuth client ID -> Web application**:

   **Authorized JavaScript origins**
   ```
   http://localhost:3000
   https://<your-app>.vercel.app
   ```

   **Authorized redirect URIs**
   ```
   http://localhost:3000/api/auth/callback/google
   https://<your-app>.vercel.app/api/auth/callback/google
   ```
5. Copy the **Client ID** and **Client secret**.

> Add the Vercel URL after the first deploy, once you know the domain. Google applies
> changes within a minute or two. Previews don't need their own entries: they relay sign-in
> through production (`AUTH_REDIRECT_PROXY_URL`, see `.env.example`).

### 2. Database (Neon via Vercel)

Vercel dashboard -> your project -> **Storage -> Create Database -> Neon** -> Connect.
This injects `DATABASE_URL` into every environment.

Use two Neon branches: `main` for Production only, and `dev` for local work and every Vercel
preview. Try every migration on `dev` first.

### 3. Environment variables

`.env.example` lists every variable, with what it's for and which environments get it. The
essentials, in **Vercel -> Settings -> Environment Variables**:

| Variable | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | from step 1 |
| `AUTH_GOOGLE_SECRET` | from step 1 |
| `AUTH_TRUST_HOST` | `true` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | push; **Config** type, not Secret |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | reminder and invite emails; Production only |

On this project, Vercel's **Secret** type never reaches the runtime; use **Config**.

### 4. Local setup

```bash
npm install
vercel link          # once, to connect this folder to the Vercel project
vercel env pull .env.local
npm run db:migrate   # create the tables
npm run db:seed      # the original group and its first trip
npm run dev          # http://localhost:3000
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate SQL migrations from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | **Idempotent** seed, safe to re-run |
| `npm run db:reset` | ⚠️ Truncates everything, then reseeds |
| `npm run db:studio` | Drizzle Studio (browse the data) |

`db:migrate`, `db:seed` and `db:reset` refuse the production database unless
`CONFIRM_PROD=1`, and refuse to run at all until `PROD_DB_HOST` is set in `.env.local`
(see `.env.example`). The check is `scripts/prod-guard.mjs`.

There is deliberately no `db:push`. Schema changes go through `db:generate`, a commit, then
`db:migrate`. drizzle-kit 0.31's push also misreads the composite `*_trip_id_uq` unique
constraints as missing and offers to truncate the table to add them.

### About the seed

The seed fills the original group (id 1) and its first trip, and touches nothing else. Every
other group and trip is created in the app. Its five people come from `ALLOWED_USERS` in
`.env.local`, so their emails stay out of the repo; nothing else reads that variable.

Re-running updates seeded *content* (item names, quantities, meal links) while preserving
everything the group has created: gear claims and "packed" flags, who bought what, personal
lists and onboarding progress. Use `db:reset` only when you really want to throw that away.

---

## People and roles

Who may sign in, and as what, lives in the database. Anyone who isn't the super admin or a
member of some group gets the Hebrew "אין גישה" screen and no session.

| Role | Stored in | Can |
|---|---|---|
| Super admin | `users.is_super_admin` | Everything in every group; creates groups; sends reminder emails |
| Group admin | `group_members.role = 'admin'` | Members, roles, trips, trip details, categories and meals |
| Editor | `group_members.role = 'editor'` | Everything on the trips they're on |
| Viewer | `group_members.role = 'viewer'` | Read only; every write gets 403 |
| Shopper | `trip_members.is_shopper` | Tick shopping items as bought, on that trip |

People are added by a group admin on `/g/[groupId]` (or by the super admin when creating a
group). They get an invite email and can sign in with that Google account right away.

Every permission is re-checked on the server in each route; the client only hides controls,
it never grants them.

**Avatars**: the five founders have photos in `public/avatars/{slug}.jpg`. Everyone else gets a
deterministic gradient circle with their initial.

---

## Architecture notes

**One gate per request.** Every trip route starts with `requireTrip(tripId, "read" | "write" |
"admin")` (`src/lib/access.ts`) and filters every query by that trip. Someone outside the group
gets 404, never 403, so they can't even tell a trip exists. Composite foreign keys stop a row
pointing into another trip, even if a query forgets a filter.

**Auth.js split config.** `src/auth.config.ts` is database-free and is what `src/proxy.ts`
loads on every request. `src/auth.ts` adds the database-aware sign-in check and is only imported
by Node route handlers.

**Neon Pool driver, not neon-http.** The gear-claim endpoint needs a real interactive
transaction: two people claiming the last gas stove at once must not both succeed. The HTTP
driver can't do `SELECT ... FOR UPDATE`; the Pool driver can.

**Dates are strings, never `Date` objects.** A `Date` is read in the server's timezone (UTC on
Vercel), so a trip starting 1.10 would show as 30.9 in Israel. Date-only values stay as
`"YYYY-MM-DD"` strings end to end.

More: `docs/groups-and-trips.md` (the multi-group design), `docs/roadmap.md`, and
`docs/handoff.md` (current state and working rules).

---

## Security

No secrets are committed. `.env`, `.env.local` and `.env.production` are gitignored;
`.env.example` documents the shape with placeholder values only.
