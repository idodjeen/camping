# A01: Test setup

**What to build:** A test runner the whole sprint can build on, per ADR 0001. `npm test` runs Vitest against PGlite, an in-process Postgres with the real drizzle migrations applied, plugged in through the same global database switch the scripts already use. No test ever touches the shared `dev` database.

**Blocked by:** None (can start immediately)

**Status:** done 2026-10-13

- [x] `npm test` runs and passes locally with no network and no env files
- [x] Each test file gets a fresh database with every migration applied
- [x] A small seeding helper creates a group, a trip, members with roles, and items, so tests read as scenarios
- [x] One real test calls an existing lib function (for example the inbox) with plain ids and checks the result
- [x] The handoff's gates mention `npm test` next to typecheck and build
- [x] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent

## Comments

- 2026-10-13: Vitest 3.2.7 pinned to Vite 6.4.4, not Vitest 5: Vitest 5 brings Vite 8, which needs Node
  22.12+, and this Mac runs 22.3. next-auth is inlined in the Vitest config because it imports
  `next/server` without an extension. First test: the bell inbox (`getInbox`, `markRead`), 4 cases.
