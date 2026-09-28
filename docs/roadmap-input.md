# Roadmap input: items 0-7

> The raw material for the redesign. It comes from the Sep 28 handoff. Items 0-2 were built on
> `claude/brave-hopper-cnr2ht`, shipped in PR #2, and then **reverted** on Sep 29 (`9897ce5`). They are
> being redesigned from scratch. Items 3-7 were never started.
>
> This file is input, not a plan. The plan goes in `docs/roadmap.md`.

## Constraints that apply to every item

- **Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (CSS-first, no JS config), Drizzle and Neon Postgres, Auth.js v5 (Google only, env allowlist and `VIEWER_USERS` read-only guests), SWR with 15s polling and **no realtime layer**, and Web Push over VAPID. Hosted on Vercel Hobby.
- **Read `AGENTS.md` first.** This Next.js version differs from training data, so check `node_modules/next/dist/docs/` before writing code.
- **Hebrew and RTL.** There is no i18n layer. Use CSS logical properties (`start-*`/`end-*`/`ms-*`/`me-*`) and never `left-*`/`right-*`/`ml-*`/`mr-*`. framer-motion's `x` is physical, so any slide animation must read the direction at runtime.
- **Viewers are read-only.** Every new write path must reject them (403), as the existing routes do.
- **No test suite.** The gates are `npm run typecheck` and `npm run build`. `npm run lint` does not exist, because Next 16 removed `next lint`.
- **Migrations run by hand** (`db:generate`, commit, `db:migrate`). Preview deploys currently share the **production** database.
- **Every deploy to `main` shows campers a pop-up** with the commit message. Add `[no-popup]` to chore commits.

## Items

### 0. Navigation: fewer tabs, the rest behind a menu
The bottom bar has 8 tabs, which is too many for a phone. The previous attempt kept 3 tabs (בית, ציוד, צ׳אט) and moved the other five into a drawer opened from a new sticky header, which also held the menu button, the title and the bell.
- **Worth keeping:** the tab list was hand-kept in three places, and one had already drifted: `template.tsx` was missing `/expenses`. A single source of truth for nav (order, primary vs secondary, badges) fixes that.
- **Unread badges** must show on the menu row and on the menu button.
- **Sticky bars** in `/room` and `/chat` must sit below any header, not under it. The chat composer must not be hidden by the nav.
- **Knock-on effect:** item 3's video mockup shows the nav, so it needs re-recording after this item.

### 1. Photos in chat and item threads
- **Previous design:** Cloudinary signed uploads (raw HTTP, no SDK). Store only the `public_id` plus width and height, never a URL, so image transformations aren't frozen into old rows and a bubble reserves its space before the image loads. A caption-less photo is allowed, enforced by a CHECK that requires text *or* an image. Resize to 1600px JPEG in the browser, which also strips EXIF GPS. Deleting a message deletes the asset. The push and bell preview for a photo is "📷 תמונה".
- **Requirements:** a new migration on `comments`. `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` already exist on Vercel (Config, Production only).
- **Watch out:** the chat follows new messages by comparing scroll position, so any late reflow yanks the reader.

### 2. Android push reliability
Android Chrome rotates push endpoints, and the old subscription silently dies.
- **Previous design:** a `pushsubscriptionchange` handler in `public/sw.js` re-subscribes and reports which endpoint it replaces. On every app load, a component re-announces the current subscription and never prompts. Add a monochrome badge icon for the Android status bar; it must be excluded from the auth matcher in `src/proxy.ts`. Sending moves to `after()` so it doesn't block the response.
- **Verify on a real device:** delivery while the app is closed, a tap that deep-links, and the rotation path a day later.

### 3. Music for the walkthrough video
The video is a **separate Remotion project** (`remotion-showcase`), not this repo. It depends on item 0, because the mockup shows the old nav.

### 4. Carpool
**Planning only for now: no code.** Who drives, seats, who rides with whom, departure point and time.

### 5. Edit messages
Needs `edited_at`, a PATCH on `/api/comments/[id]`, and a **re-run of `findMentions()`** on the new body. Otherwise `comment_mentions` rows point at text that no longer exists, and newly added mentions are never notified. The closest existing inline-edit pattern is `src/components/personal-list.tsx`.

### 6. Collapse notifications
"3 people commented on the gas stove" instead of 3 separate rows.

### 7. Mark all read and mark one read

**Items 6 and 7 are one design problem.** The bell merges **two tables**, `notifications` and `comment_mentions`. Each has its own `readAt`, and `comment_mentions` has no endpoint for marking a single row read. Grouping and read state have to be designed across both tables, or merged into one.

## Suggested grouping

| Group | Items | Why |
|---|---|---|
| Navigation | 0 | Touches every screen, so do it first |
| Chat | 1, 5 | Both change `comments` and both need a migration |
| Notifications | 2, 6, 7 | All three touch the bell and push |
| Carpool | 4 | Plan only |
| Video | 3 | Separate repo, after 0 |
