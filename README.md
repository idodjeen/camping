# מחנאות 2026 🏕️

Mobile-first, Hebrew (RTL) trip-coordination app for five friends camping in the Upper Galilee,
**1–3.10.2026**. Claim gear, follow the meal plan, tick off the shopping, keep a private
personal packing list.

Built entirely on free tiers: Vercel Hobby + Neon Postgres + Open-Meteo.

## What's in the app

| Screen | What it does |
|---|---|
| **בית** | Live countdown, 3-day forecast, Waze/Maps buttons, progress rings, next meal, what's still unclaimed |
| **ציוד** | Claim gear by category, take part of a quantity, release it, add missing items |
| **ארוחות** | Day-by-day timeline with each meal's ingredients and their bought status |
| **קניות** | Checklist by category; only עידו and ניר can tick items |
| **שלי** | Your claims with packed checkboxes, plus a private personal list |

First login shows four swipeable onboarding cards; they can be replayed from שלי.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Database | Neon Postgres + Drizzle ORM |
| Auth | Auth.js (NextAuth v5), Google only, JWT sessions, env allowlist |
| Styling | Tailwind CSS v4 (CSS-first tokens) |
| Data | SWR — 15s polling + revalidate on focus |
| Weather | Open-Meteo (no API key) |

Requires **Node 22+** (the Neon driver uses the global `WebSocket`).

---

## Setup — do these in order

### 1. Google OAuth client

1. [Google Cloud Console](https://console.cloud.google.com/) → create a project.
2. **APIs & Services → OAuth consent screen** → *External* → fill in app name + support email.
3. ⚠️ While the consent screen is in **Testing**, add all five Google accounts under
   **Test users**. Otherwise Google refuses them before this app's allowlist ever runs —
   the most common "it just says access blocked" cause.
4. **Credentials → Create credentials → OAuth client ID → Web application**:

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
> changes within a minute or two.

### 2. Database (Neon via Vercel)

Vercel dashboard → your project → **Storage → Create Database → Neon** → Connect.
This injects `DATABASE_URL` into every environment automatically.

### 3. Environment variables

Set these in **Vercel → Settings → Environment Variables** (Production + Preview + Development):

| Variable | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | from step 1 |
| `AUTH_GOOGLE_SECRET` | from step 1 |
| `AUTH_TRUST_HOST` | `true` |
| `ALLOWED_USERS` | `email:עידו,email:ניר,email:סער,email:אור,email:יצחק` |
| `CLOUDINARY_CLOUD_NAME` | from step 3a |
| `CLOUDINARY_API_KEY` | from step 3a |
| `CLOUDINARY_API_SECRET` | from step 3a |

`DATABASE_URL` is already there from step 2. See `.env.example` for the rest,
including the Web Push (VAPID) pair.

#### 3a. Cloudinary (chat photos)

[cloudinary.com](https://cloudinary.com) → free account → **Settings → API Keys**.
The browser shrinks each photo and uploads it straight to Cloudinary using a
signature minted per upload by `/api/uploads/sign`, so the secret stays on the
server and a multi-megabyte photo never passes through a serverless function.
Without these three the chat still works — the photo button reports that
uploads are not configured.

### 4. Local setup

```bash
npm install
vercel link          # once, to connect this folder to the Vercel project
vercel env pull .env.local
npm run db:migrate   # create the tables
npm run db:seed      # load trip, users, gear, shopping, meals
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
| `npm run db:seed` | **Idempotent** seed — safe to re-run |
| `npm run db:reset` | ⚠️ Truncates everything, then reseeds |
| `npm run db:studio` | Drizzle Studio (browse the data) |

### About the seed

`npm run db:seed` can be run any number of times against the live database. Re-running
updates seeded *content* — item names, quantities, meal links — while preserving everything
the group has created:

- gear claims and their "packed" flags
- which shopping items were bought, by whom, and when
- personal packing lists
- onboarding progress

Use `db:reset` only when you genuinely want to throw away the group's data.

---

## Users, roles and avatars

Access is gated by `ALLOWED_USERS`. Any other Google account gets a Hebrew
"אין גישה" screen and no session.

**Roles live in the database**, not in env — so they can be changed later without a
redeploy. The seed sets them:

| Person | Admin | Shopper |
|---|---|---|
| עידו | ✅ | ✅ |
| ניר | | ✅ |
| סער / אור / יצחק | | |

Every permission is re-checked server-side in the route handler on each request; the client
only hides controls, it never grants them.

**Avatars** are optional static files at `public/avatars/{slug}.jpg` —
`ido`, `nir`, `saar`, `or`, `itzhak`. Drop in JPGs and redeploy. Anyone without a file gets a
deterministic gradient circle with their initial, so the app never looks broken.

---

## Architecture notes

**Auth.js split config.** `src/auth.config.ts` is edge-safe (providers + allowlist, no DB) and
is what `src/middleware.ts` loads. `src/auth.ts` adds the DB-aware callbacks and is only ever
imported by Node route handlers. Importing the database into middleware breaks the Edge bundle.

**Neon Pool driver, not neon-http.** The gear-claim endpoint needs a real interactive
transaction — two people claiming the last gas stove simultaneously must not both succeed.
The HTTP driver can't do `SELECT ... FOR UPDATE`; the Pool driver can.

**Dates are strings, never `Date` objects.** A `Date` is interpreted in the server's timezone
(UTC on Vercel), so a trip starting 1.10 would render as 30.9 in Israel. All date-only values
stay as `"YYYY-MM-DD"` strings end to end.

---

## Security

No secrets are committed. `.env`, `.env.local` and `.env.production` are gitignored;
`.env.example` documents the shape with placeholder values only.
