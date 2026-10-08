# Architecture design: handoff

> Written 2026-10-08, on `main` at #18 (phases 1-6 and roadmap A-E live, production at 13
> migrations). This is a brief for one agent: describe the architecture as it is, answer the open
> questions below with evidence and a recommendation, and draw the diagrams listed. No code changes.
> The working rules are in `docs/handoff.md`.

## The deliverable

One PR, `[no-popup]` in the title, branch `claude/architecture-doc`, adding:

1. **`docs/architecture.md`**: the system as it is today, built around the diagrams in "Diagrams to
   draw" below. Every statement is checked against the code (cite `path:line`), not against this brief
   or the older docs, which can be out of date.
2. **An "Open questions" section** in the same file: each question below gets a short answer from
   the code, a recommendation, and its rough cost (S/M/L). Recommendations are proposals for Ido to
   decide; nothing is built.
3. **Fixes to this brief's two inventories** (live services, APIs) wherever the code says otherwise.

## What is live today (services on air)

There is one running application and no background workers: no cron jobs, no queues, no
`vercel.json`. Work that happens "later" runs inside the request that caused it, through `after()`
from `next/server` (push sends since #20).

| Service | What it does | Where it's configured |
|---|---|---|
| **Vercel**, project `camping` (team `idodjeen`) | Hosts the Next.js 16 app: pages, API route handlers, and the proxy (`src/proxy.ts`), which checks a session exists on every request except auth, static files and `sw.js`. Production is `camping-rosy.vercel.app`; every pushed branch gets a preview at `camping-git-<branch>-idodjeen.vercel.app`. Deploys on push from GitHub. | Vercel dashboard, `next.config.ts` |
| **Neon Postgres** | The only datastore. Branch `main` (production, endpoint `ep-frosty-math`) and branch `dev` (local work and every preview, `ep-icy-violet`). Drizzle ORM over the Pool (WebSocket) driver, for real transactions. 19 tables, 13 migrations. | `DATABASE_URL` per Vercel environment, `src/db/`, `drizzle/` |
| **Google OAuth** via Auth.js (next-auth v5 beta) | The only sign-in. JWT sessions. The database decides who may sign in (`src/auth.ts`). Previews relay sign-in through production's callback (`AUTH_REDIRECT_PROXY_URL`). | Google Cloud console, `AUTH_*` |
| **Gmail SMTP** (nodemailer, Ido's personal Gmail) | Mention emails, admin reminders, group invites. Production only. | `GMAIL_*`, `src/lib/mailer.ts` |
| **Web Push** (VAPID) to the browsers' push services (Apple, Google FCM, Mozilla) | One notification per thread; `public/sw.js` shows it, replaces it by tag and sets the icon badge. Production has its pair; Preview has its own since 2026-10-08. | `VAPID_*`, `src/lib/push.ts` |
| **Open-Meteo** | Weather for the trip's location. No key. | `src/lib/weather.ts` |
| **GitHub** `idodjeen/camping` | Source, PRs, and the trigger for Vercel deploys. | |
| Unused | `CLOUDINARY_*` (photos deferred), the Neon integration's `check_env_*` variables. Waze and Google links in the UI are plain links, not integrations. | |

## The APIs (42 route handlers)

All under `src/app/api/`. Every route except `/api/auth/*` sits behind the proxy's session check.
The access column is the rule from `docs/handoff.md`; check each route's actual level as part of
the work.

**App-wide**

| Route | Methods | Access | Purpose |
|---|---|---|---|
| `/api/auth/[...nextauth]` | (Auth.js) | public | Google sign-in and sign-out |
| `/api/me/onboarded` | POST | signed in | Mark the first-login guide as seen |
| `/api/me/prefs` | PATCH | signed in | Notification switches |
| `/api/push` | GET POST DELETE | signed in | VAPID public key; save or remove this device's subscription |
| `/api/release` | GET | signed in | The deployed commit, for the "what's new" pop-up and the reload guard |
| `/api/version` | GET | signed in | Deployment diagnostics: commit, and which env variables are present (booleans only) |

**Super admin and group admin**

| Route | Methods | Access | Purpose |
|---|---|---|---|
| `/api/admin/groups` | GET POST | super admin | Every group and its people; create a group with its admin, editors and viewers, each emailed an invite |
| `/api/g/[groupId]` | GET | group admin | The group, its people, and its trips with who is on each |
| `/api/g/[groupId]/members` | POST | group admin | Add members (and send invites) |
| `/api/g/[groupId]/members/[userId]` | PATCH DELETE | group admin | Change a role; remove someone |
| `/api/g/[groupId]/trips` | POST | group admin | Create a trip |
| `/api/g/[groupId]/trips/[tripId]/members/[userId]` | PATCH | group admin | Put someone on or off a trip, shopper flag |

**One trip** (`/api/t/[tripId]/…`, every one starts with `requireTrip`)

| Route | Methods | Purpose |
|---|---|---|
| `dashboard` | GET | Home screen |
| `me` | GET | Me on this trip: role, claims, personal list, the trip's people |
| `gear` | GET POST | The gear list; add an item |
| `gear/[id]/claim` | POST PATCH DELETE | Claim, change, release (row-locked) |
| `shopping`, `shopping/[id]` | GET POST, PATCH | The shopping list; add; mark bought or not (the trip's shoppers only) |
| `meals` | GET | Meals by day |
| `personal`, `personal/[id]` | POST, PATCH DELETE | My packing list |
| `expenses`, `expenses/[id]` | GET POST, PATCH DELETE | Expenses, balances, settle-up |
| `settlements`, `settlements/[id]` | POST, DELETE | Record or undo a payment |
| `comments`, `comments/[id]` | GET POST, DELETE | A thread on an item; post; delete |
| `chat` | GET POST | All item threads as one timeline, or the general room |
| `inbox`, `inbox/read` | GET, POST | The bell: unread grouped by thread, counts; mark read |
| `leaderboard` | GET | Who brought what |
| `weather` | GET | Forecast for the trip's location |
| `manage`, `manage/meals`, `manage/meals/[id]`, `manage/categories/[list]`, `manage/categories/[list]/[id]` | GET PATCH, POST, PATCH DELETE, POST PATCH, PATCH DELETE | Group admin edits trip details, meals, categories (phase 6) |
| `admin/notify` | GET POST | Super admin: preview and send reminder emails |

**Temporary, removed in H**

| Route | Why it exists |
|---|---|
| `/api/[...legacy]` (GET POST PATCH DELETE) | Pre-trip paths (`/api/gear`, ...) for bundles older than phase 2 |
| `/api/t/[tripId]/notifications` (GET POST PATCH), `comments/read`, `chat/read` (POST) | The bell's endpoints before #20, as adapters over the new table |

## Open questions to answer

For each: what the code does today (with `path:line`), what you recommend, and the cost.

1. **Nothing runs on a schedule.** Reminders are sent by hand. Should anything move to Vercel Cron
   (reminders before a trip, a daily digest, pruning old notification rows), and what would it
   need (an auth secret for the cron route, idempotency)?
2. **Polling.** Every open screen polls with SWR every 15s (`src/lib/api.ts`), at least `/inbox` and
   `/me` plus the screen's own list. Estimate requests per active user per hour and what that costs
   on Vercel and Neon. At what scale would server-sent events or a realtime service pay off?
3. **Email from a personal Gmail.** Sending limits, deliverability, and what happens when the app
   password changes. When should it move to a transactional provider, and what changes?
4. **Keeping groups apart.** Today it's the access layer plus composite foreign keys
   (`docs/groups-and-trips.md`, "Keeping groups apart"), with row-level security left out on purpose.
   List what would justify revisiting that.
5. **One shared `dev` database** for local work and every preview. When would per-branch Neon
   branches be worth it, given only one migration PR is open at a time?
6. **Production migrations are manual** (`docs/handoff.md`, Migrations). Should they run from CI
   before the deploy? What are the risks either way, given expand-only migrations?
7. **Backups and recovery.** What does Neon's point-in-time restore give this project today, and what
   should happen before H's irreversible drops?
8. **Observability.** Only Vercel logs and `console.error` today. Is error reporting (Sentry or
   similar) worth it at this size? What would you log for push failures and sign-in refusals?
9. **Push reliability.** iOS installed-app quirks, subscription pruning (404/410), the re-post on
   launch, and the web-push `Topic` header (lets a push service keep only the newest queued push per
   thread). Anything missing?
10. **Secrets and configuration.** Vercel "Secret" variables have failed to reach the runtime here
    before, so new ones are added as "Config". Which variables are sensitive, and is that trade-off
    acceptable?
11. **Scale.** What breaks first at 10 groups, then 100: polling load, Gmail limits, the single
    super admin, the shared `dev` database?
12. **Temporary code.** Confirm the H list (legacy routes, #20's adapters, `comment_mentions`, unused
    `users` columns, `thread_key` NOT NULL) and propose the order of removals.

## Diagrams to draw

Mermaid inside `docs/architecture.md`, so GitHub renders them and they stay editable; no images.
Under ~15 nodes each (split a big one in two). Labels in English; Hebrew only when quoting UI text.
Each diagram is followed by a few lines saying what to notice, and a "Checked against:" line
listing the files it was verified against. Draw what the code does, not what the docs say.

1. **System context.** Campers (iPhone installed app, desktop browser), the app on Vercel, Neon
   (`main` and `dev`), Google OAuth, Gmail SMTP, the browsers' push services, Open-Meteo, GitHub to
   Vercel. One arrow per real dependency, labelled with what flows.
2. **Environments and deploys.** A branch push builds a preview (`dev` database, Preview VAPID pair,
   sign-in relayed through production); a merge to `main` builds production. Show where a migration
   runs in each, and the manual production steps (reuse the flowchart in `docs/roadmap.md`, "Deploying
   a migration", if it still holds).
3. **A request's path.** Browser, then the proxy at the Edge (session exists?), then a route handler,
   then `requireTrip` / `requireGroupAdmin` / `requireSuperAdmin` (404 vs 403), then Drizzle, then
   Neon, then `after()` work. A flowchart with the failure exits.
4. **Data model.** A Mermaid `erDiagram`, split in two: people and access (`users`, `groups`,
   `group_members`, `trip`, `trip_members`), and a trip's content (gear, shopping, meals, comments,
   notifications, expenses, settlements, personal items, push subscriptions). Show `trip_id` and
   which links are composite `(trip_id, x_id)` keys that cascade.
5. **A notification, end to end.** A sequence diagram: B posts a comment; `createComment`;
   `notify()` writes rows; the response returns; `after()` counts per recipient and sends web-push;
   the push service; `sw.js` replaces by tag, applies the 2-minute renotify rule and sets the badge;
   A's app polls `/inbox`; A opens the thread; `/inbox/read`; the delivered notification is closed.
6. **Sign-in.** A sequence diagram: Google, the `signIn` callback's database check (and Gmail
   spellings), the JWT, the proxy on later requests, and how a preview's sign-in is relayed through
   production.
7. **Client data flow.** Which SWR keys each screen polls, which share one request, and the reload
   guard comparing the bundle's commit with `/api/release`.

## How to work

- Read first: `AGENTS.md`, `docs/handoff.md`, `docs/groups-and-trips.md`, the Overview of
  `docs/roadmap.md`, then `src/proxy.ts`, `src/auth.ts`, `src/auth.config.ts`, `src/lib/session.ts`,
  `src/lib/access.ts`, `src/db/schema.ts`, `src/db/index.ts`, `src/lib/notifications.ts`,
  `src/lib/push.ts`, `public/sw.js`, `src/lib/api.ts`, `src/lib/reload-guard.ts`, `next.config.ts`, and
  every `route.ts` under `src/app/api/`.
- Allowed: reading the code and Vercel's settings (`vercel env ls`, `vercel inspect`; never print a
  value), and read-only queries on `dev`. Not allowed: changing code or configuration, or querying
  production (ask Ido to run any production query and paste the result).
- Docs style: hyphens, never em or en dashes; concise; when something is unclear, ask Ido rather
  than guess.

## Opening prompt

```text
Repo /Users/idodwek/camping (GitHub idodjeen/camping). Write the architecture document described in docs/architecture-handoff.md: docs/architecture.md with the seven diagrams it lists, answers to its twelve open questions (evidence from the code, a recommendation, a rough cost), and corrections to its inventories of live services and APIs.

Read first: AGENTS.md, docs/architecture-handoff.md (the brief, its reading list and its rules), docs/handoff.md.

Before anything: check no other session or open PR is on this (gh pr list; ListAgents). Branch claude/architecture-doc in .claude/worktrees/architecture-doc, off origin/main. Documentation only: no code or configuration changes, no production queries.

Deliver: push, gh pr create with "[no-popup]" in the title. Don't merge.
```
