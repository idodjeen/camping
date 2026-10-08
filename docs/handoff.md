# Handoff: two chats, one per track

> Refreshed 2026-10-08 after phase 5 (#15) and the Gmail sign-in fix (#16). Groups phase 6 and roadmap
> E now run **in parallel, in two chats**, one per track below. Nothing else runs alongside them. The
> plan is `docs/groups-and-trips.md`, the roadmap is `docs/roadmap.md`. This file is the state and the
> rules. Each track's opening prompt is at the end.

## Where things stand

| Area | Status |
|---|---|
| Groups and trips, data kept apart per group | Live: phases 1-2 (#5, #7) |
| Header, 3 tabs, menu, trip switcher | Live: phase 3 = roadmap C (#9), slide fixes #11, #12 |
| Super-admin page `/admin`: create groups | Live: phase 4 (#13) |
| Group admin page `/g/[groupId]`: members, roles, new trips, who is on each trip | Live: phase 5 (#15) |
| Sign-in matches Gmail spellings (dots, `+tag`, googlemail.com); refused sign-ins are logged | Live: #16 |
| Expenses: edit, categories, chart | Live: roadmap B (#10) |
| Safety rails: guarded migrations, reload guard, error screens | Live: roadmap A (#6, #8) |
| Production database | 11 migrations (0000-0010), confirmed 2026-10-08 |
| `dev` database | Same 11; used by local work **and** every preview |

## What's next

Two tracks at once, then the rest in order:

| Track | What | Branch | Worktree | Migration |
|---|---|---|---|---|
| 1 | **Groups phase 6**: trip details, categories, meals editable by the group admin | `claude/trip-content` | `.claude/worktrees/trip-content` | Not expected. If it turns out to need one, it waits until E is merged |
| 2 | **Roadmap E**: notifications core (items 6-7) | `claude/notifications-core` | `.claude/worktrees/notifications-core` | Yes (owns the one migration slot) |

Then **groups phase 7** (cleanup: hard-coded names, reminders per trip, `VIEWER_USERS`), best before F
since both touch reminders; then **F** (more notification kinds), **G** (edit messages), and **H**
(cleanup) about a week after E, F and G are live.

### Two tracks, without stepping on each other

- **Own branch, own worktree, own PR.** Never edit the other track's worktree, and keep the main folder
  on `main`. Git never silently overwrites: anything both tracks change shows up as a conflict.
- **Where they meet.** Phase 6 adds editing to the gear, shopping and meals screens and their APIs. E
  changes the bell, `lib/notifications.ts`, `lib/comments.ts`, push, `/me`, chat and room, and how
  opening a thread marks it read. So the overlap is those three screens and `components/comments.tsx`.
  Keep changes there small and local; don't reformat or move code you don't need to.
- **Whoever merges second** syncs with `main` first (the app's "sync with base branch"), resolves the
  conflicts, runs typecheck and build again, then merges.
- **One migration.** E owns it. Phase 6 adds no migration while E's PR is open.
- **Deleting content.** Phase 6 lets the admin delete meals (and maybe categories). E's notification
  rows must keep cascading from the comment or item they're about (its design already says so). Both
  tracks check it: delete a meal with a tagged comment, and its bell rows go with it.
- **Shared `dev` database.** Test rows use the track's own email prefix (`p6-…@example.test` for phase 6,
  `e-…@example.test` for E) and each track deletes only its own. E's migration on `dev` only adds, so
  phase 6 keeps working. Don't "Reset from parent" on `dev` without asking the other chat first.
- **Ports and `launch.json`.** Phase 6 uses port 3022, E uses 3023. `preview_start` reads
  `.claude/launch.json` from the **main folder**: add your own entry, and when done remove only that
  entry by editing the file (a `git checkout` of it would delete the other track's entry too).

### Decisions waiting on Ido

- **Google OAuth consent screen: Testing to In production**, if it isn't yet. Otherwise each new person
  must also be listed as a test user in Google Cloud.
- Primary tabs: בית, ציוד, צ׳אט were a default, never chosen. It's one `primary` flag in `lib/nav.ts`.
- Item 8: admin reminders as push with no switch (current plan), or a fifth switch.
- `CLOUDINARY_*` on Vercel (photos deferred): keep or remove.

## Rules (keep these)

**Before starting**
- Check nobody else has it: running sessions, `gh pr list --state open`, unmerged remote branches.
- Keep the main folder on `main`; never switch branches there while another session is live. Work in
  `git worktree add -b claude/<name> <path> origin/main`, stage files by name, never `git add -A`.
- A new worktree has no `node_modules` or env files: `cp -Rc node_modules` (an APFS clone, instant)
  and copy `.env.local` and `.env.development.local` from the main folder.

**Migrations**
- One migration PR open at a time; drizzle numbers files when they're generated.
- Expand-only (add columns, tables, rows). Drops wait for H, or until no live code reads the thing.
- `text` + `CHECK`, never a new Postgres enum: all pending files run in one transaction.
- Try it on `dev` first (`npm run db:migrate`). If a migration PR is abandoned, "Reset from parent" on
  `dev`.
- Production, **before** merging an expand migration: count, migrate, count again.
  ```
  psql "$(sed -nE 's/^# DATABASE_URL="?([^"]*)"?$/\1/p' .env.local)" -c "select count(*) from drizzle.__drizzle_migrations"
  CONFIRM_PROD=1 DATABASE_URL="$(sed -nE 's/^# DATABASE_URL="?([^"]*)"?$/\1/p' .env.local)" npm run db:migrate
  ```
  Say it in the PR body, so the step isn't forgotten after the merge (it was, once, for 0010).

**Merging and deploying**
- **Squash and merge.** A regular merge commit's heading is "Merge pull request #N from ...", which is
  what the pop-up shows campers. `[no-popup]` in the title still silences chores either way, because
  the title lands in the commit body.
- Feature PR titles in Hebrew, written for the campers; chores carry `[no-popup]`.
- Never "Redeploy" an older production deployment on Vercel: it rebuilds that old commit and rolls
  production back (happened once, Oct 7).
- An API response only gains fields for one release; a renamed endpoint keeps a thin adapter until H.

**Code**
- Every trip route starts with `requireTrip(tripId, "read" | "write" | "admin")` (`lib/access.ts`) and
  filters every query by that trip. Outsiders get 404, never 403. Lookups by id also match `trip_id`.
- Group-admin routes start with `requireGroupAdmin(groupId)` (or `groupRoute(ctx)`), also in
  `lib/access.ts`: 404 outside the group, 403 for members who aren't admins. Their logic lives in
  `lib/group-admin.ts`, and every change there first locks the group's row (`lockGroup`).
- Writes name their trip explicitly: `trip_id` has no default since 0010, so a forgotten one fails.
- People on a trip come from `tripPeople()` (`lib/trips.ts`), not all users. Trip membership follows
  the role (admins and editors on every trip that hasn't ended, viewers on none), and nobody with money
  on a trip is taken off it.
- Create users only with `createUser(tx, {email, name})` (`lib/user.ts`). Validate names and pasted
  lists with `lib/people.ts` (`nameProblem`, `parsePeople`, `clashes`, `nameKey`); names are unique
  per **group**, re-checked inside the transaction. Request bodies with people go through
  `readPerson()` / `readPeople()` in `lib/groups.ts`.
- Super-admin routes use `requireSuperAdmin()` (`lib/session.ts`).
- Every viewer write gets 403, and every Verification list includes a viewer.
- Client calls go through `useTrip()` (`lib/trip-client.ts`): `api("/gear")`, `page("/gear")`.
- Navigation: `NAV` in `lib/nav.ts`. Screens inside a trip are plain rows; app-wide pages like `/admin`
  use `appItem(…)` (`outsideTrip`, kept out of the slide order) with `adminOnly` / `superAdminOnly`
  and `canSee()`. Per-group links (`/g/[groupId]`) are their own row in `NavMenu`
  (`components/app-header.tsx`).
- Layout: bar heights only from `--app-header-h` / `--bottom-nav-h` (`globals.css`). Sticky under the
  header uses `top-(--app-header-h)`, above the nav `bottom-(--bottom-nav-h)`. Nothing `position:
  fixed` inside `template.tsx`'s subtree. Overlays portal to `<body>` and use `lib/use-overlay.ts`
  (counted scroll lock); never touch `body.style.overflow` by hand.
- z-order: page bars 10-20, header 30, nav 40, toasts 50, banner and lightbox 60, sheets 65,
  onboarding 70.
- Never change module state during render (React may render twice); record it in an effect.
- RTL: logical properties only; physical framer-motion `x` multiplies by `startSign()`.
- Docs and PR text: hyphens, never em or en dashes.

## Testing

- **Previews are first-class.** They run on `dev`, and sign-in works through `AUTH_REDIRECT_PROXY_URL`.
  Ido signs in on the branch alias (`camping-git-<branch>-idodjeen.vercel.app`); a Claude session
  can't do Google sign-in itself.
- **A refused sign-in** logs `sign-in refused for <email>`: `vercel logs --environment production
  --since 1h --json`.
- **Locally, as made-up users** (never as a real person, never against production):
  - `.env.development.local` holds a local-only `AUTH_SECRET`, so a minted session is useless on
    production. Never mint with `.env.local`'s secret: that one is production's. Don't print either.
  - Insert test rows on `dev` (check the host is `ep-icy-violet` first), mint with `encode` from
    `node_modules/@auth/core/jwt.js` (salt `authjs.session-token`), and delete the rows afterwards.
  - Keep tokens in files and the shell. A small curl wrapper that sends `authjs.session-token` from a
    file covers every API check.
  - **The dev server:** `preview_start` reads `.claude/launch.json` from the **main folder**, so add an
    entry there that runs `<worktree>/node_modules/.bin/next dev <worktree> -p <port>` (see the ports
    above), and in the worktree's own `.env.development.local` set `DATABASE_URL` to the unpooled URL.
  - **In the browser:** `localhost` holds someone's real session cookie, and `127.0.0.1` a stale
    HttpOnly test cookie that page JavaScript can't overwrite. Use a fresh `*.localhost` host (such as
    `p6.localhost`) with a temporary `allowedDevOrigins` entry, reverted before commit. To get the
    session in without the token entering the transcript, copy it to a temporary `public/<name>.svg`
    (the proxy skips `.svg`), have the page `fetch` it into `document.cookie`, then delete the file.
- **Traps:**
  - In a hidden browser pane `requestAnimationFrame` doesn't run (or runs about every 300ms), so the
    page's slide-in stays at its first frame (`scale(0.97)`) and sticky positions read about 3% off.
    Read the DOM, not screenshots.
  - The `dev` database drops connections now and then ("Connection terminated unexpectedly"). Re-run
    the step, and check what actually landed before trusting a result.
  - Editing `next.config.ts` restarts the dev server: requests in flight time out, and the first render
    after a restart can stream a soft 404 (status 200). Don't edit it mid-test.
  - The first `npx next typegen` in a fresh worktree can take minutes.
  - After deleting a throwaway route, remove `.next/dev` or `tsc` trips on stale route types.
  - `typedRoutes` checks need `.next/types` (`npx next typegen` or a build).

## Open items

**Never verified on a real iPhone** (header and menu, PR #9): the header clearing the notch, the banner
and toasts under the status bar, the keyboard in the chat room (`lib/use-keyboard.ts` is an unproven
heuristic: "open" is `visualViewport` more than 150px below the tallest seen), and swipe-to-close by
touch. Also unchecked: the tag badge from a second member, and the viewer layout.

**From phases 4-5**
- `/admin` and `/g/[groupId]` show their "אין הרשאה" card with status 200 (`forbidden()` needs
  `experimental.authInterrupts`); their APIs return a real 403.
- #15's preview checklist (a second Google account added, promoted, removed) isn't recorded as done.

**Deferred, smaller**
- The side sheet has no focus management (initial focus, focus trap).
- The trip switcher opens the other trip's home, not the same screen.
- The viewer banner scrolls away rather than staying.

**Temporary code with an end date**
- `src/app/api/[...legacy]/route.ts` (pre-trip API paths): remove in H.
- `users.is_admin`, `users.is_shopper`: unused, dropped in H.
- `VIEWER_USERS` and `importEnvViewer` (hard-codes group 1): remove in phase 7.

**Housekeeping**
- Merged remote branches to delete: `claude/admin-super`, `claude/admin-group`,
  `claude/fix-template-hydration`, `claude/gmail-sign-in`, `claude/handoff-doc`,
  `claude/template-slide-after-commit`.
- Old worktrees to remove (all merged): `.claude/worktrees/gallant-lewin-0fe2b6`,
  `.claude/worktrees/pensive-swanson-0715b1`, `.claude/worktrees/admin-group`,
  `.claude/worktrees/gmail-sign-in`.
- Google Cloud: the hand-added `nav-header` preview callback URI is no longer needed.

## Opening prompts

### Track 1: groups phase 6

```text
Repo /Users/idodwek/camping (GitHub idodjeen/camping). Build groups-and-trips phase 6: the group admin edits a trip's details (name, dates, location), its gear and shopping categories (add, rename, reorder), and its meals and their ingredients.

Read first: AGENTS.md (this Next.js differs from training data; check node_modules/next/dist/docs/), docs/handoff.md (state, rules, testing, and "Two tracks, without stepping on each other"), docs/groups-and-trips.md (phase 6 and Defaults).

Before anything: check no other session or open PR is on this (gh pr list; ListAgents). Roadmap E runs in parallel in another chat: stay on branch claude/trip-content in .claude/worktrees/trip-content, off origin/main, and follow the two-track rules.

No migration while E's PR is open. Gates: npm run typecheck && npm run build, then test locally as made-up p6- users (an admin, an editor, a viewer, someone outside the group) and list what Ido should check on the preview. Deliver: push, gh pr create with a Hebrew title for the campers. Don't merge.
```

### Track 2: roadmap E

```text
Repo /Users/idodwek/camping (GitHub idodjeen/camping). Implement section 6-7 of docs/roadmap.md (group E). groups-and-trips phases 1-5 are already on main.

Read first: AGENTS.md (check node_modules/next/dist/docs/ before using any Next API, especially after() in next/server), docs/handoff.md (state, rules, testing, and "Two tracks, without stepping on each other"), the Overview and sections 2 and 6-7 of docs/roadmap.md, docs/groups-and-trips.md ("Keeping groups apart"), then src/lib/notifications.ts, src/lib/comments.ts, src/lib/queries.ts, src/lib/push.ts, public/sw.js, src/components/notifications.tsx, src/lib/nav.ts and src/db/schema.ts.

Before anything: check no other session or open PR is on this (gh pr list; ListAgents). Groups phase 6 runs in parallel in another chat: stay on branch claude/notifications-core in .claude/worktrees/notifications-core, off origin/main, and follow the two-track rules.

Build: the unify migration (expand only: generated DDL plus a hand-written backfill from drizzle-kit generate --custom; text plus CHECK, no new enums); notify() as the one entry point; the trip-scoped inbox and read routes; grouping by thread_key; the collapsed per-recipient push inside after(); the service worker's tag replacement, its 2-minute renotify rule and setAppBadge; closing delivered notifications on read; the subscription re-post on load; and the one-release adapters for the old endpoints. Every row about a comment or item keeps that row's foreign key with on delete cascade, so deleting a meal, item or comment (phase 6 adds meal deletion) takes its bell rows with it.

Migration: confirm .env.local points at the dev branch and no other migration PR is open. In the PR body, put the SQL that compares unread tags before and after, plus the production steps, including running the tag INSERT again after the deploy.

Rules: viewers get no rows and 403 on read; logical properties only; npm run typecheck && npm run build; run the section's Verification list with three made-up e- accounts and report it.

Deliver: push, gh pr create with a title the campers can read. Don't merge.
```
