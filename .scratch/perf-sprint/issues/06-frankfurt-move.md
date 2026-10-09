# P06: Move to Frankfurt

**What to build:** The functions run in Frankfurt (`fra1`) and the database in AWS eu-central-1, so a server
call stops crossing the Atlantic. Expected gain: about 0.1 s per server call (the Frankfurt to Virginia leg).
Cold starts and Neon's wake-up after 5 idle minutes don't change.

**Blocked by:** P03 and the measure step. **Ido runs every production database step himself, and gives the
go for each production change.**

**Status:** ready-for-agent

**Files touched:** `vercel.json` (`regions`), `docs/handoff.md`, `docs/architecture.md`. Outside git: a new Neon
project, Vercel environment variables, `.env.local`.

- [ ] The rehearsal on a preview works end to end (section 2)
- [ ] Production cut over with Ido's go (section 3); `x-vercel-id` reads `fra1::fra1`
- [ ] The old project is kept for a week as the rollback (section 4), then archived and deleted (section 5)
- [ ] `PROD_DB_HOST` in `.env.local` names the new production host, and the prod guard refuses it without `CONFIRM_PROD=1`
- [ ] Done per the spec's definition of done

## Measured before and after

| | Before (2026-10-09) | After |
|---|---|---|
| `x-vercel-id` from Israel | `fra1::iad1` | |
| One warm server call from Ido's Mac (`curl`, request to first byte) | 0.23-0.36 s | |
| Database region | AWS us-east-1 | |

## Facts this runbook relies on (checked 2026-10-10)

- Functions: `iad1`, Fluid on. Neon project in AWS us-east-1: branch `main` is production (`ep-frosty-math`),
  branch `dev` is local work and every preview (`ep-icy-violet`). The app uses the direct (non-pooler) URL.
- Postgres 18.6, about 10 MB. Schemas: `public` (20 tables), `drizzle` (the migration journal, which must come
  along) and `neon_auth` (unused, not copied). Extensions: `plpgsql` only.
- Ido's Mac has `pg_dump` 14, which refuses a Postgres 18 server.

This runbook is a draft until the rehearsal has run it once.

## 0. Once, before anything

1. Check that the Neon Free plan allows a second project. If it doesn't, stop and decide (a paid month, or
   another order) before going on.
2. `brew install postgresql@18`, then in every shell below: `PG=/opt/homebrew/opt/postgresql@18/bin`.
3. Neon console, New project: name `camping-eu`, Postgres 18, region AWS Europe Central 1 (Frankfurt).
   Create it in Neon itself, not through the Vercel integration: the app reads a hand-added `DATABASE_URL`.
4. Keep the dump files outside the repo, in `~/camping-move/` (they hold everyone's emails), and delete them
   after section 5.

## 1. The copy (used by sections 2, 3 and 4)

In a shell in `~/camping-move/`:

```bash
PG=/opt/homebrew/opt/postgresql@18/bin
OLD="$(sed -nE 's/^# DATABASE_URL="?([^"]*)"?$/\1/p' /Users/idodwek/camping/.env.local)"   # production today
read -rs NEW   # paste the new project's direct URL for its main branch; nothing is echoed

"$PG/pg_dump" --format=custom --no-owner --no-privileges --schema=public --schema=drizzle \
  --file=camping-prod.dump "$OLD"
"$PG/pg_restore" --list camping-prod.dump | grep -v -E ' SCHEMA - public | COMMENT - SCHEMA public ' > camping-prod.list
"$PG/pg_restore" --no-owner --no-privileges --exit-on-error --use-list=camping-prod.list \
  --dbname="$NEW" camping-prod.dump
```

When `NEW` already has data (the cutover, after the rehearsal), add `--clean --if-exists` to the last command.
The list file leaves out the `public` schema itself, which every new database already has.

Then compare every table's row count and the migration count. The two outputs must be the same:

```bash
counts() { "$PG/psql" "$1" -X -A -t \
  -c "select table_name || ' ' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1" \
  -c "select 'migrations ' || count(*) from drizzle.__drizzle_migrations"; }
diff <(counts "$OLD") <(counts "$NEW") && echo "same"
```

## 2. Rehearsal (production untouched)

1. Run section 1, then in the Neon console create a branch `dev` from the new `main`.
2. If an open PR has a migration that is on today's `dev` but not on production, apply it to the new `dev`
   from that PR's worktree: `DATABASE_URL="<new dev direct URL>" npm run db:migrate`.
3. Vercel, Settings, Environment Variables: set `DATABASE_URL` for **Preview** and **Development** to the new
   `dev` branch's direct URL (type Config, as today). From now on every preview uses the new `dev`.
4. The P06 PR adds `"regions": ["fra1"]` to `vercel.json`. Its preview runs in Frankfurt against the new `dev`.
5. On that preview: sign in, open every screen, post and delete a message in the general chat, then
   `curl -sI https://<the preview>/login | grep -i x-vercel-id` reads `fra1::fra1::...`.
6. Run the timing loop from the P02/P03 measure step against the preview and note the numbers here.

## 3. Cutover (Ido's go; about 15 minutes, late evening)

1. Tell the group the app pauses for about 10 minutes. Check nobody is active:
   `vercel logs --environment production --since 10m` shows no `/api/t/` requests.
2. Run section 1 again with `--clean --if-exists`, and check the counts match.
3. Vercel, Settings, Environment Variables: set **Production** `DATABASE_URL` to the new `main`'s direct URL
   (type Config). This does nothing until the next production build.
4. Merge the P06 PR. Its production build picks up the new region and the new `DATABASE_URL`.
5. Check: `curl -sI https://camping-rosy.vercel.app/login | grep -i x-vercel-id` reads `fra1::fra1::...`;
   sign in, open every screen, post and delete a message; `vercel logs --environment production --since 15m
   --level error` is empty; the Neon console shows activity on the new project only.
6. `.env.local`: the commented production lines and `PROD_DB_HOST` name the new `main`; `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED` name the new `dev`. Then, from the main folder,
   `DATABASE_URL="$NEW" node scripts/prod-guard.mjs check` must refuse it as production. From here on, never
   point anything at the old project.
7. Update `docs/handoff.md` (the endpoints) and `docs/architecture.md` (the regions).

## 4. Rollback (any time in the first week)

- **In the first minutes, before anyone wrote anything:** Vercel, Deployments, the last production deployment
  from before the move, Instant Rollback. That deployment keeps its own region and database URL, so production
  is back on Virginia and the old database at once. Then set Production `DATABASE_URL` back and revert the P06
  PR, so the next build stays there. (On Hobby, Instant Rollback only reaches the deployment right before the
  current one. If anything deployed after the move, roll back by setting the variable back and reverting the
  PR instead.)
- **Later:** new writes exist only in the new database. Pause the app as in section 3.1, run section 1 with
  `OLD` and `NEW` swapped and `--clean --if-exists` (new to old), check the counts, then roll back as above.

## 5. After one week

1. If nothing went wrong: one last dump of the old project into `~/camping-move/` as an archive, then delete
   the old Neon project, and the Vercel integration's `check_env_*` variables if they belong to it.
2. Delete the dump files from section 1.
