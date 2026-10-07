# Handoff: one chat at a time from here

> Written 2026-10-08 from four sessions' notes (groups phases 1-2, the header and menu, the super-admin
> page, the roadmap). Until now several Claude sessions built in parallel. From here on, work happens in
> **one chat at a time**: start it with the prompt at the end of this file. The plan is
> `docs/groups-and-trips.md`, the roadmap is `docs/roadmap.md`. This file is the state and the rules.

## Where things stand

| Area | Status |
|---|---|
| Groups and trips, data kept apart per group | Live: phases 1-2 (#5, #7) |
| Header, 3 tabs, menu, trip switcher | Live: phase 3 = roadmap C (#9), slide fixes #11, #12 |
| Super-admin page `/admin`: create groups | Live: phase 4 (#13) |
| Expenses: edit, categories, chart | Live: roadmap B (#10) |
| Safety rails: guarded migrations, reload guard, error screens | Live: roadmap A (#6, #8) |
| Production database | 11 migrations (0000-0010), confirmed 2026-10-08 |
| `dev` database | Same 11; used by local work **and** every preview |

## What's next, in order

1. **Groups phase 5: the group admin's page `/g/[groupId]`.** Members (add, remove, change role),
   creating a trip (from the template or an earlier trip), each trip's people and shoppers. Until it
   lands, **a new group has no trip**, so its members see an empty `/trips`.
2. Then **groups phases 6-7** and **roadmap E** (notifications core) in either order, one migration PR
   at a time.
3. Then **F** (more notification kinds), **G** (edit messages), and **H** (cleanup) about a week after
   E, F and G are live.

### Decisions waiting on Ido

- **Google OAuth consent screen: Testing to In production.** Needed before anyone added on `/admin`
  can sign in. Otherwise each new person must also be listed as a test user in Google Cloud.
- Primary tabs: בית, ציוד, צ׳אט were a default, never chosen. It's one `primary` flag in `lib/nav.ts`.
- After phase 5: notifications (E) first, or phases 6-7 first.
- Item 8: admin reminders as push with no switch (current plan), or a fifth switch.
- `CLOUDINARY_*` on Vercel (photos deferred): keep or remove.

## Rules (keep these)

**Before starting**
- Check nobody else has it: running sessions, `gh pr list --state open`, unmerged remote branches.
- Keep the main folder on `main`; never switch branches there while another session is live. Work in
  `git worktree add -b claude/<name> <path> origin/main`, stage files by name, never `git add -A`.

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
- Writes name their trip explicitly: `trip_id` has no default since 0010, so a forgotten one fails.
- People on a trip come from `tripPeople()` (`lib/trips.ts`), not all users.
- Create users only with `createUser(tx, {email, name})` (`lib/user.ts`). Validate names and pasted
  lists with `lib/people.ts` (`nameProblem`, `parsePeople`, `clashes`, `nameKey`); names are unique
  per **group**, re-checked inside the transaction (see `createGroup()` in `lib/groups.ts`).
- Super-admin routes use `requireSuperAdmin()` (`lib/session.ts`). Group-admin routes need a new
  group-level gate (`requireTrip(…, "admin")` is per trip); 404 for non-members, 403 for members who
  aren't admins.
- Every viewer write gets 403, and every Verification list includes a viewer.
- Client calls go through `useTrip()` (`lib/trip-client.ts`): `api("/gear")`, `page("/gear")`.
- Navigation: `NAV` in `lib/nav.ts`. Screens inside a trip are plain rows; app-wide pages like `/admin`
  use `appItem(…)` (`outsideTrip`, kept out of the slide order) with `adminOnly` / `superAdminOnly`
  and `canSee()`. A per-group link such as `/g/[groupId]` needs a per-group href, which the static
  list can't express: add it as its own block in the menu (`components/app-header.tsx`).
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

- **Previews are first-class now.** They run on `dev`, and sign-in works through
  `AUTH_REDIRECT_PROXY_URL`. Ido signs in on the branch alias (`camping-git-<branch>-idodjeen.vercel.app`);
  a Claude session can't do Google sign-in itself.
- **Locally, as made-up users** (never as a real person, never against production):
  - `.env.development.local` holds a local-only `AUTH_SECRET`, so a minted session is useless on
    production. Never mint with `.env.local`'s secret: that one is production's.
  - Insert test rows on `dev` (check the host is `ep-icy-violet` first), mint with `encode` from
    `node_modules/@auth/core/jwt.js` (salt `authjs.session-token`), and delete the rows afterwards.
  - The browser pane has someone's real HttpOnly cookie on `localhost`: browse `http://127.0.0.1:<port>`
    with a temporary `allowedDevOrigins: ["127.0.0.1"]`, reverted before commit.
  - Some sessions' auto mode blocks reading a token into the conversation; keep it in the shell (curl).
  - `.claude/launch.json` is tracked: revert any temporary entry. Ports 3000, 3001 and 3010 have been
    used by parallel sessions.
- **Traps:**
  - In a hidden browser pane `requestAnimationFrame` doesn't run (or runs about every 300ms), so the
    page's slide-in stays at its first frame (`scale(0.97)`) and sticky positions read about 3% off.
    Read the DOM, not screenshots.
  - In a worktree, the main folder's pooled `DATABASE_URL` has failed auth; use `DATABASE_URL_UNPOOLED`
    (same `dev` branch).
  - After deleting a throwaway route, remove `.next/dev` or `tsc` trips on stale route types.
  - `typedRoutes` checks need `.next/types` (`npx next typegen` or a build).

## Open items

**Never verified on a real iPhone** (header and menu, PR #9): the header clearing the notch, the banner
and toasts under the status bar, the keyboard in the chat room (`lib/use-keyboard.ts` is an unproven
heuristic: "open" is `visualViewport` more than 150px below the tallest seen), and swipe-to-close by
touch. Also unchecked: the tag badge from a second member, and the viewer layout.

**Deliberately left for phase 5** (from phase 4):
- Someone removed from every group gets 404s; they should land on `/no-access`.
- No self-removal, and no demoting the last admin.
- `/admin` shows its "אין הרשאה" card with status 200 (`forbidden()` needs
  `experimental.authInterrupts`); its API returns a real 403.
- `/admin` was never checked while signed in on a preview (sign-in was broken there until Oct 8).

**Deferred, smaller**
- The side sheet has no focus management (initial focus, focus trap).
- The trip switcher opens the other trip's home, not the same screen.
- The viewer banner scrolls away rather than staying.

**Temporary code with an end date**
- `src/app/api/[...legacy]/route.ts` (pre-trip API paths): remove in H.
- `users.is_admin`, `users.is_shopper`: unused, dropped in H.
- `VIEWER_USERS` and `importEnvViewer` (hard-codes group 1): remove in phase 7.

**Housekeeping**
- Merged remote branches to delete: `claude/admin-super`, `claude/fix-template-hydration`,
  `claude/template-slide-after-commit`.
- Old worktrees to remove (both clean): `.claude/worktrees/gallant-lewin-0fe2b6`,
  `.claude/worktrees/pensive-swanson-0715b1`.
- Google Cloud: the hand-added `nav-header` preview callback URI is no longer needed.

## Opening prompt for the next chat

```text
Repo /Users/idodwek/camping (GitHub idodjeen/camping). Build groups-and-trips phase 5: the group admin's page at /g/[groupId].

Read first: AGENTS.md (this Next.js differs from training data; check node_modules/next/dist/docs/), docs/handoff.md (state, rules, testing, open items), docs/groups-and-trips.md (phase 5 and Defaults), and section 10 of docs/roadmap.md.

Before anything: check no other session or open PR is on this (gh pr list; ListAgents), and work in a worktree off origin/main, not in the main folder.

Build: a group-level gate (404 for non-members, 403 for non-admins); add, remove and change the role of members (reuse createUser, lib/people.ts, inviteMessage); no self-removal and no demoting the last admin; send someone removed from every group to /no-access; create a trip from the template (src/db/seed-data.ts) or by copying an earlier trip in the group; choose each trip's people and shoppers. Removing someone with expenses on a trip is blocked (see Defaults). Add the /g/[groupId] link to the header menu as its own block for group admins.

Migration only if needed, expand-only, and say in the PR body to run it on production before merging. Gates: npm run typecheck && npm run build, then test on the PR preview (Ido signs in) and locally as made-up users, including a viewer and someone outside the group. Deliver: branch, push, gh pr create with a Hebrew title for the campers. Don't merge.
```
