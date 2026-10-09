# P01: Production skips docs-only commits

**What to build:** A merge that changes nothing the app is built from (docs, tickets, agent notes) no
longer rebuilds production, so it no longer leaves every function cold and every open tab reloading.
Vercel's Ignored Build Step runs `scripts/vercel-ignore.sh`, wired up in `vercel.json`.

**Blocked by:** None

**Status:** claimed (branch `claude/perf-skip-docs-builds`)

**Files touched:** `vercel.json` (new), `scripts/vercel-ignore.sh` (new), `docs/handoff.md`,
`docs/architecture.md`, and this sprint's docs.

- [ ] Production builds only when something under `src/`, `public/`, `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs` or `vercel.json` changed since the live commit
- [ ] It compares with the live commit (`VERCEL_GIT_PREVIOUS_SHA`), not the previous commit, so a docs commit after a code commit that never built still builds
- [ ] Previews always build, and so does anything unexpected (no live commit, a git error)
- [ ] Tested against real commit pairs from `main`'s history (in the PR body)
- [ ] After merge: the next docs-only merge shows as skipped in Vercel's deployment list
- [ ] Done per the spec's definition of done

## Measured before and after

| | Before (Oct 7-9, from `git log`) | After (one week after merge) |
|---|---|---|
| Production builds | 25 | |
| Of which docs-only | 8 | |
