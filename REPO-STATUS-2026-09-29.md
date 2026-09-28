# 🏕️ camping — Repository Status

> Snapshot taken **Tue, Sep 29, 2026**, after `git fetch`. The trip runs **Oct 1–3, 2026**.

---

## TL;DR

- **`main` is the source of truth and is in sync with GitHub.** Nothing is waiting locally to be committed or pushed (the only exception is the untracked `.claude/` folder).
- The last piece of work **reverted three features** (app-header menu, photos in chat, Android push fix) and merged that revert into `main`.
- All four branches are **already merged into `main`**, so they can be deleted safely.
- ✅ The reverted photo feature's DB migration `0008_comment_images` **never ran on Neon**, so the database matches the code. See [Database migrations](#-database-migrations).

---

## 📦 Project at a glance

| | |
|---|---|
| **Repo** | [`idodjeen/camping`](https://github.com/idodjeen/camping) (private), remote `origin` over SSH: `git@github.com:idodjeen/camping.git` |
| **Package** | `camping-2026` v1.0.0 |
| **What it is** | Mobile-first Hebrew (RTL) PWA for five friends coordinating a camping trip to the Upper Galilee |
| **Stack** | Next.js **16.3.6** (App Router) · React 19.3 · TypeScript 5.7 · Tailwind v4 · SWR |
| **Data** | Neon Postgres + Drizzle ORM (8 migrations on `main`) |
| **Auth** | Auth.js / NextAuth v5 beta, Google only, email allowlist, plus read-only `VIEWER_USERS` |
| **Extras** | Web Push (VAPID), Nodemailer email reminders, Open-Meteo weather |
| **Hosting** | Vercel Hobby, where a push to `main` deploys to production |
| **Runtime** | Node **≥ 22**, because the Neon driver needs the global `WebSocket` |
| **Size** | 137 tracked files · 50 commits on `main` · first commit Sep 22, 2026 |

**Screens** in `src/app/(app)/`: home, `gear`, `meals`, `shopping`, `me`, `chat`, `room`, `leaderboard`, `expenses`.

---

## 🌿 Branches

| Branch | Tip | Local ↔ remote | Merged into `main`? | Recommendation |
|---|---|---|---|---|
| **`main`** | `9897ce5` Merge branch 'claude/brave-hopper-cnr2ht': revert items 0-2 | ✅ in sync | — | Keep. This is production. |
| `claude/brave-hopper-cnr2ht` *(current)* | `46a4bef` Revert "Move five screens behind an openable menu…" | ✅ in sync | ✅ yes (2 commits behind `main`, 0 ahead) | Safe to delete |
| `claude/viewer-mode` | `4682e3a` Add read-only viewers via VIEWER_USERS | ✅ in sync | ✅ yes (PR #1) | Safe to delete |
| `add-saar-avatar` | `b47d69b` Move personal gear list into a gear filter tab | ✅ in sync | ✅ yes | Safe to delete (stale since Sep 26) |

No tags, no stashes, and a single worktree at `/Users/idodwek/camping`.

### Working tree

```
## claude/brave-hopper-cnr2ht...origin/claude/brave-hopper-cnr2ht
?? .claude/            ← only launch.json (dev-server preview config)
```

`.env.local` and `.vercel/` are git-ignored, which is correct because they hold secrets and local project links.

---

## 🔖 Latest commits

### On `main` (HEAD of production)

```
9897ce5  2026-09-29  Ido       Merge branch 'claude/brave-hopper-cnr2ht': revert items 0-2
```

### On the current branch

```
46a4bef  2026-09-29  Ido  Revert "Move five screens behind an openable menu in a new app header"
                          13 files, +55 / −359. Keeps the viewer-mode read-only banner.
fc1e61e  2026-09-29  Ido  Revert "Send photos in the chat and in item threads"
eca2d4d  2026-09-29  Ido  Revert "Keep Android push alive across endpoint rotations"
```

### Recent history graph

```
*   9897ce5 (main, origin/main) Merge branch 'claude/brave-hopper-cnr2ht': revert items 0-2
|\
| * 46a4bef (HEAD -> claude/brave-hopper-cnr2ht) Revert "Move five screens behind…"
| * fc1e61e Revert "Send photos in the chat and in item threads"
| * eca2d4d Revert "Keep Android push alive across endpoint rotations"
* | c90c4c0 Merge pull request #2 from idodjeen/claude/brave-hopper-cnr2ht
|\|
| * f740ecf Merge branch 'main' into claude/brave-hopper-cnr2ht
* | 6732f6f Merge pull request #1 from idodjeen/claude/viewer-mode
|\ \
| * | 4682e3a (claude/viewer-mode) Add read-only viewers via VIEWER_USERS
|/ /
| * 702ff4d Keep Android push alive across endpoint rotations     ← reverted
| * 0507026 Send photos in the chat and in item threads          ← reverted
| * e2068df Move five screens behind an openable menu…           ← reverted
|/
* a4d736c Move expenses to a bottom-nav tab, drop the home card and account button
* b441ac6 Add Web Push notifications (VAPID) and expenses tracking
```

---

## 🔀 Pull requests

| # | Title | Branch | State | Merged |
|---|---|---|---|---|
| [#2](https://github.com/idodjeen/camping/pull/2) | Claude/brave hopper cnr2ht | `claude/brave-hopper-cnr2ht` | ✅ Merged | 2026-09-28 21:15 UTC |
| [#1](https://github.com/idodjeen/camping/pull/1) | Add read-only viewers via VIEWER_USERS | `claude/viewer-mode` | ✅ Merged | 2026-09-28 20:59 UTC |

The revert (`9897ce5`) went straight to `main` as a local merge and push. It did not go through a PR.

---

## ↩️ What was reverted, and why it matters

| Reverted commit | Feature | What it touched | Note |
|---|---|---|---|
| `e2068df` | App header with a slide-out nav drawer (5 screens moved into a menu) | `app-header.tsx`, `nav-drawer.tsx`, `lib/nav.ts`, `modal.tsx`, `bottom-nav.tsx` | UI only. Bottom nav is back to its previous layout. |
| `0507026` | Photos in chat and item threads (Cloudinary) | `image-picker`, `lightbox`, `chat-image`, `api/uploads/sign`, `lib/cloudinary.ts`, **`db/schema.ts` + migration 0008** | ⚠️ Includes a DB migration, see below |
| `702ff4d` | Android push kept alive across endpoint rotations | `public/sw.js`, `push-sync.tsx`, `api/push`, `badge-icon` | The service worker was changed. Clients that installed it may cache the old SW until it updates. |

All three were authored by Claude on Sep 26 and were **never on `main` in isolation**. They came in through PR #2 and were then reverted.

---

## 🗄️ Database migrations

On `main` (`drizzle/`):

```
0000_misty_titanium_man   0004_notifications
0001_empty_inhumans       0005_personal_qty
0002_harsh_darwin         0006_expenses
0003_general_chat         0007_push_subscriptions
```

**Reverted migration `0008_comment_images`:**

```sql
ALTER TABLE "comments" ADD COLUMN "image_public_id" text;
ALTER TABLE "comments" ADD COLUMN "image_width" integer;
ALTER TABLE "comments" ADD COLUMN "image_height" integer;
ALTER TABLE "comments" ADD CONSTRAINT "comments_has_content"
  CHECK (length("comments"."body") > 0 OR "comments"."image_public_id" IS NOT NULL);
```

✅ **Checked on Sep 29: 0008 was never applied.** Neon's `drizzle.__drizzle_migrations` has exactly 8 rows, which match 0000–0007 on `main`, and `comments` has no `image_*` columns. The schema and the code are in sync, so no migration or cleanup is needed.

---

## 🚀 How work flows here (commit → push → deploy)

```
feature branch ──commit──▶ git push (SSH) ──▶ GitHub PR ──merge──▶ main ──▶ Vercel prod deploy
```

**Day-to-day commands**

```bash
git switch main && git pull                 # start from latest
git switch -c claude/<feature>              # branch
npm run typecheck && npm run build          # verify locally
git push -u origin claude/<feature>         # push over SSH
```

**Things specific to this repo:**

1. **`gh` is signed in through the browser (OAuth, `repo` scope) as of Sep 29**, so `gh pr create` works from this machine. The old fine-grained token that couldn't open PRs has been replaced. Delete it on GitHub if you haven't yet.
2. **Vercel env vars:** only *Config*-typed variables reach the runtime on this project. *Secret*-typed ones don't. When adding keys (VAPID, SMTP, Cloudinary…), make them Config vars.
3. **Schema changes:** edit `src/db/schema.ts`, run `npm run db:generate`, commit the SQL and `drizzle/meta/*`, then run `npm run db:migrate` against Neon. Migrations don't run automatically on deploy.
4. **`AGENTS.md` is rewritten by `next dev`.** If it shows up as modified, commit it so the tree stays clean.
5. **Next.js 16 differs from older versions.** Check `node_modules/next/dist/docs/` before relying on older conventions (for example, middleware lives in `src/proxy.ts`).
6. **Preview deploys write to the production database.** `DATABASE_URL` is set for both Preview and Production on Vercel. Anything you click on a `camping-git-*.vercel.app` preview changes real trip data. After the trip, consider a Neon branch just for previews.
7. **What's-new popup:** the app shows a pop-up once per deployed commit, so commit messages are user-facing. Keep them readable.

---

## ✅ Suggested housekeeping

- [x] Verify whether migration 0008 ran on Neon (it didn't, so there's nothing to do)
- [x] Drop the broken `lint` script (Next 16 removed `next lint`) and document `GMAIL_*` in `.env.example`
- [x] Delete the merged branches, locally and on the remote:
  ```bash
  git push origin --delete add-saar-avatar claude/viewer-mode claude/brave-hopper-cnr2ht
  git branch -d add-saar-avatar claude/viewer-mode claude/brave-hopper-cnr2ht
  ```
- [x] Commit `.claude/launch.json` so Claude Code previews work on any machine
- [ ] Remove the unused `CLOUDINARY_*` variables from Vercel. They're left over from the reverted photo feature.
- [ ] Before the trip (Oct 1), freeze `main` and deploy only hotfixes
