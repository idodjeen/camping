# Handoff

> Refreshed 2026-10-08, night, after groups phase 6 (#18), invite emails (#19) and roadmap E (#20).
> The plan is `docs/groups-and-trips.md`, the roadmap is `docs/roadmap.md`, and the architecture
> design brief is `docs/architecture-handoff.md`. This file is the state and the rules. Opening
> prompts are at the end.

## Where things stand

| Area | Status |
|---|---|
| Groups and trips, data kept apart per group | Live: phases 1-2 (#5, #7) |
| Header, 3 tabs, menu, trip switcher | Live: phase 3 = roadmap C (#9), slide fixes #11, #12 |
| Super-admin page `/admin`: create groups, see each group's trips | Live: phase 4 (#13), #19 |
| Group admin page `/g/[groupId]`: members, roles, new trips, who is on each trip | Live: phase 5 (#15) |
| Invite email to people added to a group | Live: #19 |
| Trip management `/t/[tripId]/manage`: details, categories, meals (group admins) | Live: phase 6 (#18) |
| Notifications: one table, bell grouped by thread, one push per thread, close on read, icon badge | Live: roadmap E (#20) |
| Sign-in matches Gmail spellings; refused sign-ins are logged | Live: #16 |
| Chat: צ׳אט כללי button in the sticky bar, no zoom, no sideways drag | Live: #23, checked on an iPhone 2026-10-08 |
| Expenses: edit, categories, chart | Live: roadmap B (#10) |
| Safety rails: guarded migrations, reload guard, error screens | Live: roadmap A (#6, #8) |
| Production database | 13 migrations (0000-0012), confirmed 2026-10-08 after #20 |
| `dev` database | Same 13; used by local work **and** every preview |
| Preview push | Own VAPID pair on Preview (Config), added 2026-10-08. Previews can now send push |

**#20 in production (2026-10-08).** Migrated before the merge, deployed, and the post-deploy
catch-up SQL from the PR body found nothing to fix (0 rows each). Unread tags match between
`comment_mentions` and `notifications` (10 and 10, per person too). From now on the new table may
only have *fewer* unread tags than the old one, because the app no longer writes `comment_mentions`.

## What's next

In order, one at a time unless both sides agree on the parallel rules below:

1. **Groups phase 7** (cleanup): remove the hard-coded names ("רק עידו וניר…", "דברו עם עידו"),
   scope reminders to a trip, remove `VIEWER_USERS` and `importEnvViewer`, update the README. Best
   before F, since both touch reminders.
2. **Roadmap F** (more notification kinds, item 8). `notify()` and the 12-kind CHECK already exist, so
   F's only migration is `notify_prefs`.
3. **Roadmap G** (edit messages, item 5).
4. **Roadmap H** (cleanup), about a week after E, F and G are live.

**Architecture design** can run alongside any of these: it only writes `docs/`. Brief:
`docs/architecture-handoff.md`.

### Parallel work, without stepping on each other

- **Own branch, own worktree, own PR.** Never edit another session's worktree, and keep the main
  folder on `main`. Git never silently overwrites: anything two branches both change shows up as a
  conflict on the second merge.
- **Check the overlap before merging second.** `git merge-tree --write-tree origin/main origin/<branch>`
  tries the merge in memory and touches no folder. A clean result still needs typecheck and build on
  the merged tree (a throwaway worktree of the merge commit works; that is how #18 was checked
  against #20).
- **Whoever merges second** syncs with `main` first, resolves conflicts, runs typecheck and build
  again, then merges.
- **One migration PR open at a time.**
- **Shared `dev` database.** Test rows use the session's own email prefix (`p6-…`, `e-…`, ...) and
  each session deletes only its own. Don't "Reset from parent" on `dev` without asking.
- **Ports and `launch.json`.** `preview_start` reads `.claude/launch.json` from the **main folder**:
  add your own entry on your own port, and remove only that entry when done.

### Decisions waiting on Ido

- **Google OAuth consent screen: Testing to In production**, if it isn't yet.
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
  That includes NOT NULL on a new column the previous deploy doesn't write (see #20's `thread_key`).
- `text` + `CHECK`, never a new Postgres enum: all pending files run in one transaction.
- Read the generated SQL. drizzle-kit can emit a foreign key before the unique key it needs (#20).
- **Ido runs `npm run db:migrate` on `dev`.** The sandbox refuses it as a shared-resource write.
  Inserting and deleting your own test rows on `dev` is allowed.
- Production, **before** merging an expand migration: count, migrate, count again, then merge.
  Run every command from the PR's worktree (the main folder has no new migration files yet).
  ```
  psql "$(sed -nE 's/^# DATABASE_URL="?([^"]*)"?$/\1/p' .env.local)" -c "select count(*) from drizzle.__drizzle_migrations"
  CONFIRM_PROD=1 DATABASE_URL="$(sed -nE 's/^# DATABASE_URL="?([^"]*)"?$/\1/p' .env.local)" npm run db:migrate
  ```
  Put the steps in the PR body, including any post-deploy step, so nothing is forgotten after the merge.

**Merging and deploying**
- **Squash and merge.** A regular merge commit's heading is "Merge pull request #N from ...", which is
  what the pop-up shows campers. `[no-popup]` in the title still silences chores.
- **A PR with one commit squashes under that commit's message, not the PR title.** #18 went out with
  its English commit line. Merge with `gh pr merge <n> --squash --subject "<the Hebrew PR title> (#<n>)"`,
  or edit the title in GitHub's merge dialog.
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
  lists with `lib/people.ts`; names are unique per **group**, re-checked inside the transaction.
  Request bodies with people go through `readPerson()` / `readPeople()` in `lib/groups.ts`.
- Super-admin routes use `requireSuperAdmin()` (`lib/session.ts`).
- Every viewer write gets 403, and every Verification list includes a viewer.
- **Notifications go through `notify()` only** (`lib/notifications.ts`), after your own write commits,
  never inside a transaction holding a row lock. It picks recipients (the trip's people, never the
  actor, never viewers), applies the switches, writes rows, and pushes in `after()`. Thread keys and
  push tags come from `lib/threads.ts`, which the client also imports. Every row about a comment or
  item references it with a cascading composite key.
- Client calls go through `useTrip()` (`lib/trip-client.ts`): `api("/gear")`, `page("/gear")`. Unread
  counts and reads go through `useInbox()` (`lib/inbox-client.ts`), one poll for every badge.
- Navigation: `NAV` in `lib/nav.ts`. Screens inside a trip are plain rows; app-wide pages like `/admin`
  use `appItem(…)` with `adminOnly` / `superAdminOnly` and `canSee()`. Per-group links
  (`/g/[groupId]`) are their own row in `NavMenu` (`components/app-header.tsx`).
- Layout: bar heights only from `--app-header-h` / `--bottom-nav-h` (`globals.css`). Sticky under the
  header uses `top-(--app-header-h)`, above the nav `bottom-(--bottom-nav-h)`. Nothing `position:
  fixed` inside `template.tsx`'s subtree. Overlays portal to `<body>` and use `lib/use-overlay.ts`.
- No zoom (#23): the viewport sets `maximum-scale=1, user-scalable=no`, and `<html>` has
  `touch-action: pan-x pan-y` (iOS ignores `user-scalable`). Fields are at least 16px on touch
  screens (`globals.css`), because iOS zooms into smaller ones on focus and a zoomed page also turns
  off `useKeyboardFlag`. Don't override that size. `body` has `overflow-x: clip`; never `hidden` on
  `html`/`body`, which breaks every sticky bar.
- z-order: page bars 10-20, header 30, nav 40, toasts 50, banner and lightbox 60, sheets 65,
  onboarding 70.
- Never change module state during render (React may render twice); record it in an effect.
- RTL: logical properties only; physical framer-motion `x` multiplies by `startSign()`.
- Docs and PR text: hyphens, never em or en dashes.

## Testing

- **Previews are first-class.** They run on `dev`, sign-in works through `AUTH_REDIRECT_PROXY_URL`,
  and since 2026-10-08 they can send push with their own VAPID pair. A preview is the deployment
  Vercel builds for every pushed branch, at `camping-git-<branch>-idodjeen.vercel.app`; Ido signs in
  there (a Claude session can't do Google sign-in itself). New Preview variables reach a preview only
  on its next deployment.
- **A refused sign-in** logs `sign-in refused for <email>`: `vercel logs --environment production
  --since 1h --json`.
- **Locally, as made-up users** (never as a real person, never against production):
  - `.env.development.local` holds a local-only `AUTH_SECRET`, so a minted session is useless on
    production. Never mint with `.env.local`'s secret. Don't print either.
  - Insert test rows on `dev` (check the host is `ep-icy-violet` first), mint with `encode` from
    `node_modules/@auth/core/jwt.js` (salt `authjs.session-token`, token `{ email, uid, sub }`), and
    delete the rows afterwards. A separate test group with its own trips keeps them out of trip 1.
  - Keep tokens in files and the shell. A small curl wrapper that sends `authjs.session-token` from a
    file covers every API check.
  - **The dev server:** add a `launch.json` entry in the main folder that runs
    `<worktree>/node_modules/.bin/next dev <worktree> -p <port>`, and in the worktree's own
    `.env.development.local` set `DATABASE_URL` to the unpooled URL.
  - **In the browser:** use a fresh `*.localhost` host with a temporary `allowedDevOrigins` entry,
    reverted before commit. To get the session in without the token entering the transcript, copy it
    to a temporary `public/<name>.svg` (the proxy skips `.svg`), `fetch` it into `document.cookie`,
    then delete the file. New test users meet the onboarding sheet first ("דילוג").
  - **Push payloads without a phone:** run the real code (`createComment`, `setClaim`) in a script
    inside a transaction that rolls back (swap `globalThis.__campingDb` for the transaction, as
    `scripts/simulate-untagged.ts` does), with a throwaway VAPID pair, a fake subscription pointing
    at a local HTTPS server, and `NODE_EXTRA_CA_CERTS` for that server's certificate. Decrypt what
    arrives with `http_ece` (already installed). `sw.js` can be run in a Node `vm` with a fake `self`.
- **Traps:**
  - In a hidden browser pane `requestAnimationFrame` barely runs, so the page's slide-in stays at its
    first frame and sticky positions read about 3% off. Read the DOM, not screenshots.
  - The `dev` database drops connections now and then. Re-run the step, and check what landed.
  - Editing `next.config.ts` restarts the dev server; don't edit it mid-test.
  - The auto-mode classifier sometimes refuses writing the minted token to `public/*.svg`, and once
    it has, it may refuse later `psql` writes on `dev` too (2026-10-08, #23). Then verify on the
    preview, and hand Ido the cleanup SQL for your test rows.
  - `psql -c "a; b; c"` prints only the last statement's result; pipe the SQL in to see each one.
  - The first `npx next typegen` in a fresh worktree can take minutes.
  - After deleting a throwaway route, remove `.next/dev` or `tsc` trips on stale route types.
  - `typedRoutes` checks need `.next/types` (`npx next typegen` or a build).

## Open items

**Never verified on a real phone**
- Header and menu (#9): the header clearing the notch, the banner and toasts under the status bar,
  swipe-to-close. (The keyboard in the chat room was checked on an iPhone with #23.)
- Notifications (#20): one notification per thread that updates in place, the 2-minute renotify rule,
  closing it when the thread is read, the app-icon badge, and "mark all" clearing them. Checked only
  in code and with simulated pushes. The checklist is in #20's body, and previews can now push.

**From phases 4-6**
- `/admin` and `/g/[groupId]` show their "אין הרשאה" card with status 200 (`forbidden()` needs
  `experimental.authInterrupts`); their APIs return a real 403.
- #15's preview checklist (a second Google account added, promoted, removed) isn't recorded as done.

**Deferred, smaller**
- The side sheet has no focus management (initial focus, focus trap).
- The trip switcher opens the other trip's home, not the same screen.
- The viewer banner scrolls away rather than staying.
- A list row's "תייגו אותך" marker clears on that list's next 15s poll after its thread is read, not at once.

**Temporary code with an end date (H)**
- `src/app/api/[...legacy]/route.ts` (pre-trip API paths).
- #20's adapters: `GET/POST/PATCH /api/t/[tripId]/notifications`, `POST .../comments/read`,
  `POST .../chat/read`, and `unreadMentions` in `/api/t/[tripId]/me`.
- `comment_mentions` (no longer written), `users.is_admin`, `users.is_shopper`; `notifications.thread_key`
  becomes NOT NULL.

**Housekeeping**
- Merged remote branches to delete: `claude/notifications-core`, `claude/trip-content`, and any
  older `claude/*` branch that `gh pr list --state merged` lists.
- Worktrees to remove once their sessions are closed: `.claude/worktrees/notifications-core`,
  `.claude/worktrees/trip-content`.
- The main folder is on `main`; `git pull` there brings it up to date.
- Google Cloud: the hand-added `nav-header` preview callback URI is no longer needed.

## Opening prompts

### Groups phase 7

```text
Repo /Users/idodwek/camping (GitHub idodjeen/camping). Build groups-and-trips phase 7, the cleanup: remove the hard-coded names ("רק עידו וניר…", "דברו עם עידו" and any other person's name in the UI text), scope the admin reminders to a trip, delete VIEWER_USERS and importEnvViewer, and update the README.

Read first: AGENTS.md (this Next.js differs from training data; check node_modules/next/dist/docs/), docs/handoff.md (state, rules, testing), docs/groups-and-trips.md (phase 7, Roles, Defaults), then lib/emails.ts, components/admin-notify.tsx, the admin notify route and lib/session.ts.

Before anything: check no other session or open PR is on this (gh pr list; ListAgents). Branch claude/groups-phase-7 in .claude/worktrees/groups-phase-7, off origin/main.

If it needs a migration, follow the migration rules in docs/handoff.md (Ido runs db:migrate on dev). Gates: npm run typecheck && npm run build, then test locally as made-up p7- users (a super admin, a group admin, an editor, a viewer, someone outside the group) and list what Ido should check on the preview. Deliver: push, gh pr create with a Hebrew title for the campers. Don't merge.
```

### Architecture design

The brief and its own opening prompt: `docs/architecture-handoff.md`.
